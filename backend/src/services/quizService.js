import mongoose from 'mongoose';
import {
  CONTENT_STATUS,
  OBJECTIVE_TYPES,
  QUESTION_TYPES,
  SESSION_MODES,
} from '../../../shared/constants.js';
import { Question } from '../models/Question.js';
import { QuestionAttempt } from '../models/QuestionAttempt.js';
import { QuestionState } from '../models/QuestionState.js';
import { Bookmark } from '../models/Bookmark.js';
import { StudyProgress } from '../models/StudyProgress.js';
import { ApiError } from '../utils/ApiError.js';
import { buildDailyRevision } from './spacedRepetition.js';

const { Types } = mongoose;
const oid = (v) => new Types.ObjectId(String(v));

/**
 * Selects the questions for a practice session.
 *
 * Every mode narrows the same published pool in a different way, then the set
 * is shuffled. Modes that draw on personal history (mistakes, weak areas,
 * revision) fall back to the general pool when history is thin, so a new
 * candidate never sees an empty quiz.
 */
export async function selectQuestions({
  userId,
  examId,
  mode = SESSION_MODES.PRACTICE,
  subjectId = null,
  chapterId = null,
  topicId = null,
  difficulty = null,
  size = 10,
  includeTheory = false,
  questionTypes = null,
}) {
  const limit = Math.min(Math.max(Number(size) || 10, 1), 100);

  const base = { exam: oid(examId), status: CONTENT_STATUS.PUBLISHED };
  if (subjectId) base.subject = oid(subjectId);
  if (chapterId) base.chapter = oid(chapterId);
  if (topicId) base.topic = oid(topicId);
  if (difficulty) base.difficulty = difficulty;

  const types = questionTypes?.length
    ? questionTypes
    : includeTheory
      ? [...OBJECTIVE_TYPES, QUESTION_TYPES.THEORY]
      : OBJECTIVE_TYPES;
  base.type = { $in: types };

  let ids = [];
  let usedFallback = false;

  switch (mode) {
    case SESSION_MODES.MISTAKES: {
      ids = await questionsFromStates({ userId, examId, filter: { incorrect: { $gt: 0 } }, sort: { revisionPriority: -1 }, base, limit });
      break;
    }
    case SESSION_MODES.BOOKMARKS: {
      const marks = await Bookmark.find({ user: userId, targetType: 'question' }).select('question').lean();
      const candidateIds = marks.map((m) => m.question).filter(Boolean);
      ids = await filterToPool({ base, ids: candidateIds, limit });
      break;
    }
    case SESSION_MODES.UNSEEN: {
      const seen = await QuestionState.find({ user: userId, exam: examId }).distinct('question');
      ids = await sample({ ...base, _id: { $nin: seen } }, limit);
      break;
    }
    case SESSION_MODES.WEAK_AREAS: {
      const weak = await StudyProgress.find({ user: userId, exam: examId, attempts: { $gte: 3 } })
        .sort({ mastery: 1 })
        .limit(5)
        .select('topic')
        .lean();
      const weakIds = weak.map((w) => w.topic);
      ids = weakIds.length ? await sample({ ...base, topic: { $in: weakIds } }, limit) : [];
      break;
    }
    case SESSION_MODES.DAILY_REVISION: {
      const weak = await StudyProgress.find({ user: userId, exam: examId, attempts: { $gte: 3 } })
        .sort({ mastery: 1 })
        .limit(5)
        .select('topic')
        .lean();
      const { items } = await buildDailyRevision({
        userId,
        examId,
        size: limit,
        weakTopicIds: weak.map((w) => w.topic),
      });
      ids = await filterToPool({ base, ids: items.map((i) => i.question), limit });
      break;
    }
    default:
      ids = await sample(base, limit);
  }

  // Top up from the general pool when a personalised mode came up short.
  if (ids.length < limit) {
    usedFallback = ids.length > 0 || mode !== SESSION_MODES.PRACTICE;
    const filler = await sample({ ...base, _id: { $nin: ids.map(oid) } }, limit - ids.length);
    ids = [...ids, ...filler];
  }

  if (!ids.length) {
    throw ApiError.notFound(
      'There are no published questions matching that selection yet. Try a different subject, or ask an administrator to publish more questions.',
    );
  }

  const questions = await Question.find({ _id: { $in: ids } });
  // Preserve the sampled order rather than MongoDB's.
  const byId = new Map(questions.map((q) => [String(q._id), q]));
  return { questions: ids.map((id) => byId.get(String(id))).filter(Boolean), usedFallback };
}

async function sample(filter, limit) {
  if (limit <= 0) return [];
  const rows = await Question.aggregate([{ $match: filter }, { $sample: { size: limit } }, { $project: { _id: 1 } }]);
  return rows.map((r) => r._id);
}

async function questionsFromStates({ userId, examId, filter, sort, base, limit }) {
  const states = await QuestionState.find({ user: userId, exam: examId, ...filter })
    .sort(sort)
    .limit(limit * 3)
    .select('question')
    .lean();
  return filterToPool({ base, ids: states.map((s) => s.question), limit });
}

/** Keeps only ids that still satisfy the pool filter (published, right subject…). */
async function filterToPool({ base, ids, limit }) {
  if (!ids.length) return [];
  const rows = await Question.find({ ...base, _id: { $in: ids } })
    .limit(limit)
    .select('_id')
    .lean();
  return rows.map((r) => r._id);
}

/** Summary shown at the end of a practice session. */
export async function summariseQuiz(quiz) {
  const attempts = await QuestionAttempt.find({ quiz: quiz._id })
    .populate('topic', 'title slug')
    .populate('subject', 'name shortName')
    .lean();

  const byTopic = new Map();
  for (const attempt of attempts) {
    const key = attempt.topic ? String(attempt.topic._id) : 'unassigned';
    const entry = byTopic.get(key) || {
      topicId: attempt.topic?._id || null,
      topicTitle: attempt.topic?.title || 'Unassigned',
      subjectName: attempt.subject?.shortName || attempt.subject?.name || '',
      attempted: 0,
      correct: 0,
    };
    entry.attempted += 1;
    if (attempt.isCorrect) entry.correct += 1;
    byTopic.set(key, entry);
  }

  const topics = [...byTopic.values()].map((t) => ({ ...t, accuracy: t.attempted ? t.correct / t.attempted : 0 }));
  topics.sort((a, b) => a.accuracy - b.accuracy);

  return {
    answered: quiz.answeredCount,
    correct: quiz.correctCount,
    incorrect: quiz.answeredCount - quiz.correctCount,
    accuracy: quiz.answeredCount ? quiz.correctCount / quiz.answeredCount : 0,
    marksAwarded: quiz.marksAwarded,
    marksAvailable: quiz.marksAvailable,
    timeSpentSeconds: quiz.timeSpentSeconds,
    topicBreakdown: topics,
    weakest: topics.filter((t) => t.accuracy < 0.6).slice(0, 3),
    strongest: [...topics].reverse().filter((t) => t.accuracy >= 0.8).slice(0, 3),
  };
}
