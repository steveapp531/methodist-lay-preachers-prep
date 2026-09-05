import { CONTENT_STATUS } from '../../../shared/constants.js';
import { ExamAttempt } from '../models/ExamAttempt.js';
import { MockExam } from '../models/MockExam.js';
import { Question } from '../models/Question.js';
import { TheoryEvaluation } from '../models/TheoryEvaluation.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, created, ok, pageMeta, pagination } from '../utils/http.js';
import { expireOverdueAttempts, saveProgress, startAttempt, submitAttempt } from '../services/mockExamService.js';
import { checkAchievements } from '../services/achievementService.js';
import { computeReadiness } from '../services/adaptiveService.js';
import { Exam } from '../models/Exam.js';

export const listMockExams = asyncHandler(async (req, res) => {
  const examId = req.query.exam || req.user?.examStage;
  if (!examId) throw ApiError.badRequest('Choose an examination first.');

  const mocks = await MockExam.find({ exam: examId, status: CONTENT_STATUS.PUBLISHED })
    .sort({ order: 1, createdAt: 1 })
    .populate('subject', 'name shortName code colour')
    .lean();

  const attempts = req.user
    ? await ExamAttempt.find({ user: req.user._id, mockExam: { $in: mocks.map((m) => m._id) } })
        .sort({ createdAt: -1 })
        .select('mockExam status percentage submittedAt')
        .lean()
    : [];

  const byMock = new Map();
  for (const attempt of attempts) {
    const key = String(attempt.mockExam);
    if (!byMock.has(key)) byMock.set(key, []);
    byMock.get(key).push(attempt);
  }

  return ok(res, {
    mockExams: mocks.map((mock) => {
      const history = byMock.get(String(mock._id)) || [];
      const marked = history.filter((h) => h.status === 'marked');
      return {
        ...mock,
        totalQuestions: mock.sections.reduce((sum, s) => sum + s.count, 0),
        history: {
          attempts: marked.length,
          bestScore: marked.length ? Math.max(...marked.map((m) => m.percentage)) : null,
          lastScore: marked[0]?.percentage ?? null,
          inProgressAttemptId: history.find((h) => h.status === 'in_progress')?._id ?? null,
        },
      };
    }),
  });
});

export const startMockExam = asyncHandler(async (req, res) => {
  await expireOverdueAttempts(req.user);
  const { attempt, mock, resumed } = await startAttempt({ user: req.user, mockExamId: req.body.mockExam });

  const questions = await Question.find({ _id: { $in: attempt.answers.map((a) => a.question) } });
  const byId = new Map(questions.map((q) => [String(q._id), q]));

  return created(res, {
    attempt: shapeAttempt(attempt, mock, byId),
    resumed,
  });
});

export const getAttempt = asyncHandler(async (req, res) => {
  const attempt = await ExamAttempt.findOne({ _id: req.params.id, user: req.user._id });
  if (!attempt) throw ApiError.notFound('That examination sitting was not found.');

  const mock = await MockExam.findById(attempt.mockExam).lean();
  const questions = await Question.find({ _id: { $in: attempt.answers.map((a) => a.question) } });
  const byId = new Map(questions.map((q) => [String(q._id), q]));

  // A sitting whose time has run out is marked on read rather than left open.
  if (attempt.status === 'in_progress' && attempt.expiresAt <= new Date()) {
    const marked = await submitAttempt({ user: req.user, attempt, autoSubmitted: true });
    return ok(res, { attempt: shapeAttempt(marked, mock, byId), autoSubmitted: true });
  }

  return ok(res, { attempt: shapeAttempt(attempt, mock, byId) });
});

export const saveAttemptProgress = asyncHandler(async (req, res) => {
  const attempt = await ExamAttempt.findOne({ _id: req.params.id, user: req.user._id });
  if (!attempt) throw ApiError.notFound('That examination sitting was not found.');
  if (attempt.status !== 'in_progress') throw ApiError.conflict('That examination has already been submitted.');

  await saveProgress({ attempt, updates: req.body.updates });

  return ok(res, {
    saved: true,
    secondsRemaining: Math.max(0, Math.round((attempt.expiresAt - Date.now()) / 1000)),
    answered: attempt.answers.filter((a) => a.answered).length,
    flagged: attempt.answers.filter((a) => a.flagged).length,
  });
});

export const submitMockExam = asyncHandler(async (req, res) => {
  const attempt = await ExamAttempt.findOne({ _id: req.params.id, user: req.user._id });
  if (!attempt) throw ApiError.notFound('That examination sitting was not found.');

  if (req.body?.updates?.length) await saveProgress({ attempt, updates: req.body.updates });

  const marked = await submitAttempt({ user: req.user, attempt });
  const exam = await Exam.findById(marked.exam);
  const readiness = await computeReadiness({ userId: req.user._id, exam });
  const achievements = await checkAchievements({ user: req.user, examId: marked.exam, readinessScore: readiness.score });

  return ok(res, { attempt: marked, readiness, achievements });
});

/** Submits the sitting currently open for a given mock examination. */
export const submitByMockExam = asyncHandler(async (req, res, next) => {
  const attempt = await ExamAttempt.findOne({
    user: req.user._id,
    mockExam: req.params.id,
    status: 'in_progress',
  }).sort({ startedAt: -1 });
  if (!attempt) throw ApiError.notFound('You do not have an examination in progress for that paper.');
  req.params.id = String(attempt._id);
  return submitMockExam(req, res, next);
});

