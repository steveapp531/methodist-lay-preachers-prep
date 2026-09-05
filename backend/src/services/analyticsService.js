import mongoose from 'mongoose';
import { QuestionAttempt } from '../models/QuestionAttempt.js';
import { ExamAttempt } from '../models/ExamAttempt.js';
import { User } from '../models/User.js';
import { Question } from '../models/Question.js';
import { lastNDateKeys } from '../utils/dates.js';

const { Types } = mongoose;
const oid = (v) => new Types.ObjectId(String(v));

/** Daily activity for the student charts. Missing days appear as zeroes. */
export async function dailyActivity({ userId, examId, days = 30, timezone = 'Africa/Accra' }) {
  const keys = lastNDateKeys(days, timezone);
  const rows = await QuestionAttempt.aggregate([
    { $match: { user: oid(userId), exam: oid(examId), localDate: { $in: keys } } },
    {
      $group: {
        _id: '$localDate',
        questions: { $sum: 1 },
        correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
        seconds: { $sum: '$timeSpentSeconds' },
      },
    },
  ]);
  const byDate = new Map(rows.map((r) => [r._id, r]));
  return keys.map((date) => {
    const row = byDate.get(date);
    return {
      date,
      questions: row?.questions || 0,
      correct: row?.correct || 0,
      minutes: Math.round((row?.seconds || 0) / 60),
      accuracy: row?.questions ? row.correct / row.questions : null,
    };
  });
}

/** Rolling accuracy over the most recent attempts, for the trend line. */
export async function accuracyTrend({ userId, examId, buckets = 10, windowSize = 20 }) {
  const attempts = await QuestionAttempt.find({ user: userId, exam: examId })
    .sort({ answeredAt: -1 })
    .limit(buckets * windowSize)
    .select('score answeredAt')
    .lean();

  const chronological = attempts.reverse();
  const points = [];
  for (let i = windowSize; i <= chronological.length; i += windowSize) {
    const window = chronological.slice(i - windowSize, i);
    points.push({
      index: points.length + 1,
      upTo: window[window.length - 1].answeredAt,
      accuracy: window.reduce((s, a) => s + a.score, 0) / window.length,
      sampleSize: window.length,
    });
  }
  return points;
}

export async function studentOverview({ userId, examId }) {
  const [totals] = await QuestionAttempt.aggregate([
    { $match: { user: oid(userId), exam: oid(examId) } },
    {
      $group: {
        _id: null,
        attempts: { $sum: 1 },
        correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
        scoreSum: { $sum: '$score' },
        seconds: { $sum: '$timeSpentSeconds' },
        theory: { $sum: { $cond: [{ $eq: ['$questionType', 'theory'] }, 1, 0] } },
      },
    },
  ]);

  const mocks = await ExamAttempt.find({ user: userId, exam: examId, status: 'marked' })
    .sort({ submittedAt: -1 })
    .select('percentage submittedAt title objectiveMarks objectiveAvailable theoryMarks theoryAvailable')
    .lean();

  const distinctQuestions = await QuestionAttempt.distinct('question', { user: userId, exam: examId });

  return {
    questionsAnswered: totals?.attempts || 0,
    distinctQuestions: distinctQuestions.length,
    correct: totals?.correct || 0,
    incorrect: (totals?.attempts || 0) - (totals?.correct || 0),
    accuracy: totals?.attempts ? totals.scoreSum / totals.attempts : 0,
    studyMinutes: Math.round((totals?.seconds || 0) / 60),
    theoryAnswers: totals?.theory || 0,
    mockExamsCompleted: mocks.length,
    averageMockScore: mocks.length ? Math.round(mocks.reduce((s, m) => s + m.percentage, 0) / mocks.length) : null,
    bestMockScore: mocks.length ? Math.max(...mocks.map((m) => m.percentage)) : null,
    recentMocks: mocks.slice(0, 5),
  };
}

/* ---------------------------------------------------------------- admin --- */

