import mongoose from 'mongoose';
import { DIFFICULTIES, MASTERY, PROGRESS_STATUS, readinessBand } from '../../../shared/constants.js';
import { ExamAttempt } from '../models/ExamAttempt.js';
import { QuestionAttempt } from '../models/QuestionAttempt.js';
import { StudyProgress } from '../models/StudyProgress.js';
import { Subject } from '../models/Subject.js';
import { Topic } from '../models/Topic.js';
import { daysUntil, lastNDateKeys } from '../utils/dates.js';

const { Types } = mongoose;

/**
 * Readiness.
 *
 * Four measured components, weighted by the examination's own configuration
 * rather than by numbers baked into the code:
 *
 *   objectiveAccuracy — how well recent objective questions are answered
 *   syllabusCoverage  — how much of the syllabus has actually been worked
 *   mockPerformance   — results under timed conditions
 *   consistency       — how many of the last fourteen days had study on them
 *
 * A candidate who has answered very little is capped, because a small sample of
 * correct answers is not evidence of readiness.
 */
export async function computeReadiness({ userId, exam }) {
  const weights = exam.readinessWeights || {};
  const w = {
    objectiveAccuracy: weights.objectiveAccuracy ?? 0.4,
    syllabusCoverage: weights.syllabusCoverage ?? 0.25,
    mockPerformance: weights.mockPerformance ?? 0.25,
    consistency: weights.consistency ?? 0.1,
  };

  const uid = new Types.ObjectId(String(userId));
  const eid = new Types.ObjectId(String(exam._id));

  const [recent] = await QuestionAttempt.aggregate([
    { $match: { user: uid, exam: eid } },
    { $sort: { answeredAt: -1 } },
    { $limit: 200 },
    { $group: { _id: null, attempts: { $sum: 1 }, scoreSum: { $sum: '$score' } } },
  ]);
  const attempts = recent?.attempts || 0;
  const objectiveAccuracy = attempts ? recent.scoreSum / attempts : 0;

  const totalTopics = await Topic.countDocuments({ exam: exam._id, isPublished: true });
  const [coverageAgg] = await StudyProgress.aggregate([
    { $match: { user: uid, exam: eid } },
    {
      $group: {
        _id: null,
        touched: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', PROGRESS_STATUS.COMPLETED] }, 1, 0] } },
        masterySum: { $sum: '$mastery' },
      },
    },
  ]);
  const syllabusCoverage = totalTopics ? (coverageAgg?.masterySum || 0) / (totalTopics * 100) : 0;

  const mocks = await ExamAttempt.find({ user: userId, exam: exam._id, status: { $in: ['submitted', 'marked'] } })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('percentage')
    .lean();
  const mockPerformance = mocks.length ? mocks.reduce((s, m) => s + m.percentage, 0) / mocks.length / 100 : 0;

  const days = lastNDateKeys(14);
  const activeDays = await QuestionAttempt.distinct('localDate', {
    user: userId,
    exam: exam._id,
    localDate: { $in: days },
  });
  const consistency = activeDays.length / 14;

  const raw =
    objectiveAccuracy * w.objectiveAccuracy +
    syllabusCoverage * w.syllabusCoverage +
    mockPerformance * w.mockPerformance +
    consistency * w.consistency;

  // Evidence cap: readiness cannot outrun the amount of work done.
  const evidenceCap = Math.min(1, 0.25 + attempts / 150);
  const score = Math.round(Math.min(raw, evidenceCap) * 100);

  return {
    score,
    band: readinessBand(score),
    components: {
      objectiveAccuracy: Math.round(objectiveAccuracy * 100),
      syllabusCoverage: Math.round(syllabusCoverage * 100),
      mockPerformance: Math.round(mockPerformance * 100),
      consistency: Math.round(consistency * 100),
    },
    weights: w,
    evidence: {
      questionsAnswered: attempts,
      topicsTouched: coverageAgg?.touched || 0,
      topicsCompleted: coverageAgg?.completed || 0,
      totalTopics,
      mockExamsTaken: mocks.length,
      activeDaysLast14: activeDays.length,
      capApplied: raw > evidenceCap,
    },
  };
}

/**
 * Turns the numbers into things to actually do next.
 *
 * Recommendations are ordered by urgency and each carries the action the
 * interface should launch, so the dashboard never says "revise doctrine" without
 * a button that starts exactly that.
 */
