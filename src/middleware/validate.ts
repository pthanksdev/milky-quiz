import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Factory that returns an Express middleware validating req.body
 * against the provided Zod schema. Sends 400 with formatted errors on failure.
 */
export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(400).json({ message: 'Validation failed', errors });
      return;
    }
    req.body = result.data; // replace with parsed + typed data
    next();
  };
