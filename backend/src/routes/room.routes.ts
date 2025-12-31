import { Router } from 'express';
import { roomController } from '../controllers/room.controller';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { createRoomSchema, joinRoomSchema } from '../validators/room.validator';

const router = Router();

router.use(authMiddleware);

router.post('/', validate(createRoomSchema), roomController.createRoom);
router.get('/', roomController.getPublicRooms);
router.get('/:id', roomController.getRoomById);
router.post('/:id/join', validate(joinRoomSchema), roomController.joinRoom);
router.delete('/:id', roomController.deleteRoom);
router.post('/:id/transfer-moderator', roomController.transferModerator);
router.delete('/:id/users/:userId', roomController.kickUser);

export default router;
