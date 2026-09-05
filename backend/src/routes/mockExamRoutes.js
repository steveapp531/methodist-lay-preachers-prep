import { Router } from 'express';
import * as mock from '../controllers/mockExamController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { gradingLimiter } from '../middleware/rateLimit.js';
import { idParam, listContentQuery, saveMockProgressSchema, startMockSchema } from '../validators/schemas.js';

const router = Router();

router.use(requireAuth);

router.get('/mock-exams', validate({ query: listContentQuery }), mock.listMockExams);
router.post('/mock-exams', validate({ body: startMockSchema }), mock.startMockExam);

router.get('/exam-attempts', validate({ query: listContentQuery }), mock.listAttempts);
router.get('/exam-attempts/:id', validate({ params: idParam }), mock.getAttempt);
router.patch('/exam-attempts/:id', validate({ params: idParam, body: saveMockProgressSchema }), mock.saveAttemptProgress);
router.post(
  '/exam-attempts/:id/submit',
  gradingLimiter,
  validate({ params: idParam, body: saveMockProgressSchema.partial() }),
  mock.submitMockExam,
);
router.get('/exam-attempts/:id/review', validate({ params: idParam }), mock.reviewAttempt);

// Convenience alias: submit whichever sitting of this mock is currently open.
router.post(
  '/mock-exams/:id/submit',
  gradingLimiter,
  validate({ params: idParam, body: saveMockProgressSchema.partial() }),
  mock.submitByMockExam,
);

export default router;
