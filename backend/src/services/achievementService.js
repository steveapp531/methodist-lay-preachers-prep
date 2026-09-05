import { ACHIEVEMENT_CODES, PROGRESS_STATUS } from '../../../shared/constants.js';
import { Achievement, ACHIEVEMENT_CATALOGUE } from '../models/Achievement.js';
import { ExamAttempt } from '../models/ExamAttempt.js';
import { QuestionAttempt } from '../models/QuestionAttempt.js';
import { StudyProgress } from '../models/StudyProgress.js';
import { Chapter } from '../models/Chapter.js';
import { Subject } from '../models/Subject.js';
import { logger } from '../config/logger.js';

const CATALOGUE = new Map(ACHIEVEMENT_CATALOGUE.map((a) => [a.code, a]));

/**
 * Checks every milestone and awards any that have just been met.
 *
 * Awarding is idempotent: a unique index on (user, code, context) means a
 * repeated check cannot produce duplicates, so this can be called freely after
 * any activity.
 */
export async function checkAchievements({ user, examId, readinessScore = null }) {
  const earned = [];
  const award = async (code, context = '') => {
    const definition = CATALOGUE.get(code);
    if (!definition) return;
    try {
      const doc = await Achievement.create({
        user: user._id,
        exam: examId || null,
        code,
        title: definition.title,
        description: definition.description,
        icon: definition.icon,
        points: definition.points,
        context,
      });
      earned.push(doc.toObject());
    } catch (err) {
      if (err?.code !== 11000) logger.warn(`Could not award achievement ${code}`, err);
    }
  };

  const held = new Set((await Achievement.find({ user: user._id }).select('code context').lean()).map((a) => `${a.code}::${a.context}`));
  const has = (code, context = '') => held.has(`${code}::${context}`);

  const answered = await QuestionAttempt.countDocuments({ user: user._id });
  if (answered >= 1 && !has(ACHIEVEMENT_CODES.FIRST_QUIZ)) await award(ACHIEVEMENT_CODES.FIRST_QUIZ);
  if (answered >= 100 && !has(ACHIEVEMENT_CODES.HUNDRED_QUESTIONS)) await award(ACHIEVEMENT_CODES.HUNDRED_QUESTIONS);

  const streak = user.streak?.current || 0;
  if (streak >= 7 && !has(ACHIEVEMENT_CODES.STREAK_7)) await award(ACHIEVEMENT_CODES.STREAK_7);
  if (streak >= 30 && !has(ACHIEVEMENT_CODES.STREAK_30)) await award(ACHIEVEMENT_CODES.STREAK_30);

  const theory = await QuestionAttempt.countDocuments({ user: user._id, questionType: 'theory' });
  if (theory >= 1 && !has(ACHIEVEMENT_CODES.THEORY_FIRST)) await award(ACHIEVEMENT_CODES.THEORY_FIRST);

  const mocks = await ExamAttempt.countDocuments({ user: user._id, status: 'marked' });
  if (mocks >= 1 && !has(ACHIEVEMENT_CODES.MOCK_COMPLETED)) await award(ACHIEVEMENT_CODES.MOCK_COMPLETED);

  // Accuracy over the last fifty answers, not lifetime, so it reflects form.
  if (answered >= 50 && !has(ACHIEVEMENT_CODES.ACCURACY_80)) {
    const recent = await QuestionAttempt.find({ user: user._id }).sort({ answeredAt: -1 }).limit(50).select('score').lean();
    const mean = recent.reduce((s, a) => s + a.score, 0) / recent.length;
    if (mean >= 0.8) await award(ACHIEVEMENT_CODES.ACCURACY_80);
  }

  await checkChapterMastery({ user, has, award });
  await checkSubjectCompletion({ user, has, award });

  if (readinessScore != null && readinessScore >= 78 && !has(ACHIEVEMENT_CODES.EXAM_READY)) {
    await award(ACHIEVEMENT_CODES.EXAM_READY);
  }

  return earned;
}

async function checkChapterMastery({ user, has, award }) {
  const rows = await StudyProgress.aggregate([
    { $match: { user: user._id } },
    { $group: { _id: '$chapter', topics: { $sum: 1 }, mastered: { $sum: { $cond: [{ $gte: ['$mastery', 80] }, 1, 0] } } } },
    { $match: { $expr: { $eq: ['$topics', '$mastered'] } } },
  ]);
  if (!rows.length) return;

  const chapters = await Chapter.find({ _id: { $in: rows.map((r) => r._id) } }).select('title stats.topicCount').lean();
  for (const chapter of chapters) {
    const row = rows.find((r) => String(r._id) === String(chapter._id));
    // Require the whole chapter, not just the topics that happen to be touched.
    if (!row || row.topics < (chapter.stats?.topicCount || row.topics)) continue;
    if (has(ACHIEVEMENT_CODES.CHAPTER_MASTERED, chapter.title)) continue;
    await award(ACHIEVEMENT_CODES.CHAPTER_MASTERED, chapter.title);
  }
}

async function checkSubjectCompletion({ user, has, award }) {
  const rows = await StudyProgress.aggregate([
    { $match: { user: user._id, status: PROGRESS_STATUS.COMPLETED } },
    { $group: { _id: '$subject', completed: { $sum: 1 } } },
  ]);
  if (!rows.length) return;

  const subjects = await Subject.find({ _id: { $in: rows.map((r) => r._id) } }).select('name stats.topicCount').lean();
  for (const subject of subjects) {
    const row = rows.find((r) => String(r._id) === String(subject._id));
    const total = subject.stats?.topicCount || 0;
    if (!row || !total || row.completed < total) continue;
    if (has(ACHIEVEMENT_CODES.SUBJECT_COMPLETE, subject.name)) continue;
    await award(ACHIEVEMENT_CODES.SUBJECT_COMPLETE, subject.name);
  }
}

/** Everything earned, plus what is still outstanding, for the profile page. */
export async function achievementBoard(userId) {
  const earned = await Achievement.find({ user: userId }).sort({ earnedAt: -1 }).lean();
  const earnedCodes = new Set(earned.map((a) => a.code));
  const locked = ACHIEVEMENT_CATALOGUE.filter((a) => !earnedCodes.has(a.code));
  return {
    earned,
    locked,
    points: earned.reduce((s, a) => s + (a.points || 0), 0),
    total: ACHIEVEMENT_CATALOGUE.length,
  };
}
