import { CONTENT_STATUS, SESSION_MODES } from '../../../shared/constants.js';
import { Question } from '../models/Question.js';
import { Quiz } from '../models/Quiz.js';
import { QuestionAttempt } from '../models/QuestionAttempt.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, created, ok, pageMeta, pagination } from '../utils/http.js';
import { selectQuestions, summariseQuiz } from '../services/quizService.js';
import { submitAnswer } from '../services/attemptService.js';
import { checkAchievements } from '../services/achievementService.js';

function requireStage(req) {
  if (!req.user.examStage) throw ApiError.badRequest('Choose the examination you are preparing for first.');
  return req.user.examStage;
}

export const createQuiz = asyncHandler(async (req, res) => {
  const examId = requireStage(req);
  const { mode, subject, chapter, topic, difficulty, size, includeTheory, questionTypes } = req.body;

  const { questions, usedFallback } = await selectQuestions({
    userId: req.user._id,
    examId,
    mode,
    subjectId: subject,
    chapterId: chapter,
    topicId: topic,
    difficulty,
    size,
    includeTheory,
    questionTypes,
  });

  const quiz = await Quiz.create({
    user: req.user._id,
    exam: examId,
    mode,
    filters: { subject, chapter, topic, difficulty, questionTypes: questionTypes || [], includeTheory },
    questions: questions.map((q) => q._id),
    marksAvailable: questions.reduce((sum, q) => sum + (q.totalMarks || 1), 0),
  });

  return created(res, {
    quiz: {
      id: String(quiz._id),
      mode: quiz.mode,
      total: questions.length,
      marksAvailable: quiz.marksAvailable,
      startedAt: quiz.startedAt,
    },
    questions: questions.map((q) => q.toCandidateJSON()),
    notice: usedFallback
      ? 'There were not enough questions matching that selection, so the set has been topped up from the wider question bank.'
      : null,
  });
});

export const getQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.params.id, user: req.user._id });
  if (!quiz) throw ApiError.notFound('That quiz was not found.');

  const questions = await Question.find({ _id: { $in: quiz.questions } });
  const byId = new Map(questions.map((q) => [String(q._id), q]));
  const attempts = await QuestionAttempt.find({ quiz: quiz._id }).select('question isCorrect score').lean();
  const answered = new Set(attempts.map((a) => String(a.question)));

  return ok(res, {
    quiz: {
      id: String(quiz._id),
      mode: quiz.mode,
      status: quiz.status,
      cursor: quiz.cursor,
      answeredCount: quiz.answeredCount,
      correctCount: quiz.correctCount,
      total: quiz.questions.length,
    },
    questions: quiz.questions
      .map((id) => byId.get(String(id)))
      .filter(Boolean)
      .map((q) => ({ ...q.toCandidateJSON(), answered: answered.has(String(q._id)) })),
  });
});

/**
 * Answers one question.
 *
 * The marked result comes back with the full teaching payload — correct answer,
 * why, the syllabus reference and any scripture — because the point of the
 * platform is that a wrong answer teaches something.
 */
export const answerQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findOne({ _id: req.params.id, status: CONTENT_STATUS.PUBLISHED });
  if (!question) throw ApiError.notFound('That question was not found.');

  const { quiz: quizId, mode, timeSpentSeconds, ...response } = req.body;

  let quiz = null;
  if (quizId) {
    quiz = await Quiz.findOne({ _id: quizId, user: req.user._id });
    if (!quiz) throw ApiError.notFound('That quiz was not found.');
    if (quiz.status !== 'in_progress') throw ApiError.conflict('That quiz has already been completed.');
  }

  const { result, review, theoryEvaluation } = await submitAnswer({
    user: req.user,
    question,
    response,
    mode: quiz ? quiz.mode : mode || SESSION_MODES.PRACTICE,
    quizId: quiz?._id || null,
    timeSpentSeconds,
  });

  if (quiz) {
    quiz.answeredCount += 1;
    if (result.isCorrect) quiz.correctCount += 1;
    quiz.marksAwarded += result.marksAwarded;
    quiz.cursor = Math.min(quiz.cursor + 1, quiz.questions.length);
    quiz.timeSpentSeconds += timeSpentSeconds || 0;
    if (quiz.answeredCount >= quiz.questions.length) {
      quiz.status = 'completed';
      quiz.completedAt = new Date();
    }
    await quiz.save();
  }

  const achievements = await checkAchievements({ user: req.user, examId: question.exam });

  return ok(res, {
    result: {
      isCorrect: result.isCorrect,
      score: result.score,
      marksAwarded: result.marksAwarded,
      marksAvailable: result.marksAvailable,
      detail: result.detail,
    },
    review,
    theoryEvaluation,
    quiz: quiz
      ? {
          id: String(quiz._id),
          answeredCount: quiz.answeredCount,
          correctCount: quiz.correctCount,
          total: quiz.questions.length,
          status: quiz.status,
        }
      : null,
    achievements,
  });
});

export const completeQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findOne({ _id: req.params.id, user: req.user._id });
  if (!quiz) throw ApiError.notFound('That quiz was not found.');

  if (quiz.status === 'in_progress') {
    quiz.status = 'completed';
    quiz.completedAt = new Date();
    await quiz.save();
  }

  return ok(res, { quiz, summary: await summariseQuiz(quiz) });
});

export const listQuizzes = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { user: req.user._id };
  const [rows, total] = await Promise.all([
    Quiz.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('filters.subject', 'shortName name').lean(),
    Quiz.countDocuments(filter),
  ]);
  return ok(res, { quizzes: rows }, pageMeta({ page, limit }, total));
});

/** Every question the candidate has got wrong, most recent first. */
export const listMistakes = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const examId = requireStage(req);

  const rows = await QuestionAttempt.aggregate([
    { $match: { user: req.user._id, exam: examId, isCorrect: false } },
    { $sort: { answeredAt: -1 } },
    { $group: { _id: '$question', lastAt: { $first: '$answeredAt' }, misses: { $sum: 1 } } },
    { $sort: { lastAt: -1 } },
    { $skip: skip },
    { $limit: limit },
  ]);

  const total = (await QuestionAttempt.distinct('question', { user: req.user._id, exam: examId, isCorrect: false })).length;
  const questions = await Question.find({ _id: { $in: rows.map((r) => r._id) } })
    .populate('subject', 'shortName name')
    .populate('topic', 'title slug');
  const byId = new Map(questions.map((q) => [String(q._id), q]));

  return ok(
    res,
    {
      mistakes: rows
        .map((row) => {
          const question = byId.get(String(row._id));
          return question
            ? { question: question.toReviewJSON(), misses: row.misses, lastAttemptedAt: row.lastAt }
            : null;
        })
        .filter(Boolean),
    },
    pageMeta({ page, limit }, total),
  );
});
