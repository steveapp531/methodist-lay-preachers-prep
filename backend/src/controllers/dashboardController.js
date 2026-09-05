import { Exam } from '../models/Exam.js';
import { QuestionAttempt } from '../models/QuestionAttempt.js';
import { Quiz } from '../models/Quiz.js';
import { ExamAttempt } from '../models/ExamAttempt.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, ok } from '../utils/http.js';
import { buildRecommendations, computeReadiness, performanceNarrative } from '../services/adaptiveService.js';
import { accuracyTrend, dailyActivity, studentOverview } from '../services/analyticsService.js';
import { strongTopics, subjectProgress, weakTopics } from '../services/progressService.js';
import { achievementBoard } from '../services/achievementService.js';
import { daysUntil, localDateKey } from '../utils/dates.js';

async function requireExam(user) {
  if (!user.examStage) throw ApiError.badRequest('Choose the examination you are preparing for first.');
  const exam = await Exam.findById(user.examStage);
  if (!exam) throw ApiError.badRequest('The examination on your profile is no longer available.');
  return exam;
}

/** Everything the dashboard needs, in one request. */
export const getDashboard = asyncHandler(async (req, res) => {
  const { user } = req;
  const exam = await requireExam(user);
  const today = localDateKey(new Date(), user.timezone);

  const [overview, readiness, subjects, weak, strong, narrative, activity, achievements, todayCount] =
    await Promise.all([
      studentOverview({ userId: user._id, examId: exam._id }),
      computeReadiness({ userId: user._id, exam }),
      subjectProgress({ userId: user._id, examId: exam._id }),
      weakTopics({ userId: user._id, examId: exam._id, limit: 3 }),
      strongTopics({ userId: user._id, examId: exam._id, limit: 3 }),
      performanceNarrative({ userId: user._id, exam }),
      dailyActivity({ userId: user._id, examId: exam._id, days: 14, timezone: user.timezone }),
      achievementBoard(user._id),
      QuestionAttempt.countDocuments({ user: user._id, localDate: today }),
    ]);

  const recommendations = await buildRecommendations({ userId: user._id, exam, user });

  const totalTopics = readiness.evidence.totalTopics;
  const overallProgress = totalTopics
    ? Math.round((readiness.evidence.topicsCompleted / totalTopics) * 100)
    : 0;

  const recentActivity = await recentEvents(user._id);

  return ok(res, {
    greeting: {
      name: user.name.split(' ')[0],
      partOfDay: partOfDay(user.timezone),
      examName: exam.name,
      examShortName: exam.shortName || exam.name,
    },
    examDate: user.examDate,
    daysUntilExam: daysUntil(user.examDate, user.timezone),
    overallProgress,
    readiness,
    streak: user.streak,
    dailyGoal: {
      target: user.preferences?.dailyQuestionGoal ?? 20,
      completed: todayCount,
      met: todayCount >= (user.preferences?.dailyQuestionGoal ?? 20),
    },
    overview,
    narrative,
    subjects,
    weakTopics: weak.map(shapeTopicProgress),
    strongTopics: strong.map(shapeTopicProgress),
    recommendations,
    activity,
    achievements: { earned: achievements.earned.slice(0, 6), points: achievements.points, total: achievements.total },
    recentActivity,
  });
});

export const getProgress = asyncHandler(async (req, res) => {
  const { user } = req;
  const exam = await requireExam(user);

  const [subjects, trend, activity, overview, readiness, weak, strong, achievements] = await Promise.all([
    subjectProgress({ userId: user._id, examId: exam._id }),
    accuracyTrend({ userId: user._id, examId: exam._id }),
    dailyActivity({ userId: user._id, examId: exam._id, days: 30, timezone: user.timezone }),
    studentOverview({ userId: user._id, examId: exam._id }),
    computeReadiness({ userId: user._id, exam }),
    weakTopics({ userId: user._id, examId: exam._id, limit: 10 }),
    strongTopics({ userId: user._id, examId: exam._id, limit: 10 }),
    achievementBoard(user._id),
  ]);

  return ok(res, {
    subjects,
    accuracyTrend: trend,
    activity,
    overview,
    readiness,
    weakTopics: weak.map(shapeTopicProgress),
    strongTopics: strong.map(shapeTopicProgress),
    achievements,
    streak: user.streak,
  });
});

function shapeTopicProgress(row) {
  return {
    topicId: row.topic?._id ? String(row.topic._id) : null,
    title: row.topic?.title || 'Unknown topic',
    slug: row.topic?.slug,
    subject: row.subject?.shortName || row.subject?.name || '',
    mastery: Math.round(row.mastery || 0),
    accuracy: row.accuracy || 0,
    attempts: row.attempts || 0,
    status: row.status,
  };
}

async function recentEvents(userId) {
  const [quizzes, mocks] = await Promise.all([
    Quiz.find({ user: userId, status: 'completed' })
      .sort({ completedAt: -1 })
      .limit(5)
      .select('mode answeredCount correctCount completedAt')
      .lean(),
    ExamAttempt.find({ user: userId, status: 'marked' })
      .sort({ submittedAt: -1 })
      .limit(3)
      .select('title percentage submittedAt')
      .lean(),
  ]);

  const events = [
    ...quizzes.map((q) => ({
      kind: 'quiz',
      at: q.completedAt,
      title: labelForMode(q.mode),
      detail: `${q.correctCount} of ${q.answeredCount} correct`,
      accuracy: q.answeredCount ? q.correctCount / q.answeredCount : 0,
    })),
    ...mocks.map((m) => ({
      kind: 'mock',
      at: m.submittedAt,
      title: m.title,
      detail: `${m.percentage}%`,
      accuracy: m.percentage / 100,
    })),
  ];

  return events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6);
}

function labelForMode(mode) {
  return (
    {
      practice: 'Practice quiz',
      topic_quiz: 'Topic quiz',
      daily_revision: 'Daily revision',
      weak_areas: 'Weak areas practice',
      mistakes: 'Mistakes practice',
      bookmarks: 'Bookmarked questions',
      unseen: 'New questions',
    }[mode] || 'Quiz'
  );
}

function partOfDay(timeZone) {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hour12: false }).format(new Date()),
  );
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
