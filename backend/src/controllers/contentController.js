import { CONTENT_STATUS, PROGRESS_STATUS } from '../../../shared/constants.js';
import { Chapter } from '../models/Chapter.js';
import { Exam } from '../models/Exam.js';
import { Flashcard } from '../models/Flashcard.js';
import { Question } from '../models/Question.js';
import { ScriptureReference } from '../models/ScriptureReference.js';
import { StudyProgress } from '../models/StudyProgress.js';
import { Subject } from '../models/Subject.js';
import { Topic } from '../models/Topic.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, ok, pageMeta, pagination } from '../utils/http.js';
import { recalculateTopicProgress, recordStudyTime, touchActivity } from '../services/progressService.js';

/** Falls back to the signed-in candidate's own stage when none is given. */
function examScope(req) {
  const id = req.query?.exam || req.user?.examStage;
  if (!id) throw ApiError.badRequest('Choose an examination first.');
  return id;
}

export const listExams = asyncHandler(async (_req, res) => {
  const exams = await Exam.find({ isPublished: true }).sort({ order: 1, code: 1 }).lean();
  return ok(res, { exams });
});

export const getExam = asyncHandler(async (req, res) => {
  const exam = await Exam.findById(req.params.id).lean();
  if (!exam) throw ApiError.notFound('That examination was not found.');
  const subjects = await Subject.find({ exam: exam._id, isPublished: true }).sort({ order: 1 }).lean();
  return ok(res, { exam, subjects });
});

export const listSubjects = asyncHandler(async (req, res) => {
  const exam = examScope(req);
  const subjects = await Subject.find({ exam, isPublished: true }).sort({ order: 1 }).lean();

  if (!req.user) return ok(res, { subjects });

  // Attach the candidate's own progress so the list is immediately useful.
  const progress = await StudyProgress.aggregate([
    { $match: { user: req.user._id, exam: subjects[0]?.exam } },
    {
      $group: {
        _id: '$subject',
        touched: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', PROGRESS_STATUS.COMPLETED] }, 1, 0] } },
        needsRevision: { $sum: { $cond: [{ $eq: ['$status', PROGRESS_STATUS.NEEDS_REVISION] }, 1, 0] } },
        masterySum: { $sum: '$mastery' },
      },
    },
  ]);
  const byId = new Map(progress.map((p) => [String(p._id), p]));

  return ok(res, {
    subjects: subjects.map((s) => {
      const p = byId.get(String(s._id));
      const total = s.stats?.topicCount || 0;
      return {
        ...s,
        progress: {
          topicsTouched: p?.touched || 0,
          topicsCompleted: p?.completed || 0,
          topicsNeedingRevision: p?.needsRevision || 0,
          totalTopics: total,
          percentComplete: total ? Math.round(((p?.completed || 0) / total) * 100) : 0,
          mastery: p?.touched ? Math.round(p.masterySum / p.touched) : 0,
        },
      };
    }),
  });
});

export const getSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findById(req.params.id).lean();
  if (!subject) throw ApiError.notFound('That subject was not found.');

  const chapters = await Chapter.find({ subject: subject._id, isPublished: true }).sort({ order: 1 }).lean();
  const topics = await Topic.find({ subject: subject._id, isPublished: true })
    .sort({ order: 1 })
    .select('_id title number slug chapter order estimatedMinutes wordCount stats')
    .lean();

  const progressByTopic = req.user
    ? new Map(
        (await StudyProgress.find({ user: req.user._id, subject: subject._id }).lean()).map((p) => [String(p.topic), p]),
      )
    : new Map();

  const withTopics = chapters.map((chapter) => ({
    ...chapter,
    topics: topics
      .filter((t) => String(t.chapter) === String(chapter._id))
      .map((t) => {
        const p = progressByTopic.get(String(t._id));
        return {
          ...t,
          progress: p
            ? { status: p.status, mastery: p.mastery, accuracy: p.accuracy, attempts: p.attempts }
            : { status: PROGRESS_STATUS.NOT_STARTED, mastery: 0, accuracy: 0, attempts: 0 },
        };
      }),
  }));

  return ok(res, { subject, chapters: withTopics });
});

