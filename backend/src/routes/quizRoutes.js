import { Router } from 'express';
import * as quiz from '../controllers/quizController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { gradingLimiter } from '../middleware/rateLimit.js';
import { answerQuestionSchema, createQuizSchema, idParam, listContentQuery } from '../validators/schemas.js';

const router = Router();

router.use(requireAuth);

router.post('/quizzes', validate({ body: createQuizSchema }), quiz.createQuiz);
router.get('/quizzes', validate({ query: listContentQuery }), quiz.listQuizzes);
router.get('/quizzes/:id', validate({ params: idParam }), quiz.getQuiz);
router.post('/quizzes/:id/complete', validate({ params: idParam }), quiz.completeQuiz);

// Theory answers may hit the AI grader, so this path carries its own budget.
router.post(
  '/questions/:id/attempt',
  gradingLimiter,
  validate({ params: idParam, body: answerQuestionSchema }),
  quiz.answerQuestion,
);

router.get('/mistakes', validate({ query: listContentQuery }), quiz.listMistakes);

export default router;
