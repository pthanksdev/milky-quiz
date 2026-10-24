import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import redis, { Keys } from '../config/redis';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  // Check Redis blacklist (logged out tokens)
  const isBlacklisted = await redis.exists(Keys.tokenBlacklist(token));
  if (isBlacklisted) {
    res.status(401).json({ message: 'Token has been revoked' });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.id, username: payload.username };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};
