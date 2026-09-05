import { LEITNER_INTERVALS } from '../../../shared/constants.js';
import { QuestionState } from '../models/QuestionState.js';

const DAY_MS = 86400000;

/**
 * Updates the per-question memory state after an attempt.
 *
 * A correct answer promotes the question one Leitner box, pushing its next
 * appearance further into the future. Anything less than fully correct sends it
 * back to box zero so it returns the next day. Partial credit on theory answers
 * is treated as "not yet" — a half-remembered answer is still worth revisiting.
 */
export async function recordAttemptState({ user, question, score, isCorrect, seconds = 0 }) {
  const userId = user._id ?? user;
  const state =
    (await QuestionState.findOne({ user: userId, question: question._id })) ||
    new QuestionState({
      user: userId,
      question: question._id,
      exam: question.exam,
      subject: question.subject,
      topic: question.topic || null,
    });

  const passed = Boolean(isCorrect) || score >= 0.8;

  state.attempts += 1;
  if (passed) {
    state.correct += 1;
    state.consecutiveCorrect += 1;
    state.lastCorrectAt = new Date();
    state.box = Math.min(LEITNER_INTERVALS.length - 1, state.box + 1);
  } else {
    state.incorrect += 1;
    state.consecutiveCorrect = 0;
    state.box = 0;
  }

  state.accuracy = state.correct / state.attempts;
  state.averageSeconds = state.averageSeconds
    ? Math.round((state.averageSeconds * (state.attempts - 1) + seconds) / state.attempts)
    : seconds;
  state.lastAttemptedAt = new Date();

  const intervalDays = LEITNER_INTERVALS[state.box];
  state.dueAt = new Date(Date.now() + Math.max(intervalDays, passed ? 1 : 0) * DAY_MS);
  // A wrong answer should come back tomorrow, not in an hour.
  if (!passed) state.dueAt = new Date(Date.now() + DAY_MS);

  state.isMastered = state.attempts >= 3 && state.consecutiveCorrect >= 3 && state.accuracy >= 0.8;
  state.revisionPriority = computePriority(state);

  await state.save();
  return state;
}

/**
 * A single number the revision scheduler sorts by. Larger means "sooner".
 *
 *   error rate      — questions frequently missed matter most
 *   overdueness     — how far past its due date the question is
 *   recency penalty — something answered minutes ago should not reappear
 *   mastery damping — mastered questions sink to the bottom
 */
export function computePriority(state, now = Date.now()) {
  const attempts = state.attempts || 0;
  if (!attempts) return 1;

  const errorRate = state.incorrect / attempts;
  const overdueDays = Math.max(0, (now - new Date(state.dueAt).getTime()) / DAY_MS);
  const sinceLastHours = state.lastAttemptedAt ? (now - new Date(state.lastAttemptedAt).getTime()) / 3600000 : 999;

  let score = errorRate * 3 + Math.min(overdueDays, 30) * 0.15 + Math.min(attempts, 10) * 0.02;
  if (sinceLastHours < 4) score -= 2;
  if (state.isMastered) score -= 1.5;
  if (state.consecutiveCorrect >= 2) score -= 0.4 * state.consecutiveCorrect;

  return Math.round(Math.max(0, score) * 1000) / 1000;
}

/**
 * Builds the Daily Revision set.
 *
 * The mix is deliberate rather than purely algorithmic: previously incorrect
 * questions, questions from weak topics, questions falling due, and a few
 * unseen ones so the set never becomes a closed loop.
 */
export async function buildDailyRevision({ userId, examId, size = 10, weakTopicIds = [] }) {
  const now = new Date();
  const quotas = {
    incorrect: Math.round(size * 0.4),
    weak: Math.round(size * 0.3),
    due: Math.round(size * 0.2),
  };
  quotas.fresh = Math.max(0, size - quotas.incorrect - quotas.weak - quotas.due);

  const chosen = new Map();
  const take = (docs, bucket) => {
    for (const doc of docs) {
      const key = String(doc.question);
      if (chosen.has(key)) continue;
      chosen.set(key, { question: doc.question, bucket, topic: doc.topic, priority: doc.revisionPriority ?? 0 });
    }
  };

  const base = { user: userId, exam: examId };

  const incorrect = await QuestionState.find({ ...base, incorrect: { $gt: 0 }, isMastered: false })
    .sort({ revisionPriority: -1, lastAttemptedAt: 1 })
    .limit(quotas.incorrect * 2)
    .select('question topic revisionPriority')
    .lean();
  take(incorrect.slice(0, quotas.incorrect), 'previously_incorrect');

  if (weakTopicIds.length) {
    const weak = await QuestionState.find({ ...base, topic: { $in: weakTopicIds }, isMastered: false })
      .sort({ revisionPriority: -1 })
      .limit(quotas.weak * 2)
      .select('question topic revisionPriority')
      .lean();
    take(weak.slice(0, quotas.weak), 'weak_area');
  }

  const due = await QuestionState.find({ ...base, dueAt: { $lte: now } })
    .sort({ dueAt: 1 })
    .limit(quotas.due * 2)
    .select('question topic revisionPriority')
    .lean();
  take(due.slice(0, quotas.due), 'due_for_review');

  return { items: [...chosen.values()], quotas };
}
