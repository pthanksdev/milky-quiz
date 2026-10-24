import { nanoid } from 'nanoid';
import { prisma } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { uploadBuffer, deleteAsset } from '../../utils/cloudinary';
import { generateQuizQuestions } from '../../utils/gemini';
import { extractText, getMimeType } from '../../utils/extractDocument';
import type { CreateQuizInput, UpdateQuizInput, AddQuestionInput } from './quiz.schema';

const quizPublicSelect = {
  id: true,
  title: true,
  description: true,
  topic: true,
  difficulty: true,
  coverUrl: true,
  visibility: true,
  shareCode: true,
  status: true,
  createdAt: true,
  author: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
  _count: { select: { questions: true, attempts: true } },
};

// ─── Create ───────────────────────────────────────────────────
export const createQuiz = async (authorId: string, input: CreateQuizInput) => {
  return prisma.quiz.create({
    data: { ...input, authorId, shareCode: nanoid(8) },
    select: quizPublicSelect,
  });
};

// ─── List (public, paginated) ────────────────────────────────
export const listQuizzes = async (params: {
  page: number;
  limit: number;
  topic?: string;
  difficulty?: string;
  search?: string;
}) => {
  const { page, limit, topic, difficulty, search } = params;
  const skip = (page - 1) * limit;

  const where = {
    status: 'PUBLISHED' as const,
    visibility: 'PUBLIC' as const,
    ...(topic && { topic: { contains: topic, mode: 'insensitive' as const } }),
    ...(difficulty && { difficulty: difficulty as any }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { topic: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [quizzes, total] = await Promise.all([
    prisma.quiz.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, select: quizPublicSelect }),
    prisma.quiz.count({ where }),
  ]);

  return { quizzes, total, page, limit, pages: Math.ceil(total / limit) };
};

// ─── Get one ─────────────────────────────────────────────────
export const getQuiz = async (idOrCode: string, userId?: string) => {
  const quiz = await prisma.quiz.findFirst({
    where: { OR: [{ id: idOrCode }, { shareCode: idOrCode }] },
    include: {
      author: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      questions: {
        orderBy: { orderIndex: 'asc' },
        include: {
          options: {
            select: {
              id: true,
              text: true,
              // Never expose isCorrect in a public quiz fetch — only return for author
            },
          },
        },
      },
    },
  });

  if (!quiz) throw new AppError('Quiz not found', 404);

  // Access control
  if (quiz.visibility === 'PRIVATE' && quiz.authorId !== userId) {
    throw new AppError('This quiz is private', 403);
  }

  // Strip correct answers unless requester is the author
  if (quiz.authorId !== userId) {
    return quiz;
  }

  // Author gets full data including isCorrect
  return prisma.quiz.findFirst({
    where: { id: quiz.id },
    include: {
      author: { select: { id: true, username: true, fullName: true, avatarUrl: true } },
      questions: {
        orderBy: { orderIndex: 'asc' },
        include: { options: true },
      },
    },
  });
};

// ─── Update ───────────────────────────────────────────────────
export const updateQuiz = async (quizId: string, userId: string, input: UpdateQuizInput) => {
  await assertOwner(quizId, userId);
  return prisma.quiz.update({ where: { id: quizId }, data: input, select: quizPublicSelect });
};

// ─── Delete ───────────────────────────────────────────────────
export const deleteQuiz = async (quizId: string, userId: string) => {
  await assertOwner(quizId, userId);
  await prisma.quiz.delete({ where: { id: quizId } });
};

// ─── Publish ─────────────────────────────────────────────────
export const publishQuiz = async (quizId: string, userId: string) => {
  await assertOwner(quizId, userId);
  const questionCount = await prisma.question.count({ where: { quizId } });
  if (questionCount === 0) throw new AppError('Cannot publish a quiz with no questions', 400);
  return prisma.quiz.update({
    where: { id: quizId },
    data: { status: 'PUBLISHED', isPublic: true },
    select: quizPublicSelect,
  });
};

// ─── Cover image ─────────────────────────────────────────────
export const updateCover = async (quizId: string, userId: string, buffer: Buffer) => {
  const quiz = await assertOwner(quizId, userId);
  if (quiz.coverPublicId) await deleteAsset(quiz.coverPublicId);
  const { url, publicId } = await uploadBuffer(buffer, 'milky-quiz/covers');
  return prisma.quiz.update({
    where: { id: quizId },
    data: { coverUrl: url, coverPublicId: publicId },
    select: quizPublicSelect,
  });
};

// ─── Fork ────────────────────────────────────────────────────
export const forkQuiz = async (quizId: string, userId: string) => {
  const original = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { include: { options: true } } },
  });
  if (!original) throw new AppError('Quiz not found', 404);
  if (original.visibility === 'PRIVATE' && original.authorId !== userId) {
    throw new AppError('Cannot fork a private quiz', 403);
  }

  return prisma.quiz.create({
    data: {
      authorId: userId,
      title: `${original.title} (Fork)`,
      description: original.description,
      topic: original.topic,
      difficulty: original.difficulty,
      shareCode: nanoid(8),
      forkedFromId: original.id,
      questions: {
        create: original.questions.map((q, i) => ({
          text: q.text,
          type: q.type,
          orderIndex: i,
          explanation: q.explanation,
          hint: q.hint,
          difficultyScore: q.difficultyScore,
          options: { create: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) },
        })),
      },
    },
    select: quizPublicSelect,
  });
};

