import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis error:', err.message));

export default redis;

// ─── Key factories ────────────────────────────────────────────
export const Keys = {
  tokenBlacklist: (token: string) => `blacklist:${token}`,
  aiRate: (userId: string) => `ai_rate:${userId}`,
  room: (roomId: string) => `room:${roomId}`,
  analytics: (userId: string) => `analytics:${userId}`,
};
