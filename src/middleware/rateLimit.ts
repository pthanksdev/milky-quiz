import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import redis, { Keys } from '../config/redis';

/** Global rate limiter — 100 requests per 15 minutes per IP */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

/** Auth endpoint limiter — 10 attempts per 15 minutes per IP (brute-force protection) */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth attempts, please try again later.' },
});

const AI_MAX = Number(process.env.AI_RATE_LIMIT_MAX) || 10;
const AI_WINDOW_HOURS = Number(process.env.AI_RATE_LIMIT_WINDOW_HOURS) || 1;
const AI_WINDOW_SECONDS = AI_WINDOW_HOURS * 3600;

/**
 * Redis-backed AI rate limiter — tracks per-user, not per-IP.
 * Allows AI_MAX generations per AI_WINDOW_HOURS.
 */
export const aiRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }

  const key = Keys.aiRate(userId);
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, AI_WINDOW_SECONDS);
  }

  if (count > AI_MAX) {
    const ttl = await redis.ttl(key);
    res.status(429).json({
      message: `AI generation limit reached (${AI_MAX} per ${AI_WINDOW_HOURS}h). Try again in ${Math.ceil(ttl / 60)} minutes.`,
    });
    return;
  }

  next();
};
