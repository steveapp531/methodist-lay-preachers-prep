import { Router } from 'express';
import { getDashboard, getProgress } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/dashboard', requireAuth, getDashboard);
router.get('/progress', requireAuth, getProgress);

export default router;
