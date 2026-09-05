import { ANSWER_CONFIDENCE, CONTENT_STATUS, ROLES } from '../../../shared/constants.js';
import { AdminActivity } from '../models/AdminActivity.js';
import { Chapter } from '../models/Chapter.js';
import { Exam } from '../models/Exam.js';
import { ExamAttempt } from '../models/ExamAttempt.js';
import { MockExam } from '../models/MockExam.js';
import { Note } from '../models/Note.js';
import { Question } from '../models/Question.js';
import { QuestionAttempt } from '../models/QuestionAttempt.js';
import { StudyProgress } from '../models/StudyProgress.js';
import { Subject } from '../models/Subject.js';
import { Topic } from '../models/Topic.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, created, noContent, ok, pageMeta, pagination } from '../utils/http.js';
import { adminOverview, hardestQuestions, hardestTopics, popularTopics } from '../services/analyticsService.js';
import { importQuestions } from '../services/importService.js';
import { slugify } from '../utils/text.js';

async function audit(req, action, entityType, entityId, summary, changes = null) {
  try {
    await AdminActivity.create({
      actor: req.user._id,
      actorName: req.user.name,
      action,
      entityType,
      entityId: String(entityId || ''),
      summary,
      changes,
      ip: req.ip,
    });
  } catch {
    /* Auditing must never block the operation it records. */
  }
}

/* ------------------------------------------------------------- analytics --- */

export const overview = asyncHandler(async (req, res) => {
  const examId = req.query.exam || null;
  const days = Number(req.query.days) || 30;

  const [stats, hardQuestions, hardTopics, popular, contentCounts, recentUsers, recentActivity] = await Promise.all([
    adminOverview({ examId, days }),
    hardestQuestions({ examId, limit: 10 }),
    hardestTopics({ examId, limit: 10 }),
    popularTopics({ examId, limit: 10 }),
    contentSummary(examId),
    User.find(examId ? { examStage: examId } : {})
      .sort({ createdAt: -1 })
      .limit(8)
      .select('name email createdAt examStage lastActiveAt')
      .populate('examStage', 'code shortName name')
      .lean(),
    AdminActivity.find().sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  return ok(res, {
    ...stats,
    content: contentCounts,
    hardestQuestions: hardQuestions,
    hardestTopics: hardTopics,
    popularTopics: popular,
    recentRegistrations: recentUsers,
    recentAdminActivity: recentActivity,
  });
});

async function contentSummary(examId) {
  const filter = examId ? { exam: examId } : {};
  const [subjects, chapters, topics, questions, byStatus, byConfidence, mocks] = await Promise.all([
    Subject.countDocuments(filter),
    Chapter.countDocuments(filter),
    Topic.countDocuments(filter),
    Question.countDocuments(filter),
    Question.aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Question.aggregate([{ $match: filter }, { $group: { _id: '$answerConfidence', count: { $sum: 1 } } }]),
    MockExam.countDocuments(filter),
  ]);

  return {
    subjects,
    chapters,
    topics,
    questions,
    mockExams: mocks,
    questionsByStatus: Object.fromEntries(byStatus.map((r) => [r._id, r.count])),
    questionsByConfidence: Object.fromEntries(byConfidence.map((r) => [r._id, r.count])),
    needsReview: byConfidence.find((r) => r._id === ANSWER_CONFIDENCE.UNVERIFIED)?.count || 0,
  };
}

/* ------------------------------------------------------------------ users --- */

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = {};
  if (req.query.exam) filter.examStage = req.query.exam;
  if (req.query.role) filter.role = req.query.role;
  if (req.query.active !== undefined) filter.isActive = req.query.active;
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { diocese: rx }, { circuit: rx }];
  }

  const [rows, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('examStage', 'code shortName name').lean(),
    User.countDocuments(filter),
  ]);

  const ids = rows.map((r) => r._id);
  const activity = await QuestionAttempt.aggregate([
    { $match: { user: { $in: ids } } },
    { $group: { _id: '$user', attempts: { $sum: 1 }, scoreSum: { $sum: '$score' } } },
  ]);
  const byUser = new Map(activity.map((a) => [String(a._id), a]));

  return ok(
    res,
    {
      users: rows.map((u) => {
        const a = byUser.get(String(u._id));
        return {
          ...u,
          activity: {
            questionsAnswered: a?.attempts || 0,
            accuracy: a?.attempts ? a.scoreSum / a.attempts : 0,
          },
        };
      }),
    },
    pageMeta({ page, limit }, total),
  );
});

