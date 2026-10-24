import { z } from 'zod';

export const createQuizSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(1000).optional(),
  topic: z.string().min(1, 'Topic is required').max(100),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
  visibility: z.enum(['PUBLIC', 'LINK_ONLY', 'PRIVATE']).default('PRIVATE'),
});

export const updateQuizSchema = createQuizSchema.partial();

export const generateQuizSchema = z.object({
  source: z.enum(['topic', 'notes', 'document']),
  content: z.string().min(10, 'Content too short').optional(),
  documentUrl: z.string().url().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  count: z.number().int().min(1).max(30).default(10),
});

export const addQuestionSchema = z.object({
  text: z.string().min(5, 'Question text too short').max(2000),
  type: z.enum(['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER']).default('MCQ'),
  explanation: z.string().max(1000).optional(),
  hint: z.string().max(500).optional(),
  difficultyScore: z.number().min(1).max(5).default(2.5),
  options: z
    .array(
      z.object({
        text: z.string().min(1).max(500),
        isCorrect: z.boolean(),
      }),
    )
    .min(2, 'At least 2 options required')
    .max(6)
    .optional(),
});

export const reorderQuestionsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export type CreateQuizInput = z.infer<typeof createQuizSchema>;
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;
export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;
export type AddQuestionInput = z.infer<typeof addQuestionSchema>;
