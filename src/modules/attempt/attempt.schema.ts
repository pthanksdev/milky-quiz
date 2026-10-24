import { z } from 'zod';

export const startAttemptSchema = z.object({
  quizId: z.string().uuid(),
  mode: z.enum(['TEST', 'LEARNING', 'BATTLE', 'ADAPTIVE']).default('TEST'),
});

export const submitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  selectedOptionId: z.string().uuid().optional(),
  shortAnswerText: z.string().max(500).optional(),
  timeTakenMs: z.number().int().min(0).default(0),
  hintUsed: z.boolean().default(false),
  isRetry: z.boolean().default(false),
});

export type StartAttemptInput = z.infer<typeof startAttemptSchema>;
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
