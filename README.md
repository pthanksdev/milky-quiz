# 🌌 Milky Quiz — Backend API & Real-Time Engine

> Scalable Express.js + TypeScript REST API and Socket.io multiplayer engine designed for interactive quizzes, AI question generation, adaptive learning, and live battles.

---

## ⚡ Tech Stack & Architecture

- **Runtime & Language**: Node.js, Express.js, TypeScript (Strict)
- **Database & ORM**: PostgreSQL with Prisma Client
- **Caching & Ephemeral State**: Redis (`ioredis`) for token blacklisting, AI rate-limiting, live room states, and personal analytics caching
- **Real-Time Multiplayer**: Socket.io with JWT handshake authentication
- **AI Engine**: Google Gemini API (`@google/generative-ai`) with structured JSON schema output
- **Files & Media**: Cloudinary SDK (streaming via Multer memory storage — zero disk I/O)
- **Document Processing**: `pdf-parse` (PDF) & `mammoth` (DOCX) text extraction
- **Auth**: Custom JWT token pairs (access in header, refresh in httpOnly cookie) + bcrypt (12 rounds)
- **Email Service**: Nodemailer (Gmail SMTP) for time-limited password resets
- **Security & Validation**: Helmet, CORS, Express-Rate-Limit, Zod schema validation, centralized error handling

---

## 🚀 Quickstart

### 1. Configure Environment
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

Key environment variables:
```env
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5432/milky_quiz?schema=public"
REDIS_URL="redis://localhost:6379"
ACCESS_TOKEN_SECRET="your_secret_access_key"
REFRESH_TOKEN_SECRET="your_secret_refresh_key"
CLOUDINARY_CLOUD_NAME="your_cloud_name"
CLOUDINARY_API_KEY="your_api_key"
CLOUDINARY_API_SECRET="your_api_secret"
GEMINI_API_KEY="your_gemini_api_key"
GMAIL_USER="your_email@gmail.com"
GMAIL_APP_PASS="your_gmail_app_password"
```

### 2. Database Setup & Migrations
```bash
# Push schema migrations to PostgreSQL
npm run db:migrate

# Seed demo users, sample quizzes, and initial analytics
npm run db:seed
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
npm start
```

---

## 📡 API Endpoint Overview

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user (fullName, username, password) |
| `POST` | `/api/auth/login` | Login, issue accessToken + httpOnly refresh cookie |
| `POST` | `/api/auth/refresh` | Exchange refresh cookie for new access token |
| `POST` | `/api/auth/logout` | Clear cookie, blacklist token in Redis |
| `POST` | `/api/auth/forgot-password` | Generate reset token and send email via Nodemailer |
| `POST` | `/api/auth/reset-password` | Validate token, update password hash |

### 👤 User Profile (`/api/users`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users/me` | Fetch authenticated user profile |
| `PATCH` | `/api/users/me` | Update fullName and username |
| `POST` | `/api/users/me/avatar` | Upload avatar to Cloudinary (`milky-quiz/avatars`) |

### 🧠 Quiz Management & AI Generation (`/api/quizzes`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/quizzes` | List published quizzes (filters: `topic`, `difficulty`, `search`, `page`, `limit`) |
| `GET` | `/api/quizzes/:id` | Fetch quiz detail + questions (answers hidden from non-authors) |
| `POST` | `/api/quizzes` | Create draft quiz |
| `PATCH` | `/api/quizzes/:id` | Update quiz metadata (author only) |
| `DELETE` | `/api/quizzes/:id` | Delete quiz (author only) |
| `POST` | `/api/quizzes/:id/publish` | Publish draft quiz |
| `POST` | `/api/quizzes/:id/cover` | Upload quiz cover image to Cloudinary |
| `POST` | `/api/quizzes/:id/fork` | Fork/clone a quiz with questions & options |
| `POST` | `/api/quizzes/generate` | AI generation (rate-limited via Redis, accepts topic/notes/doc) |
| `POST` | `/api/quizzes/:id/questions` | Add question with options |
| `PATCH` | `/api/quizzes/:id/questions/:questionId` | Update question details |
| `DELETE` | `/api/quizzes/:id/questions/:questionId` | Delete question |
| `PATCH` | `/api/quizzes/:id/questions/reorder` | Update question order |
| `POST` | `/api/quizzes/:id/questions/:questionId/image` | Attach image to question |

### 🎯 Quiz Attempts & Learning Modes (`/api/attempts`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/attempts` | Start attempt (`TEST`, `LEARNING`, `ADAPTIVE`, `BATTLE`) |
| `POST` | `/api/attempts/:id/answer` | Submit answer (adaptive score update, hints on learning mode) |
| `POST` | `/api/attempts/:id/complete` | Finalize attempt, calculate score, trigger analytics aggregation |
| `GET` | `/api/attempts/me` | Fetch user attempt history |

### 📊 Personal Analytics (`/api/analytics`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/analytics/me` | Topic accuracy, 3 weakest areas, daily streak, weekly improvement (cached in Redis) |

### ⚔️ Multiplayer Battle Rooms (`/api/rooms`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/rooms` | Create room (generates 6-character code) |
| `POST` | `/api/rooms/join` | Join room via 6-character code |
| `GET` | `/api/rooms/:id` | Get room status and player list |
| `POST` | `/api/rooms/:id/start` | Host starts battle room |

---

## ⚡ Real-Time Socket.io Events (`room.socket.ts`)

Connect to WebSocket at `ws://localhost:5000` with JWT in `auth: { token: '...' }`:

| Event | Direction | Payload | Description |
|---|---|---|---|
| `join_room` | Client ➔ Server | `{ code: "ABC123" }` | Join room by code |
| `player_joined` | Server ➔ Room | `{ roomId, code, players }` | Broadcast to lobby |
| `start_game` | Client ➔ Server | `{ roomId }` | Host starts battle |
| `game_started` | Server ➔ Room | `{ roomId, status, questionCount, startTime }` | Battle begins |
| `submit_live_answer` | Client ➔ Server | `{ roomId, scoreDelta }` | Live answer score update |
| `player_score_update`| Server ➔ Room | `{ roomId, userId, scoreDelta, players }` | Leaderboard update |
| `finish_game` | Client ➔ Server | `{ roomId }` | Finalize room and compute ranks |
| `game_ended` | Server ➔ Room | `{ roomId, status, leaderboard }` | Announce final winners |
