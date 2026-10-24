import { Request, Response } from 'express';
import * as authService from './auth.service';

const COOKIE_NAME = 'refreshToken';
const setCookie = (res: Response, token: string, maxAge: number) => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge,
  });
};

export const register = async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  setCookie(res, result.refreshToken, result.cookieMaxAge);
  res.status(201).json({ user: result.user, accessToken: result.accessToken });
};

export const login = async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  setCookie(res, result.refreshToken, result.cookieMaxAge);
  res.json({ user: result.user, accessToken: result.accessToken });
};

export const refresh = async (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ message: 'No refresh token' });
    return;
  }
  const result = await authService.refresh(token);
  setCookie(res, result.refreshToken, result.cookieMaxAge);
  res.json({ accessToken: result.accessToken });
};

export const logout = async (req: Request, res: Response) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) await authService.logout(token);
  res.clearCookie(COOKIE_NAME);
  res.json({ message: 'Logged out successfully' });
};

export const forgotPassword = async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.username);
  // Always same response — don't leak username existence
  res.json({ message: 'If that account exists, a reset link has been sent.' });
};

export const resetPassword = async (req: Request, res: Response) => {
  await authService.resetPassword(req.body);
  res.json({ message: 'Password reset successfully. Please log in.' });
};