export const getTopic = asyncHandler(async (req, res) => {
  const topic = await Topic.findById(req.params.id)
    .populate('subject', 'name shortName code slug colour')
    .populate('chapter', 'title number slug order')
    .lean();
  if (!topic) throw ApiError.notFound('That topic was not found.');

  const [questionCount, flashcards, progress, neighbours] = await Promise.all([
    Question.countDocuments({ topic: topic._id, status: CONTENT_STATUS.PUBLISHED }),
    Flashcard.find({ topic: topic._id, status: CONTENT_STATUS.PUBLISHED }).limit(50).lean(),
    req.user ? StudyProgress.findOne({ user: req.user._id, topic: topic._id }).lean() : null,
    Topic.find({ chapter: topic.chapter, isPublished: true }).sort({ order: 1 }).select('_id title order').lean(),
  ]);

  const index = neighbours.findIndex((t) => String(t._id) === String(topic._id));

  return ok(res, {
    topic: { ...topic, questionCount, flashcardCount: flashcards.length },
    flashcards,
    progress: progress || { status: PROGRESS_STATUS.NOT_STARTED, mastery: 0, accuracy: 0, attempts: 0 },
    navigation: {
      previous: index > 0 ? neighbours[index - 1] : null,
      next: index >= 0 && index < neighbours.length - 1 ? neighbours[index + 1] : null,
    },
  });
});

/** Marks a topic and/or banks reading time against it. */
export const updateTopicProgress = asyncHandler(async (req, res) => {
  const topic = await Topic.findById(req.params.id).select('exam subject chapter').lean();
  if (!topic) throw ApiError.notFound('That topic was not found.');

  const { status, studySeconds } = req.body;

  if (studySeconds) await recordStudyTime({ userId: req.user._id, topicId: topic._id, seconds: studySeconds });

  if (status) {
    await StudyProgress.findOneAndUpdate(
      { user: req.user._id, topic: topic._id },
      {
        $setOnInsert: { exam: topic.exam, subject: topic.subject, chapter: topic.chapter },
        $set: {
          status,
          completedAt: status === PROGRESS_STATUS.COMPLETED ? new Date() : null,
          lastStudiedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  await touchActivity(req.user);
  const progress = await recalculateTopicProgress({ userId: req.user._id, topicId: topic._id });
  return ok(res, { progress });
});

export const listQuestions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { exam: examScope(req), status: CONTENT_STATUS.PUBLISHED };
  for (const key of ['subject', 'chapter', 'topic', 'type', 'difficulty', 'sourceKind']) {
    if (req.query[key]) filter[key] = req.query[key];
  }
  if (req.query.year) filter['source.year'] = req.query.year;
  if (req.query.search) filter.$text = { $search: req.query.search };

  const [rows, total] = await Promise.all([
    Question.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Question.countDocuments(filter),
  ]);

  return ok(res, { questions: rows.map((q) => q.toCandidateJSON()) }, pageMeta({ page, limit }, total));
});

/** A single question. The answer is only included once it has been attempted. */
export const getQuestion = asyncHandler(async (req, res) => {
  const question = await Question.findOne({ _id: req.params.id, status: CONTENT_STATUS.PUBLISHED })
    .populate('subject', 'name shortName code')
    .populate('topic', 'title slug');
  if (!question) throw ApiError.notFound('That question was not found.');

  const { QuestionAttempt } = await import('../models/QuestionAttempt.js');
  const attempted = req.user
    ? await QuestionAttempt.exists({ user: req.user._id, question: question._id })
    : false;

  return ok(res, {
    question: attempted ? question.toReviewJSON() : question.toCandidateJSON(),
    revealed: Boolean(attempted),
  });
});

export const listScriptures = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const filter = { exam: examScope(req) };
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ reference: rx }, { book: rx }];
  }

  const [rows, total] = await Promise.all([
    ScriptureReference.find(filter).sort({ bookOrder: 1, chapter: 1 }).skip(skip).limit(limit).lean(),
    ScriptureReference.countDocuments(filter),
  ]);

  return ok(res, { scriptures: rows }, pageMeta({ page, limit }, total));
});

export const getScripture = asyncHandler(async (req, res) => {
  const reference = decodeURIComponent(req.params.reference);
  const scripture = await ScriptureReference.findOne({ exam: examScope(req), reference })
    .populate('citedIn.topic', 'title slug')
    .populate('citedIn.subject', 'name shortName')
    .lean();
  if (!scripture) throw ApiError.notFound(`No syllabus reference to ${reference} was found.`);

  const questions = await Question.find({
    exam: scripture.exam,
    status: CONTENT_STATUS.PUBLISHED,
    'scriptureReferences.reference': reference,
  })
    .limit(20)
    .select('questionId prompt type topic subject')
    .populate('topic', 'title')
    .lean();

  return ok(res, { scripture, questions });
});
