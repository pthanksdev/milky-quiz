import { prisma } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { updateTopicStats } from '../analytics/analytics.service';
import type { StartAttemptInput, SubmitAnswerInput } from './attempt.schema';

// ─── Start attempt ───────────────────────────────────────────
export const startAttempt = async (userId: string, input: StartAttemptInput) => {
  const quiz = await prisma.quiz.findUnique({
    where: { id: input.quizId },
    include: { _count: { select: { questions: true } } },
  });
  if (!quiz) throw new AppError('Quiz not found', 404);
  if (quiz.status !== 'PUBLISHED' && quiz.authorId !== userId) {
    throw new AppError('Quiz is not published', 403);
  }

  const attempt = await prisma.attempt.create({
    data: {
      userId,
      quizId: input.quizId,
      mode: input.mode,
      totalQuestions: quiz._count.questions,
    },
  });

  // Return first question (or adaptive first question)
  const question = await getNextQuestion(attempt.id, input.quizId, null, input.mode === 'ADAPTIVE' ? 2.5 : null);

  return { attempt, question };
};

// ─── Get next question ───────────────────────────────────────
export const getNextQuestion = async (
  attemptId: string,
  quizId: string,
  lastAdaptiveLevel: number | null,
  adaptiveLevel: number | null,
) => {
  const seenIds = await prisma.attemptAnswer.findMany({
    where: { attemptId },
    select: { questionId: true },
  });
  const seenQuestionIds = seenIds.map((a) => a.questionId);

  let question;

  if (adaptiveLevel !== null) {
    // Adaptive: pick question closest to current difficulty level
    question = await prisma.question.findFirst({
      where: {
        quizId,
        id: { notIn: seenQuestionIds },
        difficultyScore: {
          gte: adaptiveLevel - 0.8,
          lte: adaptiveLevel + 0.8,
        },
      },
      include: { options: { select: { id: true, text: true } } }, // No isCorrect!
      orderBy: { difficultyScore: 'asc' },
    });

    // Fallback: any unseen question
    if (!question) {
      question = await prisma.question.findFirst({
        where: { quizId, id: { notIn: seenQuestionIds } },
        include: { options: { select: { id: true, text: true } } },
        orderBy: { orderIndex: 'asc' },
      });
    }
  } else {
    // Normal order
    question = await prisma.question.findFirst({
      where: { quizId, id: { notIn: seenQuestionIds } },
      include: { options: { select: { id: true, text: true } } },
      orderBy: { orderIndex: 'asc' },
    });
  }

  return question || null; // null = quiz complete
};

