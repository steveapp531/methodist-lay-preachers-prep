import { Router } from 'express';
import authRoutes from './authRoutes.js';
import contentRoutes from './contentRoutes.js';
import quizRoutes from './quizRoutes.js';
import mockExamRoutes from './mockExamRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import libraryRoutes from './libraryRoutes.js';
import adminRoutes from './adminRoutes.js';
import { aiEnabled, env } from '../config/env.js';

const router = Router();

router.get('/health', (_req, res) =>
  res.json({
    success: true,
    data: {
      status: 'ok',
      environment: env.NODE_ENV,
      aiGrading: aiEnabled() ? 'enabled' : 'rubric-only',
      time: new Date().toISOString(),
    },
  }),
);

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use(contentRoutes);
router.use(quizRoutes);
router.use(mockExamRoutes);
router.use(dashboardRoutes);
router.use(libraryRoutes);

export default router;
