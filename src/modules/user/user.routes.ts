import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate';
import { uploadImage } from '../../middleware/upload';
import { updateProfileSchema } from './user.schema';
import * as userController from './user.controller';

const router = Router();

router.use(authenticate);

router.get('/me', userController.getMe);
router.patch('/me', validate(updateProfileSchema), userController.updateMe);
router.post('/me/avatar', uploadImage, userController.updateAvatar);

export default router;