/** Full review: every question with what was answered and why it was right. */
export const reviewAttempt = asyncHandler(async (req, res) => {
  const attempt = await ExamAttempt.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!attempt) throw ApiError.notFound('That examination sitting was not found.');
  if (attempt.status === 'in_progress') throw ApiError.conflict('Submit the examination before reviewing it.');

  // The paper's own pass mark and section labels live on the blueprint, and the
  // review screen needs both, so they travel with the result rather than
  // costing the client a second request.
  const mock = await MockExam.findById(attempt.mockExam).select('passMark sections instructions').lean();

  const questions = await Question.find({ _id: { $in: attempt.answers.map((a) => a.question) } })
    .populate('subject', 'name shortName')
    .populate('topic', 'title slug');
  const byId = new Map(questions.map((q) => [String(q._id), q]));

  const evaluationIds = attempt.answers.map((a) => a.theoryEvaluation).filter(Boolean);
  const evaluations = evaluationIds.length ? await TheoryEvaluation.find({ _id: { $in: evaluationIds } }).lean() : [];
  const evalById = new Map(evaluations.map((e) => [String(e._id), e]));

  return ok(res, {
    attempt: {
      id: String(attempt._id),
      title: attempt.title,
      status: attempt.status,
      percentage: attempt.percentage,
      totalMarks: attempt.totalMarks,
      totalAvailable: attempt.totalAvailable,
      objectiveMarks: attempt.objectiveMarks,
      objectiveAvailable: attempt.objectiveAvailable,
      theoryMarks: attempt.theoryMarks,
      theoryAvailable: attempt.theoryAvailable,
      questionsAttempted: attempt.questionsAttempted,
      questionsCorrect: attempt.questionsCorrect,
      questionsIncorrect: attempt.questionsIncorrect,
      timeTakenSeconds: attempt.timeTakenSeconds,
      durationMinutes: attempt.durationMinutes,
      topicBreakdown: attempt.topicBreakdown,
      strongTopics: attempt.strongTopics,
      weakTopics: attempt.weakTopics,
      readinessBand: attempt.readinessBand,
      submittedAt: attempt.submittedAt,
      autoSubmitted: attempt.autoSubmitted,
      passMark: mock?.passMark ?? 50,
      passed: attempt.percentage >= (mock?.passMark ?? 50),
      instructions: mock?.instructions || '',
      sections: (mock?.sections || []).map((s) => ({
        key: s.key,
        label: s.label,
        instructions: s.instructions,
        count: s.count,
        answerCount: s.answerCount,
        marksEach: s.marksEach,
      })),
    },
    questions: attempt.answers
      .map((answer) => {
        const question = byId.get(String(answer.question));
        if (!question) return null;
        return {
          sectionKey: answer.sectionKey,
          order: answer.order,
          counted: answer.counted,
          yourAnswer: {
            selectedOptionKeys: answer.selectedOptionKeys,
            textAnswer: answer.textAnswer,
            matchAnswer: answer.matchAnswer,
            viaVoice: answer.viaVoice,
            answered: answer.answered,
            flagged: answer.flagged,
            timeSpentSeconds: answer.timeSpentSeconds,
          },
          result: {
            isCorrect: answer.isCorrect,
            score: answer.score,
            marksAwarded: answer.marksAwarded,
            marksAvailable: answer.marksAvailable,
          },
          theoryEvaluation: answer.theoryEvaluation ? evalById.get(String(answer.theoryEvaluation)) : null,
          question: question.toReviewJSON(),
        };
      })
      .filter(Boolean),
  });
});

export const listAttempts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { user: req.user._id };
  const [rows, total] = await Promise.all([
    ExamAttempt.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('title status percentage totalMarks totalAvailable submittedAt durationMinutes timeTakenSeconds mockExam')
      .lean(),
    ExamAttempt.countDocuments(filter),
  ]);
  return ok(res, { attempts: rows }, pageMeta({ page, limit }, total));
});

/** Candidate-facing shape: never leaks answers while the paper is open. */
function shapeAttempt(attempt, mock, questionsById) {
  const open = attempt.status === 'in_progress';
  return {
    id: String(attempt._id),
    title: attempt.title,
    status: attempt.status,
    instructions: mock?.instructions || '',
    durationMinutes: attempt.durationMinutes,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    secondsRemaining: open ? Math.max(0, Math.round((attempt.expiresAt - Date.now()) / 1000)) : 0,
    passMark: mock?.passMark ?? 50,
    sections: (mock?.sections || []).map((s) => ({
      key: s.key,
      label: s.label,
      instructions: s.instructions,
      count: s.count,
      answerCount: s.answerCount,
      marksEach: s.marksEach,
    })),
    questions: attempt.answers
      .map((answer) => {
        const question = questionsById.get(String(answer.question));
        if (!question) return null;
        return {
          sectionKey: answer.sectionKey,
          order: answer.order,
          flagged: answer.flagged,
          answered: answer.answered,
          selectedOptionKeys: answer.selectedOptionKeys,
          textAnswer: answer.textAnswer,
          matchAnswer: answer.matchAnswer,
          viaVoice: answer.viaVoice,
          timeSpentSeconds: answer.timeSpentSeconds,
          question: open ? question.toCandidateJSON() : question.toReviewJSON(),
        };
      })
      .filter(Boolean),
    ...(open
      ? {}
      : {
          percentage: attempt.percentage,
          totalMarks: attempt.totalMarks,
          totalAvailable: attempt.totalAvailable,
        }),
  };
}
