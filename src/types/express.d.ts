import { Request, Response, NextFunction } from 'express';

// Extend Express Request to carry authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
      };
    }
  }
}

export {};
