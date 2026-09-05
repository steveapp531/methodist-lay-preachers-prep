import { Router } from 'express';
import * as library from '../controllers/libraryController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createBookmarkSchema,
  createNoteSchema,
  idParam,
  listContentQuery,
  reviewFlashcardSchema,
  searchQuery,
  updateNoteSchema,
} from '../validators/schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/bookmarks', validate({ query: listContentQuery.partial() }), library.listBookmarks);
router.post('/bookmarks', validate({ body: createBookmarkSchema }), library.createBookmark);
router.delete('/bookmarks/:id', validate({ params: idParam }), library.deleteBookmark);
router.post('/questions/:id/bookmark', validate({ params: idParam }), library.toggleQuestionBookmark);

router.get('/notes', validate({ query: listContentQuery.partial() }), library.listNotes);
router.post('/notes', validate({ body: createNoteSchema }), library.createNote);
router.patch('/notes/:id', validate({ params: idParam, body: updateNoteSchema }), library.updateNote);
router.delete('/notes/:id', validate({ params: idParam }), library.deleteNote);

router.get('/flashcards', library.listFlashcards);
router.post('/flashcards/:id/review', validate({ params: idParam, body: reviewFlashcardSchema }), library.reviewFlashcard);

router.get('/search', validate({ query: searchQuery }), library.search);

export default router;