export const getUserDetail = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate('examStage', 'code name shortName').lean();
  if (!user) throw ApiError.notFound('That user was not found.');

  const [attempts, mocks, progress] = await Promise.all([
    QuestionAttempt.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: null, attempts: { $sum: 1 }, scoreSum: { $sum: '$score' }, seconds: { $sum: '$timeSpentSeconds' } } },
    ]),
    ExamAttempt.find({ user: user._id, status: 'marked' })
      .sort({ submittedAt: -1 })
      .limit(10)
      .select('title percentage submittedAt')
      .lean(),
    StudyProgress.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: '$subject', topics: { $sum: 1 }, mastery: { $avg: '$mastery' } } },
      { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subject' } },
      { $unwind: '$subject' },
      { $project: { _id: 0, subject: '$subject.shortName', topics: 1, mastery: 1 } },
    ]),
  ]);

  const totals = attempts[0];
  return ok(res, {
    user,
    stats: {
      questionsAnswered: totals?.attempts || 0,
      accuracy: totals?.attempts ? totals.scoreSum / totals.attempts : 0,
      studyMinutes: Math.round((totals?.seconds || 0) / 60),
      mockExams: mocks.length,
    },
    mockExams: mocks,
    subjectProgress: progress,
  });
});

export const updateUser = asyncHandler(async (req, res) => {
  const allowed = {};
  if (req.body.role && Object.values(ROLES).includes(req.body.role)) allowed.role = req.body.role;
  if (req.body.isActive !== undefined) allowed.isActive = Boolean(req.body.isActive);

  if (String(req.params.id) === String(req.user._id) && allowed.role && allowed.role !== ROLES.ADMIN) {
    throw ApiError.badRequest('You cannot remove your own administrator role.');
  }

  const user = await User.findByIdAndUpdate(req.params.id, allowed, { new: true });
  if (!user) throw ApiError.notFound('That user was not found.');

  await audit(req, 'update', 'User', user._id, `Updated ${user.email}`, allowed);
  return ok(res, { user });
});

/* -------------------------------------------------------------- questions --- */

export const listAdminQuestions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query, { defaultLimit: 25 });
  const filter = {};
  for (const key of ['exam', 'subject', 'chapter', 'topic', 'type', 'difficulty', 'status', 'sourceKind', 'answerConfidence']) {
    if (req.query[key]) filter[key] = req.query[key];
  }
  if (req.query.year) filter['source.year'] = req.query.year;
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ prompt: rx }, { questionId: rx }, { tags: rx }];
  }

  const sort = req.query.sort === 'oldest' ? { createdAt: 1 } : req.query.sort === 'hardest' ? { 'stats.accuracy': 1 } : { createdAt: -1 };

  const [rows, total] = await Promise.all([
    Question.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('subject', 'shortName name code')
      .populate('chapter', 'title number')
      .populate('topic', 'title number')
      .lean(),
    Question.countDocuments(filter),
  ]);

  return ok(res, { questions: rows }, pageMeta({ page, limit }, total));
});

export const getAdminQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findById(req.params.id)
    .populate('subject', 'shortName name')
    .populate('chapter', 'title number')
    .populate('topic', 'title number')
    .lean();
  if (!question) throw ApiError.notFound('That question was not found.');
  return ok(res, { question });
});

export const createQuestion = asyncHandler(async (req, res) => {
  const payload = { ...req.body, createdBy: req.user._id, updatedBy: req.user._id };
  payload.questionId = payload.questionId || (await nextQuestionId(payload));
  normaliseKeys(payload);

  const question = await Question.create(payload);
  await refreshCounts(question);
  await audit(req, 'create', 'Question', question._id, `Created question ${question.questionId}`);
  return created(res, { question });
});