export async function buildRecommendations({ userId, exam, user, limit = 4 }) {
  const recommendations = [];
  const uid = new Types.ObjectId(String(userId));
  const eid = new Types.ObjectId(String(exam._id));

  const untilExam = daysUntil(user.examDate, user.timezone);

  // 1. Topics with the weakest measured mastery.
  const weak = await StudyProgress.find({ user: userId, exam: exam._id, attempts: { $gte: MASTERY.MIN_ATTEMPTS } })
    .sort({ mastery: 1 })
    .limit(2)
    .populate('topic', 'title slug')
    .populate('subject', 'name shortName slug')
    .lean();

  for (const entry of weak) {
    if (!entry.topic || entry.mastery >= MASTERY.WEAK_ACCURACY * 100) continue;
    recommendations.push({
      kind: 'revise_topic',
      urgency: 'high',
      title: `Revise ${entry.topic.title}`,
      detail: `Your mastery here is ${Math.round(entry.mastery)}%. Read the topic, then take a short quiz on it.`,
      subject: entry.subject?.name,
      action: { type: 'study_topic', topicId: String(entry.topic._id), topicSlug: entry.topic.slug },
      secondaryAction: { type: 'topic_quiz', topicId: String(entry.topic._id), size: 10 },
    });
  }

  // 2. Repeatedly missed questions, grouped by the topic they belong to.
  const missed = await QuestionAttempt.aggregate([
    { $match: { user: uid, exam: eid, isCorrect: false, topic: { $ne: null } } },
    { $group: { _id: '$topic', misses: { $sum: 1 } } },
    { $sort: { misses: -1 } },
    { $limit: 1 },
    { $lookup: { from: 'topics', localField: '_id', foreignField: '_id', as: 'topic' } },
    { $unwind: '$topic' },
  ]);
  if (missed.length && missed[0].misses >= 3) {
    const { topic, misses } = missed[0];
    recommendations.push({
      kind: 'practise_mistakes',
      urgency: 'high',
      title: `You have missed ${misses} questions on ${topic.title}`,
      detail: 'Work through them again with the explanations open.',
      action: { type: 'mistakes_quiz', topicId: String(topic._id), size: Math.min(15, misses) },
    });
  }

  // 3. The next untouched part of the syllabus, in syllabus order.
  const touched = await StudyProgress.distinct('topic', { user: userId, exam: exam._id });
  const nextTopic = await Topic.findOne({ exam: exam._id, isPublished: true, _id: { $nin: touched } })
    .sort({ subject: 1, order: 1 })
    .populate('subject', 'name shortName slug order')
    .lean();
  if (nextTopic) {
    recommendations.push({
      kind: 'new_topic',
      urgency: 'medium',
      title: `Start ${nextTopic.title}`,
      detail: `Next in ${nextTopic.subject?.name}. About ${nextTopic.estimatedMinutes || 5} minutes of reading.`,
      subject: nextTopic.subject?.name,
      action: { type: 'study_topic', topicId: String(nextTopic._id), topicSlug: nextTopic.slug },
    });
  }

  // 4. Timed practice, weighted up as the examination approaches.
  const mockCount = await ExamAttempt.countDocuments({ user: userId, exam: exam._id, status: { $in: ['submitted', 'marked'] } });
  if (mockCount === 0) {
    recommendations.push({
      kind: 'take_mock',
      urgency: untilExam !== null && untilExam <= 30 ? 'high' : 'medium',
      title: 'Sit a mock examination',
      detail: 'A timed paper shows you where you really stand, and where time runs short.',
      action: { type: 'mock_exam' },
    });
  } else if (untilExam !== null && untilExam <= 21) {
    recommendations.push({
      kind: 'take_mock',
      urgency: 'high',
      title: `${untilExam} days to your examination — sit another mock`,
      detail: 'Under timed conditions, on a paper you have not seen.',
      action: { type: 'mock_exam' },
    });
  }

  // 5. Daily revision, always available but only surfaced when there is a backlog.
  const dueCount = await QuestionAttempt.countDocuments({ user: userId, exam: exam._id, isCorrect: false });
  if (dueCount >= 5) {
    recommendations.push({
      kind: 'daily_revision',
      urgency: 'medium',
      title: "Today's revision set",
      detail: 'A mix of questions you have missed, weak areas, and a few new ones.',
      action: { type: 'daily_revision', size: 10 },
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return recommendations.sort((a, b) => order[a.urgency] - order[b.urgency]).slice(0, limit);
}

/**
 * Chooses the difficulty band for the next question in an adaptive session.
 * Sustained success moves the candidate up; a run of errors eases off, because
 * a candidate who is failing needs consolidation, not punishment.
 */
export function nextDifficulty(recentScores = [], current = DIFFICULTIES.MEDIUM) {
  const window = recentScores.slice(-5);
  if (window.length < 3) return current;
  const mean = window.reduce((a, b) => a + b, 0) / window.length;

  if (mean >= 0.85) {
    if (current === DIFFICULTIES.EASY) return DIFFICULTIES.MEDIUM;
    if (current === DIFFICULTIES.MEDIUM) return DIFFICULTIES.HARD;
    return DIFFICULTIES.HARD;
  }
  if (mean <= 0.4) {
    if (current === DIFFICULTIES.HARD) return DIFFICULTIES.MEDIUM;
    if (current === DIFFICULTIES.MEDIUM) return DIFFICULTIES.EASY;
    return DIFFICULTIES.EASY;
  }
  return current;
}

/** A short plain-language summary of where the candidate stands. */
export async function performanceNarrative({ userId, exam }) {
  const rows = await StudyProgress.aggregate([
    { $match: { user: new Types.ObjectId(String(userId)), exam: new Types.ObjectId(String(exam._id)), attempts: { $gte: MASTERY.MIN_ATTEMPTS } } },
    { $group: { _id: '$subject', mastery: { $avg: '$mastery' }, attempts: { $sum: '$attempts' } } },
    { $sort: { mastery: -1 } },
  ]);
  if (rows.length < 2) return null;

  const subjects = await Subject.find({ _id: { $in: rows.map((r) => r._id) } })
    .select('name shortName')
    .lean();
  const nameFor = (id) => subjects.find((s) => String(s._id) === String(id))?.shortName ||
    subjects.find((s) => String(s._id) === String(id))?.name;

  const best = rows[0];
  const worst = rows[rows.length - 1];
  if (Math.round(best.mastery) - Math.round(worst.mastery) < 10) return null;

  return {
    strongest: { subject: nameFor(best._id), mastery: Math.round(best.mastery) },
    weakest: { subject: nameFor(worst._id), mastery: Math.round(worst.mastery) },
    sentence: `You're strong in ${nameFor(best._id)} but struggling with ${nameFor(worst._id)}.`,
  };
}
