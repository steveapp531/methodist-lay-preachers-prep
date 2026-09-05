import mongoose from 'mongoose';
import { MASTERY, PROGRESS_STATUS } from '../../../shared/constants.js';
import { Question } from '../models/Question.js';
import { QuestionAttempt } from '../models/QuestionAttempt.js';
import { StudyProgress } from '../models/StudyProgress.js';
import { Topic } from '../models/Topic.js';
import { User } from '../models/User.js';
import { advanceStreak, localDateKey } from '../utils/dates.js';

const { Types } = mongoose;

/**
 * Recomputes a candidate's mastery of one topic from their attempt history.
 *
 * Mastery is not simply accuracy. A candidate who answered three questions
 * correctly out of a topic containing forty has not mastered it, so accuracy is
 * damped by coverage — how much of the topic's question bank they have actually
 * faced. Both numbers are stored so the interface can explain the score.
 */
export async function recalculateTopicProgress({ userId, topicId }) {
  const topic = await Topic.findById(topicId).select('_id exam subject chapter').lean();
  if (!topic) return null;

  const [stats] = await QuestionAttempt.aggregate([
    { $match: { user: new Types.ObjectId(String(userId)), topic: new Types.ObjectId(String(topicId)) } },
    {
      $group: {
        _id: '$question',
        attempts: { $sum: 1 },
        lastScore: { $last: '$score' },
        lastCorrect: { $last: '$isCorrect' },
        lastAt: { $max: '$answeredAt' },
        seconds: { $sum: '$timeSpentSeconds' },
      },
    },
    {
      $group: {
        _id: null,
        distinctQuestions: { $sum: 1 },
        attempts: { $sum: '$attempts' },
        correct: { $sum: { $cond: ['$lastCorrect', 1, 0] } },
        scoreSum: { $sum: '$lastScore' },
        seconds: { $sum: '$seconds' },
        lastAttemptedAt: { $max: '$lastAt' },
      },
    },
  ]);

  const questionPool = await Question.countDocuments({ topic: topicId, status: 'published' });

  const progress =
    (await StudyProgress.findOne({ user: userId, topic: topicId })) ||
    new StudyProgress({
      user: userId,
      topic: topicId,
      exam: topic.exam,
      subject: topic.subject,
      chapter: topic.chapter,
    });

  if (!stats) {
    progress.attempts = 0;
    progress.correct = 0;
    progress.accuracy = 0;
    progress.mastery = 0;
    await progress.save();
    return progress;
  }

  const accuracy = stats.distinctQuestions ? stats.scoreSum / stats.distinctQuestions : 0;
  // Coverage saturates at 60% of the pool: you need not see every question.
  const coverage = questionPool ? Math.min(1, stats.distinctQuestions / Math.max(1, questionPool * 0.6)) : 0;
  const mastery = Math.round(accuracy * (0.35 + 0.65 * coverage) * 100);

  progress.attempts = stats.attempts;
  progress.correct = stats.correct;
  progress.accuracy = accuracy;
  progress.mastery = mastery;
  progress.lastAttemptedAt = stats.lastAttemptedAt;
  progress.revisionPriority = Math.round((1 - accuracy) * 100) / 100;

  if (progress.status === PROGRESS_STATUS.NOT_STARTED) progress.status = PROGRESS_STATUS.IN_PROGRESS;
  if (progress.status === PROGRESS_STATUS.COMPLETED && accuracy < MASTERY.WEAK_ACCURACY && stats.attempts >= MASTERY.MIN_ATTEMPTS) {
    progress.status = PROGRESS_STATUS.NEEDS_REVISION;
  }

  await progress.save();
  return progress;
}

/** Records time spent reading a topic and marks it as started. */
export async function recordStudyTime({ userId, topicId, seconds }) {
  const topic = await Topic.findById(topicId).select('exam subject chapter').lean();
  if (!topic) return null;

  const progress = await StudyProgress.findOneAndUpdate(
    { user: userId, topic: topicId },
    {
      $setOnInsert: { exam: topic.exam, subject: topic.subject, chapter: topic.chapter, status: PROGRESS_STATUS.IN_PROGRESS },
      $inc: { studySeconds: Math.max(0, Math.min(seconds, 3600)), viewCount: 1 },
      $set: { lastStudiedAt: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await User.updateOne({ _id: userId }, { $inc: { totalStudySeconds: Math.max(0, Math.min(seconds, 3600)) } });
  return progress;
}

/** Called on every study action; advances the streak at most once per day. */
export async function touchActivity(user) {
  const today = localDateKey(new Date(), user.timezone);
  const next = advanceStreak(user.streak, today);
  const changed = next.lastStudyDate !== user.streak?.lastStudyDate;

  user.streak = next;
  user.lastActiveAt = new Date();
  await user.save();
  return { streak: next, isNewDay: changed };
}

/** Subject-level rollup used by the dashboard and the progress page. */
export async function subjectProgress({ userId, examId }) {
  return StudyProgress.aggregate([
    { $match: { user: new Types.ObjectId(String(userId)), exam: new Types.ObjectId(String(examId)) } },
    {
      $group: {
        _id: '$subject',
        topicsTouched: { $sum: 1 },
        topicsCompleted: { $sum: { $cond: [{ $eq: ['$status', PROGRESS_STATUS.COMPLETED] }, 1, 0] } },
        topicsNeedingRevision: { $sum: { $cond: [{ $eq: ['$status', PROGRESS_STATUS.NEEDS_REVISION] }, 1, 0] } },
        attempts: { $sum: '$attempts' },
        correct: { $sum: '$correct' },
        masterySum: { $sum: '$mastery' },
        studySeconds: { $sum: '$studySeconds' },
      },
    },
    {
      $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subject' },
    },
    { $unwind: '$subject' },
    {
      $project: {
        _id: 0,
        subjectId: '$_id',
        name: '$subject.name',
        shortName: '$subject.shortName',
        code: '$subject.code',
        slug: '$subject.slug',
        order: '$subject.order',
        totalTopics: '$subject.stats.topicCount',
        topicsTouched: 1,
        topicsCompleted: 1,
        topicsNeedingRevision: 1,
        attempts: 1,
        correct: 1,
        studySeconds: 1,
        accuracy: { $cond: [{ $gt: ['$attempts', 0] }, { $divide: ['$correct', '$attempts'] }, 0] },
        mastery: { $cond: [{ $gt: ['$topicsTouched', 0] }, { $divide: ['$masterySum', '$topicsTouched'] }, 0] },
      },
    },
    { $sort: { order: 1 } },
  ]);
}

/** Topics sorted by how much they need attention. */
export async function weakTopics({ userId, examId, limit = 5, minAttempts = MASTERY.MIN_ATTEMPTS }) {
  return StudyProgress.find({ user: userId, exam: examId, attempts: { $gte: minAttempts } })
    .sort({ mastery: 1, attempts: -1 })
    .limit(limit)
    .populate('topic', 'title slug number')
    .populate('subject', 'name shortName code slug')
    .lean();
}

export async function strongTopics({ userId, examId, limit = 5, minAttempts = MASTERY.MIN_ATTEMPTS }) {
  return StudyProgress.find({ user: userId, exam: examId, attempts: { $gte: minAttempts } })
    .sort({ mastery: -1, attempts: -1 })
    .limit(limit)
    .populate('topic', 'title slug number')
    .populate('subject', 'name shortName code slug')
    .lean();
}
