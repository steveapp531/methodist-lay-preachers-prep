import { Router } from 'express';
import * as content from '../controllers/contentController.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam, listContentQuery, topicProgressSchema } from '../validators/schemas.js';

const router = Router();

// Exams and subjects are readable without an account so the landing page can
// show what the platform covers.
router.get('/exams', content.listExams);
router.get('/exams/:id', validate({ params: idParam }), content.getExam);

router.get('/subjects', optionalAuth, validate({ query: listContentQuery }), content.listSubjects);
router.get('/subjects/:id', optionalAuth, validate({ params: idParam }), content.getSubject);

router.get('/topics/:id', optionalAuth, validate({ params: idParam }), content.getTopic);
router.patch(
  '/topics/:id/progress',
  requireAuth,
  validate({ params: idParam, body: topicProgressSchema }),
  content.updateTopicProgress,
);

router.get('/questions', requireAuth, validate({ query: listContentQuery }), content.listQuestions);
router.get('/questions/:id', requireAuth, validate({ params: idParam }), content.getQuestion);

router.get('/scriptures', requireAuth, validate({ query: listContentQuery }), content.listScriptures);
router.get('/scriptures/:reference', requireAuth, content.getScripture);

export default router;
