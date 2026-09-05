import { Router } from 'express';
import * as admin from '../controllers/adminController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  adminMockExamSchema,
  adminQuestionSchema,
  adminQuestionUpdateSchema,
  adminStatusSchema,
  adminSubjectSchema,
  adminTopicSchema,
  adminUserQuery,
  idParam,
  importSchema,
  listContentQuery,
} from '../validators/schemas.js';

const router = Router();

// Every route below this line requires an authenticated administrator.
router.use(requireAuth, requireAdmin);

router.get('/overview', admin.overview);
router.get('/exams', admin.listExamsAdmin);
router.get('/activity', admin.listActivity);

router.get('/users', validate({ query: adminUserQuery }), admin.listUsers);
router.get('/users/:id', validate({ params: idParam }), admin.getUserDetail);
router.patch('/users/:id', validate({ params: idParam }), admin.updateUser);

router.get('/questions', validate({ query: listContentQuery }), admin.listAdminQuestions);
router.post('/questions', validate({ body: adminQuestionSchema }), admin.createQuestion);
router.get('/questions/:id', validate({ params: idParam }), admin.getAdminQuestion);
router.patch('/questions/:id', validate({ params: idParam, body: adminQuestionUpdateSchema }), admin.updateQuestion);
router.patch('/questions/:id/status', validate({ params: idParam, body: adminStatusSchema }), admin.setQuestionStatus);
router.delete('/questions/:id', validate({ params: idParam }), admin.deleteQuestion);

router.post('/subjects', validate({ body: adminSubjectSchema }), admin.createSubject);
router.patch('/subjects/:id', validate({ params: idParam }), admin.updateSubject);

router.post('/topics', validate({ body: adminTopicSchema }), admin.createTopic);
router.patch('/topics/:id', validate({ params: idParam }), admin.updateTopic);

router.get('/mock-exams', admin.listAdminMockExams);
router.post('/mock-exams', validate({ body: adminMockExamSchema }), admin.createMockExam);
router.patch('/mock-exams/:id', validate({ params: idParam }), admin.updateMockExam);
router.delete('/mock-exams/:id', validate({ params: idParam }), admin.deleteMockExam);

router.post('/import/questions', validate({ body: importSchema }), admin.importContent);
router.patch('/notes/:id/visibility', validate({ params: idParam }), admin.publishNote);

export default router;
