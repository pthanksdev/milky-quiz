import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { Server as SocketIOServer } from 'socket.io';
import { registerRoomHandlers } from './sockets/room.socket';

const PORT = Number(process.env.PORT) || 5000;

const server = http.createServer(app);

// ─── Attach Socket.io ─────────────────────────────────────────
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Register real-time room events
registerRoomHandlers(io);

// ─── Start HTTP & Socket Server ───────────────────────────────
server.listen(PORT, () => {
  console.log(`🚀 Milky Quiz API server running on port ${PORT}`);
  console.log(`⚡ WebSocket server attached with battle room events`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
