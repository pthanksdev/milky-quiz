import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate';
import { startAttemptSchema, submitAnswerSchema } from './attempt.schema';
import * as attemptController from './attempt.controller';

const router = Router();
router.use(authenticate);

router.post('/', validate(startAttemptSchema), attemptController.startAttempt);
router.get('/me', attemptController.getMyAttempts);
router.post('/:id/answer', validate(submitAnswerSchema), attemptController.submitAnswer);
router.post('/:id/complete', attemptController.completeAttempt);

export default router;
