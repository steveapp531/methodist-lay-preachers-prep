import { QUESTION_TYPES, SESSION_MODES } from '../../../shared/constants.js';
import { Question } from '../models/Question.js';
import { QuestionAttempt } from '../models/QuestionAttempt.js';
import { gradeObjective } from './scoringService.js';
import { evaluateTheoryAnswer } from './theory/index.js';
import { recordAttemptState } from './spacedRepetition.js';
import { recalculateTopicProgress, touchActivity } from './progressService.js';
import { localDateKey } from '../utils/dates.js';

/**
 * The single path every answer takes, whether it came from a quiz, a mock
 * examination or a one-off practice question.
 *
 * Marks the answer, writes the immutable attempt record, updates the spaced
 * repetition state and the topic mastery, and returns the full teaching payload
 * the interface shows next.
 */
export async function submitAnswer({
  user,
  question,
  response = {},
  mode = SESSION_MODES.PRACTICE,
  quizId = null,
  examAttemptId = null,
  timeSpentSeconds = 0,
  persist = true,
}) {
  const doc = question._id ? question : await Question.findById(question);
  if (!doc) throw new Error('Question not found');

  let result;
  let theoryEvaluation = null;

  if (doc.type === QUESTION_TYPES.THEORY) {
    const { evaluation, document } = await evaluateTheoryAnswer({
      question: doc,
      answerText: response.textAnswer || '',
      user,
      examAttempt: examAttemptId,
      quiz: quizId,
      viaVoice: Boolean(response.viaVoice),
      persist,
    });
    theoryEvaluation = document;
    const marksAvailable = evaluation.marksAvailable || doc.totalMarks || 0;
    const score = marksAvailable ? evaluation.marksAwarded / marksAvailable : 0;
    result = {
      isCorrect: score >= 0.7,
      score,
      marksAwarded: evaluation.marksAwarded,
      marksAvailable,
      detail: { theory: evaluation },
    };
  } else {
    result = gradeObjective(doc, response);
  }

  if (!persist) {
    return { result, theoryEvaluation: theoryEvaluation?.toObject?.() ?? null, review: doc.toReviewJSON(), attempt: null };
  }

  const attempt = await QuestionAttempt.create({
    user: user._id,
    question: doc._id,
    exam: doc.exam,
    subject: doc.subject,
    chapter: doc.chapter,
    topic: doc.topic,
    mode,
    quiz: quizId,
    examAttempt: examAttemptId,
    questionType: doc.type,
    selectedOptionKeys: response.selectedOptionKeys || [],
    textAnswer: response.textAnswer || '',
    matchAnswer: response.matchAnswer || undefined,
    viaVoice: Boolean(response.viaVoice),
    isCorrect: result.isCorrect,
    score: result.score,
    marksAwarded: result.marksAwarded,
    marksAvailable: result.marksAvailable,
    theoryEvaluation: theoryEvaluation?._id || null,
    timeSpentSeconds: Math.max(0, Math.min(timeSpentSeconds || 0, 3600)),
    answeredAt: new Date(),
    localDate: localDateKey(new Date(), user.timezone),
  });

  await Promise.all([
    recordAttemptState({
      user,
      question: doc,
      score: result.score,
      isCorrect: result.isCorrect,
      seconds: timeSpentSeconds,
    }),
    updateQuestionStats(doc, result, timeSpentSeconds),
    doc.topic ? recalculateTopicProgress({ userId: user._id, topicId: doc.topic }) : Promise.resolve(),
    touchActivity(user),
  ]);

  return {
    result,
    attempt,
    theoryEvaluation: theoryEvaluation?.toObject?.() ?? null,
    review: doc.toReviewJSON(),
  };
}

/** Keeps the observed difficulty of each question current. */
async function updateQuestionStats(question, result, seconds) {
  const attempts = (question.stats?.attempts || 0) + 1;
  const correct = (question.stats?.correct || 0) + (result.isCorrect ? 1 : 0);
  const prevAvg = question.stats?.averageSeconds || 0;
  const averageSeconds = Math.round((prevAvg * (attempts - 1) + (seconds || 0)) / attempts);

  await Question.updateOne(
    { _id: question._id },
    {
      $set: {
        'stats.attempts': attempts,
        'stats.correct': correct,
        'stats.accuracy': correct / attempts,
        'stats.averageSeconds': averageSeconds,
        'stats.lastAttemptedAt': new Date(),
      },
    },
  );
}
