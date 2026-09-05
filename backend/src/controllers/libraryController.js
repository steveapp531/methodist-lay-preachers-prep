import { CONTENT_STATUS, LEITNER_INTERVALS } from '../../../shared/constants.js';
import { Bookmark } from '../models/Bookmark.js';
import { Flashcard, FlashcardState } from '../models/Flashcard.js';
import { Note } from '../models/Note.js';
import { Question } from '../models/Question.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler, created, noContent, ok, pageMeta, pagination } from '../utils/http.js';
import { globalSearch } from '../services/searchService.js';

const DAY_MS = 86400000;

/* ------------------------------------------------------------- bookmarks --- */

export const listBookmarks = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { user: req.user._id };
  if (req.query.targetType) filter.targetType = req.query.targetType;

  const [rows, total] = await Promise.all([
    Bookmark.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'question', populate: [{ path: 'subject', select: 'shortName name' }, { path: 'topic', select: 'title' }] })
      .populate('topic', 'title slug subject')
      .populate('flashcard')
      .lean(),
    Bookmark.countDocuments(filter),
  ]);

  return ok(res, { bookmarks: rows }, pageMeta({ page, limit }, total));
});

export const createBookmark = asyncHandler(async (req, res) => {
  const payload = { user: req.user._id, ...req.body };
  try {
    const bookmark = await Bookmark.create(payload);
    return created(res, { bookmark });
  } catch (err) {
    if (err?.code === 11000) {
      const existing = await Bookmark.findOne({
        user: req.user._id,
        [req.body.targetType]: req.body[req.body.targetType],
      });
      return ok(res, { bookmark: existing, alreadyExisted: true });
    }
    throw err;
  }
});

export const deleteBookmark = asyncHandler(async (req, res) => {
  const result = await Bookmark.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!result.deletedCount) throw ApiError.notFound('That bookmark was not found.');
  return noContent(res);
});

/** Convenience for the quiz UI: toggles a question bookmark by question id. */
export const toggleQuestionBookmark = asyncHandler(async (req, res) => {
  const existing = await Bookmark.findOne({ user: req.user._id, question: req.params.id });
  if (existing) {
    await existing.deleteOne();
    return ok(res, { bookmarked: false });
  }
  if (!(await Question.exists({ _id: req.params.id }))) throw ApiError.notFound('That question was not found.');
  await Bookmark.create({ user: req.user._id, targetType: 'question', question: req.params.id });
  return ok(res, { bookmarked: true });
});

/* ------------------------------------------------------------------ notes --- */

export const listNotes = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = { $or: [{ user: req.user._id }, { visibility: 'shared' }] };
  if (req.query.topic) filter.topic = req.query.topic;
  if (req.query.question) filter.question = req.query.question;

  const [rows, total] = await Promise.all([
    Note.find(filter)
      .sort({ pinned: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('topic', 'title slug')
      .populate('question', 'prompt questionId')
      .lean(),
    Note.countDocuments(filter),
  ]);

  return ok(res, { notes: rows.map((n) => ({ ...n, isOwn: String(n.user) === String(req.user._id) })) }, pageMeta({ page, limit }, total));
});

export const createNote = asyncHandler(async (req, res) => {
  const note = await Note.create({ user: req.user._id, exam: req.user.examStage, ...req.body });
  return created(res, { note });
});

export const updateNote = asyncHandler(async (req, res) => {
  const note = await Note.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, { new: true });
  if (!note) throw ApiError.notFound('That note was not found.');
  return ok(res, { note });
});

export const deleteNote = asyncHandler(async (req, res) => {
  const result = await Note.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!result.deletedCount) throw ApiError.notFound('That note was not found.');
  return noContent(res);
});

/* ------------------------------------------------------------- flashcards --- */

export const listFlashcards = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query, { defaultLimit: 30, maxLimit: 100 });
  const examId = req.query.exam || req.user.examStage;
  if (!examId) throw ApiError.badRequest('Choose an examination first.');

  const filter = { exam: examId, status: CONTENT_STATUS.PUBLISHED };
  for (const key of ['subject', 'chapter', 'topic', 'kind']) {
    if (req.query[key]) filter[key] = req.query[key];
  }

  // "due" restricts the deck to cards the schedule says are ready for review.
  if (req.query.due === 'true' || req.query.due === true) {
    const due = await FlashcardState.find({ user: req.user._id, dueAt: { $lte: new Date() } }).select('flashcard').lean();
    const seen = await FlashcardState.find({ user: req.user._id }).select('flashcard').lean();
    const dueIds = due.map((d) => d.flashcard);
    const seenIds = seen.map((s) => String(s.flashcard));
    filter.$or = [{ _id: { $in: dueIds } }, { _id: { $nin: seenIds } }];
  }

  const [rows, total] = await Promise.all([
    Flashcard.find(filter)
      .sort({ order: 1, createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('topic', 'title slug')
      .populate('subject', 'shortName name')
      .lean(),
    Flashcard.countDocuments(filter),
  ]);

  const states = await FlashcardState.find({ user: req.user._id, flashcard: { $in: rows.map((r) => r._id) } }).lean();
  const byCard = new Map(states.map((s) => [String(s.flashcard), s]));

  return ok(
    res,
    {
      flashcards: rows.map((card) => ({
        ...card,
        state: byCard.get(String(card._id)) || { reviews: 0, known: 0, box: 0, dueAt: null },
      })),
    },
    pageMeta({ page, limit }, total),
  );
});

export const reviewFlashcard = asyncHandler(async (req, res) => {
  const card = await Flashcard.findById(req.params.id).select('_id topic').lean();
  if (!card) throw ApiError.notFound('That flashcard was not found.');

  const known = req.body.outcome === 'known';
  const state =
    (await FlashcardState.findOne({ user: req.user._id, flashcard: card._id })) ||
    new FlashcardState({ user: req.user._id, flashcard: card._id, topic: card.topic });

  state.reviews += 1;
  if (known) {
    state.known += 1;
    state.box = Math.min(LEITNER_INTERVALS.length - 1, state.box + 1);
  } else {
    state.needsRevision += 1;
    state.box = 0;
  }
  state.lastReviewedAt = new Date();
  state.dueAt = new Date(Date.now() + Math.max(1, LEITNER_INTERVALS[state.box]) * DAY_MS);
  await state.save();

  return ok(res, { state });
});

/* ---------------------------------------------------------------- search --- */

export const search = asyncHandler(async (req, res) => {
  const examId = req.user?.examStage;
  if (!examId) throw ApiError.badRequest('Choose an examination first.');
  const results = await globalSearch({
    query: req.query.q,
    examId,
    userId: req.user._id,
    limitPerType: req.query.limit,
    types: req.query.types,
  });
  return ok(res, results);
});