export async function adminOverview({ examId = null, days = 30 } = {}) {
  const since = new Date(Date.now() - days * 86400000);
  const userFilter = examId ? { examStage: oid(examId) } : {};

  const [totalUsers, activeUsers, newUsers, byStage] = await Promise.all([
    User.countDocuments(userFilter),
    User.countDocuments({ ...userFilter, lastActiveAt: { $gte: since } }),
    User.countDocuments({ ...userFilter, createdAt: { $gte: since } }),
    User.aggregate([
      { $match: { examStage: { $ne: null } } },
      { $group: { _id: '$examStage', count: { $sum: 1 } } },
      { $lookup: { from: 'exams', localField: '_id', foreignField: '_id', as: 'exam' } },
      { $unwind: '$exam' },
      { $project: { _id: 0, examId: '$_id', code: '$exam.code', name: '$exam.name', count: 1 } },
    ]),
  ]);

  const attemptFilter = examId ? { exam: oid(examId) } : {};
  const [attemptTotals] = await QuestionAttempt.aggregate([
    { $match: attemptFilter },
    {
      $group: {
        _id: null,
        attempts: { $sum: 1 },
        scoreSum: { $sum: '$score' },
        theory: { $sum: { $cond: [{ $eq: ['$questionType', 'theory'] }, 1, 0] } },
      },
    },
  ]);

  const [mockTotals] = await ExamAttempt.aggregate([
    { $match: { ...attemptFilter, status: 'marked' } },
    { $group: { _id: null, count: { $sum: 1 }, avg: { $avg: '$percentage' } } },
  ]);

  const dailyActiveUsers = await QuestionAttempt.aggregate([
    { $match: { ...attemptFilter, answeredAt: { $gte: since } } },
    { $group: { _id: { date: '$localDate', user: '$user' } } },
    { $group: { _id: '$_id.date', users: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', users: 1 } },
  ]);

  return {
    users: { total: totalUsers, activeLastNDays: activeUsers, newLastNDays: newUsers, byStage },
    engagement: {
      questionsAttempted: attemptTotals?.attempts || 0,
      averageAccuracy: attemptTotals?.attempts ? attemptTotals.scoreSum / attemptTotals.attempts : 0,
      theoryAnswers: attemptTotals?.theory || 0,
      mockExamsCompleted: mockTotals?.count || 0,
      averageMockScore: mockTotals?.avg ? Math.round(mockTotals.avg) : null,
      dailyActiveUsers,
    },
    windowDays: days,
  };
}

/** Questions candidates get wrong most often — the ones worth reviewing. */
export async function hardestQuestions({ examId = null, limit = 10, minAttempts = 5 }) {
  const filter = { 'stats.attempts': { $gte: minAttempts } };
  if (examId) filter.exam = oid(examId);
  return Question.find(filter)
    .sort({ 'stats.accuracy': 1, 'stats.attempts': -1 })
    .limit(limit)
    .populate('subject', 'name shortName code')
    .populate('topic', 'title')
    .select('questionId prompt type difficulty stats subject topic sourceKind answerConfidence')
    .lean();
}

export async function hardestTopics({ examId = null, limit = 10, minAttempts = 10 }) {
  const filter = examId ? { exam: oid(examId) } : {};
  return QuestionAttempt.aggregate([
    { $match: { ...filter, topic: { $ne: null } } },
    {
      $group: {
        _id: '$topic',
        attempts: { $sum: 1 },
        scoreSum: { $sum: '$score' },
        learners: { $addToSet: '$user' },
      },
    },
    { $match: { attempts: { $gte: minAttempts } } },
    {
      $project: {
        attempts: 1,
        learners: { $size: '$learners' },
        accuracy: { $divide: ['$scoreSum', '$attempts'] },
      },
    },
    { $sort: { accuracy: 1 } },
    { $limit: limit },
    { $lookup: { from: 'topics', localField: '_id', foreignField: '_id', as: 'topic' } },
    { $unwind: '$topic' },
    { $lookup: { from: 'subjects', localField: 'topic.subject', foreignField: '_id', as: 'subject' } },
    { $unwind: '$subject' },
    {
      $project: {
        _id: 0,
        topicId: '$_id',
        title: '$topic.title',
        subject: '$subject.shortName',
        attempts: 1,
        learners: 1,
        accuracy: 1,
      },
    },
  ]);
}

export async function popularTopics({ examId = null, limit = 10 }) {
  const filter = examId ? { exam: oid(examId) } : {};
  return QuestionAttempt.aggregate([
    { $match: { ...filter, topic: { $ne: null } } },
    { $group: { _id: '$topic', attempts: { $sum: 1 }, learners: { $addToSet: '$user' } } },
    { $project: { attempts: 1, learners: { $size: '$learners' } } },
    { $sort: { attempts: -1 } },
    { $limit: limit },
    { $lookup: { from: 'topics', localField: '_id', foreignField: '_id', as: 'topic' } },
    { $unwind: '$topic' },
    { $project: { _id: 0, topicId: '$_id', title: '$topic.title', attempts: 1, learners: 1 } },
  ]);
}
