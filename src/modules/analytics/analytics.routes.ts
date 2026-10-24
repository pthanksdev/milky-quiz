import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import * as analyticsController from './analytics.controller';

const router = Router();

router.use(authenticate);

router.get('/me', analyticsController.getMyAnalytics);

export default router;
