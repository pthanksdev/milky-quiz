import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate';
import { uploadImage, uploadDocument } from '../../middleware/upload';
import { aiRateLimiter } from '../../middleware/rateLimit';
import {
  createQuizSchema,
  updateQuizSchema,
  generateQuizSchema,
  addQuestionSchema,
  reorderQuestionsSchema,
} from './quiz.schema';
import * as quizController from './quiz.controller';

const router = Router();

// ─── Public routes ───────────────────────────────────────────
router.get('/', quizController.listQuizzes);
router.get('/:id', quizController.getQuiz);

// ─── Authenticated routes ─────────────────────────────────────
router.use(authenticate);

router.post('/', validate(createQuizSchema), quizController.createQuiz);
router.get('/me/quizzes', quizController.getMyQuizzes);
router.patch('/:id', validate(updateQuizSchema), quizController.updateQuiz);
router.delete('/:id', quizController.deleteQuiz);
router.post('/:id/publish', quizController.publishQuiz);
router.post('/:id/cover', uploadImage, quizController.updateCover);
router.post('/:id/fork', quizController.forkQuiz);

// AI generation — rate limited
router.post(
  '/generate',
  aiRateLimiter,
  uploadDocument, // optional — only used when source = 'document'
  validate(generateQuizSchema),
  quizController.generateFromAI,
);

// Question sub-routes
router.post('/:id/questions', validate(addQuestionSchema), quizController.addQuestion);
router.patch('/:id/questions/reorder', validate(reorderQuestionsSchema), quizController.reorderQuestions);
router.patch('/:id/questions/:questionId', quizController.updateQuestion);
router.delete('/:id/questions/:questionId', quizController.deleteQuestion);
router.post('/:id/questions/:questionId/image', uploadImage, quizController.addQuestionImage);

export default router;