export const updateQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findById(req.params.id);
  if (!question) throw ApiError.notFound('That question was not found.');

  const payload = { ...req.body, updatedBy: req.user._id };
  normaliseKeys(payload);
  Object.assign(question, payload);
  await question.save();
  await refreshCounts(question);

  await audit(req, 'update', 'Question', question._id, `Updated question ${question.questionId}`, Object.keys(req.body));
  return ok(res, { question });
});

export const setQuestionStatus = asyncHandler(async (req, res) => {
  const question = await Question.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status, updatedBy: req.user._id },
    { new: true },
  );
  if (!question) throw ApiError.notFound('That question was not found.');
  await refreshCounts(question);
  await audit(req, 'publish', 'Question', question._id, `Set ${question.questionId} to ${req.body.status}`);
  return ok(res, { question });
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findById(req.params.id);
  if (!question) throw ApiError.notFound('That question was not found.');

  const used = await QuestionAttempt.countDocuments({ question: question._id });
  if (used > 0) {
    // Attempt history would be orphaned; archive instead of destroying data.
    question.status = CONTENT_STATUS.ARCHIVED;
    await question.save();
    await audit(req, 'update', 'Question', question._id, `Archived ${question.questionId} (has ${used} attempts)`);
    return ok(res, { question, archivedInsteadOfDeleted: true, attempts: used });
  }

  await question.deleteOne();
  await audit(req, 'delete', 'Question', question._id, `Deleted question ${question.questionId}`);
  return noContent(res);
});

/** Keeps `correctOptionKeys` and the option flags in step, whichever was set. */
function normaliseKeys(payload) {
  if (!payload.options?.length) return;
  if (payload.correctOptionKeys?.length) {
    const keys = new Set(payload.correctOptionKeys.map((k) => String(k).toUpperCase()));
    payload.options = payload.options.map((o) => ({ ...o, isCorrect: keys.has(String(o.key).toUpperCase()) }));
  } else {
    payload.correctOptionKeys = payload.options.filter((o) => o.isCorrect).map((o) => o.key);
  }
}

async function nextQuestionId(payload) {
  const subject = await Subject.findById(payload.subject).select('code').lean();
  const prefix = `${subject?.code || 'GEN'}-${payload.type === 'theory' ? 'T' : 'O'}`;
  const count = await Question.countDocuments({ questionId: new RegExp(`^${prefix}-`) });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

async function refreshCounts(question) {
  const published = { status: CONTENT_STATUS.PUBLISHED };
  await Promise.all([
    question.topic
      ? Topic.updateOne({ _id: question.topic }, { 'stats.questionCount': await Question.countDocuments({ topic: question.topic, ...published }) })
      : Promise.resolve(),
    question.chapter
      ? Chapter.updateOne({ _id: question.chapter }, { 'stats.questionCount': await Question.countDocuments({ chapter: question.chapter, ...published }) })
      : Promise.resolve(),
    Subject.updateOne({ _id: question.subject }, { 'stats.questionCount': await Question.countDocuments({ subject: question.subject, ...published }) }),
  ]);
}

/* ------------------------------------------------------- subjects/topics --- */

export const createSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.create({ ...req.body, slug: slugify(req.body.name) });
  await audit(req, 'create', 'Subject', subject._id, `Created subject ${subject.name}`);
  return created(res, { subject });
});

export const updateSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!subject) throw ApiError.notFound('That subject was not found.');
  await audit(req, 'update', 'Subject', subject._id, `Updated subject ${subject.name}`);
  return ok(res, { subject });
});

export const createTopic = asyncHandler(async (req, res) => {
  const topic = await Topic.create({ ...req.body, slug: slugify(`${req.body.number || ''}-${req.body.title}`) });
  await Chapter.updateOne({ _id: topic.chapter }, { 'stats.topicCount': await Topic.countDocuments({ chapter: topic.chapter }) });
  await audit(req, 'create', 'Topic', topic._id, `Created topic ${topic.title}`);
  return created(res, { topic });
});

