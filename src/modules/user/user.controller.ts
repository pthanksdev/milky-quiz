import { Request, Response } from 'express';
import * as userService from './user.service';

export const getMe = async (req: Request, res: Response) => {
  const user = await userService.getMe(req.user!.id);
  res.json(user);
};

export const updateMe = async (req: Request, res: Response) => {
  const user = await userService.updateMe(req.user!.id, req.body);
  res.json(user);
};

export const updateAvatar = async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: 'No image file provided' });
    return;
  }
  const user = await userService.updateAvatar(req.user!.id, req.file.buffer);
  res.json(user);
};
