import { Request, Response } from 'express';
import * as roomService from './room.service';

export const createRoom = async (req: Request, res: Response) => {
  const room = await roomService.createRoom(req.user!.id, req.body);
  res.status(201).json(room);
};

export const joinRoom = async (req: Request, res: Response) => {
  const room = await roomService.joinRoom(req.user!.id, req.body);
  res.json(room);
};

export const getRoom = async (req: Request, res: Response) => {
  const room = await roomService.getRoom(req.params.id as string);
  res.json(room);
};

export const startRoom = async (req: Request, res: Response) => {
  const room = await roomService.startRoom(req.params.id as string, req.user!.id);
  res.json(room);
};