// ─── My quizzes ───────────────────────────────────────────────
export const getMyQuizzes = async (userId: string) => {
  return prisma.quiz.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: 'desc' },
    select: quizPublicSelect,
  });
};

// ─── AI Generate ─────────────────────────────────────────────
export const generateFromAI = async (params: {
  source: 'topic' | 'notes' | 'document';
  content?: string;
  documentBuffer?: Buffer;
  documentName?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  count: number;
}) => {
  let content = params.content || '';

  if (params.source === 'document') {
    if (!params.documentBuffer || !params.documentName) {
      throw new AppError('Document buffer is required for document source', 400);
    }
    const mimeType = getMimeType(params.documentName);
    if (!mimeType) throw new AppError('Only PDF and DOCX files are supported', 400);
    content = await extractText(params.documentBuffer, mimeType);
    if (content.length < 100) throw new AppError('Document has too little readable content', 400);
  }

  if (!content || content.trim().length < 10) {
    throw new AppError('Content is too short to generate questions from', 400);
  }

  return generateQuizQuestions({ content, difficulty: params.difficulty, count: params.count });
};

// ─── Questions ───────────────────────────────────────────────
export const addQuestion = async (quizId: string, userId: string, input: AddQuestionInput) => {
  await assertOwner(quizId, userId);
  const count = await prisma.question.count({ where: { quizId } });

  return prisma.question.create({
    data: {
      quizId,
      text: input.text,
      type: input.type,
      explanation: input.explanation,
      hint: input.hint,
      difficultyScore: input.difficultyScore,
      orderIndex: count,
      options: input.options
        ? { create: input.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) }
        : undefined,
    },
    include: { options: true },
  });
};

export const updateQuestion = async (
  questionId: string,
  userId: string,
  input: Partial<AddQuestionInput>,
) => {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { quiz: true },
  });
  if (!question) throw new AppError('Question not found', 404);
  if (question.quiz.authorId !== userId) throw new AppError('Not authorized', 403);

  return prisma.question.update({
    where: { id: questionId },
    data: {
      text: input.text,
      explanation: input.explanation,
      hint: input.hint,
      difficultyScore: input.difficultyScore,
    },
    include: { options: true },
  });
};

export const deleteQuestion = async (questionId: string, userId: string) => {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { quiz: true },
  });
  if (!question) throw new AppError('Question not found', 404);
  if (question.quiz.authorId !== userId) throw new AppError('Not authorized', 403);
  await prisma.question.delete({ where: { id: questionId } });
};

export const reorderQuestions = async (quizId: string, userId: string, orderedIds: string[]) => {
  await assertOwner(quizId, userId);
  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.question.update({ where: { id }, data: { orderIndex: index } }),
    ),
  );
};

export const addQuestionImage = async (questionId: string, userId: string, buffer: Buffer) => {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { quiz: true },
  });
  if (!question) throw new AppError('Question not found', 404);
  if (question.quiz.authorId !== userId) throw new AppError('Not authorized', 403);

  if (question.imagePublicId) await deleteAsset(question.imagePublicId);
  const { url, publicId } = await uploadBuffer(buffer, 'milky-quiz/questions');

  return prisma.question.update({
    where: { id: questionId },
    data: { imageUrl: url, imagePublicId: publicId },
    include: { options: true },
  });
};

// ─── Helper ───────────────────────────────────────────────────
const assertOwner = async (quizId: string, userId: string) => {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
  if (!quiz) throw new AppError('Quiz not found', 404);
  if (quiz.authorId !== userId) throw new AppError('Not authorized', 403);
  return quiz;
};