// ─── Submit answer ───────────────────────────────────────────
export const submitAnswer = async (
  attemptId: string,
  userId: string,
  input: SubmitAnswerInput,
) => {
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw new AppError('Attempt not found', 404);
  if (attempt.userId !== userId) throw new AppError('Not authorized', 403);
  if (attempt.completedAt) throw new AppError('Attempt already completed', 400);

  // Validate question belongs to this quiz
  const question = await prisma.question.findFirst({
    where: { id: input.questionId, quizId: attempt.quizId },
    include: { options: true },
  });
  if (!question) throw new AppError('Question not found', 404);

  // Determine correctness server-side
  let isCorrect = false;
  if (input.selectedOptionId) {
    const correctOption = question.options.find((o) => o.isCorrect);
    isCorrect = correctOption?.id === input.selectedOptionId;
  } else if (input.shortAnswerText) {
    // For short answer: simple case-insensitive match against correct option text
    const correctOption = question.options.find((o) => o.isCorrect);
    isCorrect = correctOption?.text.toLowerCase().trim() === input.shortAnswerText.toLowerCase().trim();
  }

  // Save the answer (skip if retry attempt already exists and not a retry)
  const existingAnswer = await prisma.attemptAnswer.findFirst({
    where: { attemptId, questionId: input.questionId },
  });

  let answerRecord;
  if (existingAnswer && input.isRetry) {
    // Update the existing answer with retry result
    answerRecord = await prisma.attemptAnswer.update({
      where: { id: existingAnswer.id },
      data: {
        selectedOptionId: input.selectedOptionId,
        isCorrect,
        retryUsed: true,
        timeTakenMs: existingAnswer.timeTakenMs + input.timeTakenMs,
      },
    });
  } else if (!existingAnswer) {
    answerRecord = await prisma.attemptAnswer.create({
      data: {
        attemptId,
        questionId: input.questionId,
        selectedOptionId: input.selectedOptionId,
        shortAnswerText: input.shortAnswerText,
        isCorrect,
        timeTakenMs: input.timeTakenMs,
        hintUsed: input.hintUsed,
      },
    });
  } else {
    throw new AppError('Question already answered. Use isRetry: true to retry.', 400);
  }

  // Adaptive level update
  let newAdaptiveLevel = attempt.adaptiveLevel;
  if (attempt.mode === 'ADAPTIVE') {
    const SLOW_THRESHOLD_MS = 15000; // 15 seconds = "slow"
    if (isCorrect && input.timeTakenMs < SLOW_THRESHOLD_MS) {
      newAdaptiveLevel = Math.min(5.0, attempt.adaptiveLevel + 0.3);
    } else if (isCorrect) {
      newAdaptiveLevel = Math.min(5.0, attempt.adaptiveLevel + 0.1);
    } else {
      newAdaptiveLevel = Math.max(1.0, attempt.adaptiveLevel - 0.4);
    }
    await prisma.attempt.update({
      where: { id: attemptId },
      data: { adaptiveLevel: newAdaptiveLevel },
    });
  }

  // Build response — include explanation/hint based on mode
  const response: Record<string, unknown> = {
    isCorrect,
    attemptAnswerId: answerRecord.id,
  };

  if (attempt.mode === 'LEARNING' || attempt.mode === 'ADAPTIVE') {
    if (isCorrect) {
      response.explanation = question.explanation;
    } else if (!input.isRetry) {
      response.hint = question.hint;
      response.canRetry = true;
    } else {
      // Second wrong — reveal explanation and correct answer
      response.explanation = question.explanation;
      response.correctOptionId = question.options.find((o) => o.isCorrect)?.id;
      response.canRetry = false;
    }
  }

  // Get next question
  const nextQuestion = await getNextQuestion(
    attemptId,
    attempt.quizId,
    attempt.adaptiveLevel,
    attempt.mode === 'ADAPTIVE' ? newAdaptiveLevel : null,
  );

  response.nextQuestion = nextQuestion;
  response.adaptiveLevel = newAdaptiveLevel;

  return response;
};

// ─── Complete attempt ─────────────────────────────────────────
export const completeAttempt = async (attemptId: string, userId: string) => {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: true,
      quiz: { select: { topic: true } },
    },
  });
  if (!attempt) throw new AppError('Attempt not found', 404);
  if (attempt.userId !== userId) throw new AppError('Not authorized', 403);
  if (attempt.completedAt) throw new AppError('Attempt already completed', 400);

  const score = attempt.answers.filter((a) => a.isCorrect).length;

  const completed = await prisma.attempt.update({
    where: { id: attemptId },
    data: { score, completedAt: new Date() },
    include: {
      answers: {
        include: {
          question: { select: { text: true, explanation: true } },
          selectedOption: { select: { text: true } },
        },
      },
    },
  });

  // Trigger analytics update
  await updateTopicStats(userId, attempt.quiz.topic, attempt.answers);

  return {
    score,
    totalQuestions: attempt.totalQuestions,
    percentage: Math.round((score / attempt.totalQuestions) * 100),
    mode: attempt.mode,
    answers: completed.answers,
  };
};

// ─── Get attempt history ─────────────────────────────────────
export const getMyAttempts = async (userId: string) => {
  return prisma.attempt.findMany({
    where: { userId, completedAt: { not: null } },
    orderBy: { completedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      mode: true,
      score: true,
      totalQuestions: true,
      completedAt: true,
      quiz: { select: { id: true, title: true, topic: true, difficulty: true } },
    },
  });
};