export const updateTopic = asyncHandler(async (req, res) => {
  const topic = await Topic.findById(req.params.id);
  if (!topic) throw ApiError.notFound('That topic was not found.');
  Object.assign(topic, req.body);
  await topic.save();
  await audit(req, 'update', 'Topic', topic._id, `Updated topic ${topic.title}`);
  return ok(res, { topic });
});

/* ------------------------------------------------------------ mock exams --- */

export const listAdminMockExams = asyncHandler(async (req, res) => {
  const filter = req.query.exam ? { exam: req.query.exam } : {};
  const mocks = await MockExam.find(filter).sort({ order: 1 }).populate('subject', 'shortName name').lean();
  return ok(res, { mockExams: mocks });
});

export const createMockExam = asyncHandler(async (req, res) => {
  const totalMarks = req.body.sections.reduce(
    (sum, s) => sum + (s.answerCount ?? s.count) * (s.marksEach ?? 1),
    0,
  );
  const mock = await MockExam.create({ ...req.body, totalMarks, createdBy: req.user._id });
  await audit(req, 'create', 'MockExam', mock._id, `Created mock exam ${mock.title}`);
  return created(res, { mockExam: mock });
});

export const updateMockExam = asyncHandler(async (req, res) => {
  const update = { ...req.body };
  if (update.sections) {
    update.totalMarks = update.sections.reduce((sum, s) => sum + (s.answerCount ?? s.count) * (s.marksEach ?? 1), 0);
  }
  const mock = await MockExam.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!mock) throw ApiError.notFound('That mock examination was not found.');
  await audit(req, 'update', 'MockExam', mock._id, `Updated mock exam ${mock.title}`);
  return ok(res, { mockExam: mock });
});

export const deleteMockExam = asyncHandler(async (req, res) => {
  const used = await ExamAttempt.countDocuments({ mockExam: req.params.id });
  if (used > 0) {
    const mock = await MockExam.findByIdAndUpdate(req.params.id, { status: CONTENT_STATUS.ARCHIVED }, { new: true });
    return ok(res, { mockExam: mock, archivedInsteadOfDeleted: true, attempts: used });
  }
  const result = await MockExam.deleteOne({ _id: req.params.id });
  if (!result.deletedCount) throw ApiError.notFound('That mock examination was not found.');
  await audit(req, 'delete', 'MockExam', req.params.id, 'Deleted mock exam');
  return noContent(res);
});

/* ---------------------------------------------------------------- import --- */

export const importContent = asyncHandler(async (req, res) => {
  const result = await importQuestions({
    rows: req.body.questions,
    dryRun: req.body.dryRun,
    defaultStatus: req.body.defaultStatus,
    actorId: req.user._id,
  });
  if (!req.body.dryRun) {
    await audit(req, 'import', 'Question', '', `Imported ${result.created} created, ${result.updated} updated`, {
      errors: result.errors.length,
    });
  }
  return ok(res, result);
});

/* ---------------------------------------------------------- shared notes --- */

export const publishNote = asyncHandler(async (req, res) => {
  const note = await Note.findByIdAndUpdate(
    req.params.id,
    { visibility: req.body.visibility === 'shared' ? 'shared' : 'private', publishedBy: req.user._id },
    { new: true },
  );
  if (!note) throw ApiError.notFound('That note was not found.');
  await audit(req, 'publish', 'Note', note._id, `Set note visibility to ${note.visibility}`);
  return ok(res, { note });
});

export const listActivity = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query, { defaultLimit: 30 });
  const [rows, total] = await Promise.all([
    AdminActivity.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AdminActivity.countDocuments(),
  ]);
  return ok(res, { activity: rows }, pageMeta({ page, limit }, total));
});

export const listExamsAdmin = asyncHandler(async (_req, res) => {
  const exams = await Exam.find().sort({ order: 1 }).lean();
  return ok(res, { exams });
});
