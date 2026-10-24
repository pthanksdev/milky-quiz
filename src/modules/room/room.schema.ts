import { z } from 'zod';

export const createRoomSchema = z.object({
  quizId: z.string().uuid(),
});

export const joinRoomSchema = z.object({
  code: z.string().length(6, 'Room code must be 6 characters'),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
