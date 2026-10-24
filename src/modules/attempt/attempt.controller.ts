import { Request, Response } from 'express';
import * as attemptService from './attempt.service';

export const startAttempt = async (req: Request, res: Response) => {
  const result = await attemptService.startAttempt(req.user!.id, req.body);
  res.status(201).json(result);
};

export const submitAnswer = async (req: Request, res: Response) => {
  const result = await attemptService.submitAnswer(req.params.id as string, req.user!.id, req.body);
  res.json(result);
};

export const completeAttempt = async (req: Request, res: Response) => {
  const result = await attemptService.completeAttempt(req.params.id as string, req.user!.id);
  res.json(result);
};

export const getMyAttempts = async (req: Request, res: Response) => {
  const attempts = await attemptService.getMyAttempts(req.user!.id);
  res.json(attempts);
};
