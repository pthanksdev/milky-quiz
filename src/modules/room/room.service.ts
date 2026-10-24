import { customAlphabet } from 'nanoid';
import { prisma } from '../../config/db';
import redis, { Keys } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import type { CreateRoomInput, JoinRoomInput } from './room.schema';

const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
const ROOM_TTL = 2 * 60 * 60; // 2 hours

const roomSelect = {
  id: true,
  code: true,
  status: true,
  createdAt: true,
  host: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
  quiz: { select: { id: true, title: true, topic: true, _count: { select: { questions: true } } } },
  players: {
    include: {
      user: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
    },
  },
};

export const createRoom = async (hostId: string, input: CreateRoomInput) => {
  const quiz = await prisma.quiz.findUnique({ where: { id: input.quizId } });
  if (!quiz) throw new AppError('Quiz not found', 404);
  if (quiz.status !== 'PUBLISHED') throw new AppError('Quiz must be published to create a room', 400);

  let code = generateCode();
  // Ensure uniqueness
  while (await prisma.room.findUnique({ where: { code } })) {
    code = generateCode();
  }

  const room = await prisma.room.create({
    data: {
      hostId,
      quizId: input.quizId,
      code,
      players: { create: { userId: hostId } }, // host auto-joins
    },
    select: roomSelect,
  });

  // Cache initial room state in Redis
  await redis.setex(Keys.room(room.id), ROOM_TTL, JSON.stringify({ status: 'WAITING', playerIds: [hostId] }));

  return room;
};

export const joinRoom = async (userId: string, input: JoinRoomInput) => {
  const room = await prisma.room.findUnique({ where: { code: input.code }, select: roomSelect });
  if (!room) throw new AppError('Room not found. Check your code.', 404);
  if (room.status !== 'WAITING') throw new AppError('Game has already started', 400);

  const alreadyIn = room.players.some((p) => p.user.id === userId);
  if (!alreadyIn) {
    await prisma.roomPlayer.create({ data: { roomId: room.id, userId } });
  }

  return prisma.room.findUnique({ where: { id: room.id }, select: roomSelect });
};

export const getRoom = async (roomId: string) => {
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: roomSelect });
  if (!room) throw new AppError('Room not found', 404);
  return room;
};

export const startRoom = async (roomId: string, hostId: string) => {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new AppError('Room not found', 404);
  if (room.hostId !== hostId) throw new AppError('Only the host can start the game', 403);
  if (room.status !== 'WAITING') throw new AppError('Game already started or finished', 400);

  const playerCount = await prisma.roomPlayer.count({ where: { roomId } });
  if (playerCount < 2) throw new AppError('Need at least 2 players to start', 400);

  return prisma.room.update({
    where: { id: roomId },
    data: { status: 'ACTIVE' },
    select: roomSelect,
  });
};

export const finishRoom = async (roomId: string) => {
  // Compute final ranks by score
  const players = await prisma.roomPlayer.findMany({
    where: { roomId },
    orderBy: { score: 'desc' },
  });

  await Promise.all(
    players.map((p, i) =>
      prisma.roomPlayer.update({
        where: { id: p.id },
        data: { rank: i + 1, finishedAt: new Date() },
      }),
    ),
  );

  return prisma.room.update({
    where: { id: roomId },
    data: { status: 'FINISHED' },
    select: roomSelect,
  });
};

export const updatePlayerScore = async (roomId: string, userId: string, increment: number) => {
  return prisma.roomPlayer.updateMany({
    where: { roomId, userId },
    data: { score: { increment } },
  });
};
