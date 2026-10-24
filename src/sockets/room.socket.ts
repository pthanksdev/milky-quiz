import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import * as roomService from '../modules/room/room.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

export const registerRoomHandlers = (io: SocketIOServer) => {
  // Socket authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required for socket connection'));
    }

    try {
      const decoded = verifyAccessToken(token);
      socket.userId = decoded.id;
      socket.username = decoded.username;
      next();
    } catch (err) {
      next(new Error('Invalid or expired socket authentication token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;

    // ─── Join Room ────────────────────────────────────────────────
    socket.on('join_room', async ({ code }: { code: string }) => {
      try {
        const room = await roomService.joinRoom(userId, { code });
        if (!room) {
          socket.emit('room_error', { message: 'Room not found' });
          return;
        }

        const roomChannel = `room:${room.id}`;
        socket.join(roomChannel);

        const roomState = await roomService.getRoom(room.id);

        io.to(roomChannel).emit('player_joined', {
          roomId: room.id,
          code: room.code,
          players: roomState.players,
        });
      } catch (error: any) {
        socket.emit('room_error', { message: error.message || 'Failed to join room' });
      }
    });

    // ─── Start Game (Host only) ──────────────────────────────────
    socket.on('start_game', async ({ roomId }: { roomId: string }) => {
      try {
        const room = await roomService.startRoom(roomId, userId);
        const roomChannel = `room:${roomId}`;

        io.to(roomChannel).emit('game_started', {
          roomId: room.id,
          status: room.status,
          questionCount: room.quiz._count.questions,
          startTime: new Date().toISOString(),
        });
      } catch (error: any) {
        socket.emit('room_error', { message: error.message || 'Failed to start game' });
      }
    });

    // ─── Submit Live Answer Score Update ──────────────────────────
    socket.on(
      'submit_live_answer',
      async ({
        roomId,
        scoreDelta,
      }: {
        roomId: string;
        scoreDelta: number;
      }) => {
        try {
          await roomService.updatePlayerScore(roomId, userId, scoreDelta);
          const roomChannel = `room:${roomId}`;
          const currentRoom = await roomService.getRoom(roomId);

          io.to(roomChannel).emit('player_score_update', {
            roomId,
            userId,
            scoreDelta,
            players: currentRoom.players,
          });
        } catch (error: any) {
          socket.emit('room_error', { message: error.message || 'Failed to update score' });
        }
      },
    );

    // ─── Finish Game ─────────────────────────────────────────────
    socket.on('finish_game', async ({ roomId }: { roomId: string }) => {
      try {
        const finishedRoom = await roomService.finishRoom(roomId);
        const roomChannel = `room:${roomId}`;

        io.to(roomChannel).emit('game_ended', {
          roomId,
          status: finishedRoom.status,
          leaderboard: finishedRoom.players,
        });
      } catch (error: any) {
        socket.emit('room_error', { message: error.message || 'Failed to finish game' });
      }
    });

    // ─── Disconnect ──────────────────────────────────────────────
    socket.on('disconnect', () => {
      // Handled gracefully without dropping room state
    });
  });
};
