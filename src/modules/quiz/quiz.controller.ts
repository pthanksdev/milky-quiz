import { Request, Response } from 'express';
import * as quizService from './quiz.service';

export const createQuiz = async (req: Request, res: Response) => {
  const quiz = await quizService.createQuiz(req.user!.id, req.body);
  res.status(201).json(quiz);
};

export const listQuizzes = async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const { topic, difficulty, search } = req.query as Record<string, string>;
  const result = await quizService.listQuizzes({ page, limit, topic, difficulty, search });
  res.json(result);
};

export const getQuiz = async (req: Request, res: Response) => {
  const quiz = await quizService.getQuiz(req.params.id as string, req.user?.id);
  res.json(quiz);
};

export const updateQuiz = async (req: Request, res: Response) => {
  const quiz = await quizService.updateQuiz(req.params.id as string, req.user!.id, req.body);
  res.json(quiz);
};

export const deleteQuiz = async (req: Request, res: Response) => {
  await quizService.deleteQuiz(req.params.id as string, req.user!.id);
  res.json({ message: 'Quiz deleted' });
};

export const publishQuiz = async (req: Request, res: Response) => {
  const quiz = await quizService.publishQuiz(req.params.id as string, req.user!.id);
  res.json(quiz);
};

export const updateCover = async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ message: 'No image provided' }); return; }
  const quiz = await quizService.updateCover(req.params.id as string, req.user!.id, req.file.buffer);
  res.json(quiz);
};

export const forkQuiz = async (req: Request, res: Response) => {
  const quiz = await quizService.forkQuiz(req.params.id as string, req.user!.id);
  res.status(201).json(quiz);
};

export const getMyQuizzes = async (req: Request, res: Response) => {
  const quizzes = await quizService.getMyQuizzes(req.user!.id);
  res.json(quizzes);
};

export const generateFromAI = async (req: Request, res: Response) => {
  const { source, content, documentUrl, difficulty, count } = req.body;
  const questions = await quizService.generateFromAI({
    source,
    content,
    documentBuffer: req.file?.buffer,
    documentName: req.file?.originalname,
    difficulty,
    count,
  });
  res.json({ questions });
};

export const addQuestion = async (req: Request, res: Response) => {
  const q = await quizService.addQuestion(req.params.id as string, req.user!.id, req.body);
  res.status(201).json(q);
};

export const updateQuestion = async (req: Request, res: Response) => {
  const q = await quizService.updateQuestion(req.params.questionId as string, req.user!.id, req.body);
  res.json(q);
};

export const deleteQuestion = async (req: Request, res: Response) => {
  await quizService.deleteQuestion(req.params.questionId as string, req.user!.id);
  res.json({ message: 'Question deleted' });
};

export const reorderQuestions = async (req: Request, res: Response) => {
  await quizService.reorderQuestions(req.params.id as string, req.user!.id, req.body.orderedIds);
  res.json({ message: 'Questions reordered' });
};

export const addQuestionImage = async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ message: 'No image provided' }); return; }
  const q = await quizService.addQuestionImage(req.params.questionId as string, req.user!.id, req.file.buffer);
  res.json(q);
};
