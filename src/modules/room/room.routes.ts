import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate';
import { createRoomSchema, joinRoomSchema } from './room.schema';
import * as roomController from './room.controller';

const router = Router();
router.use(authenticate);

router.post('/', validate(createRoomSchema), roomController.createRoom);
router.post('/join', validate(joinRoomSchema), roomController.joinRoom);
router.get('/:id', roomController.getRoom);
router.post('/:id/start', roomController.startRoom);

export default router;
