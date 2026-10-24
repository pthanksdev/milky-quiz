import crypto from 'crypto';
import { prisma } from '../../config/db';
import redis, { Keys } from '../../config/redis';
import { transporter } from '../../config/mailer';
import { hashPassword, comparePassword } from '../../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken, decodeToken } from '../../utils/jwt';
import { AppError } from '../../middleware/errorHandler';
import type { RegisterInput, LoginInput, ResetPasswordInput } from './auth.schema';

const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// ─── Register ────────────────────────────────────────────────
export const register = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { username: input.username } });
  if (existing) throw new AppError('Username already taken', 409);

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: { fullName: input.fullName, username: input.username, passwordHash },
    select: { id: true, fullName: true, username: true, avatarUrl: true, createdAt: true },
  });

  const tokenPayload = { id: user.id, username: user.username };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  return { user, accessToken, refreshToken, cookieMaxAge: REFRESH_COOKIE_MAX_AGE };
};

// ─── Login ───────────────────────────────────────────────────
export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { username: input.username } });
  if (!user) throw new AppError('Invalid username or password', 401);

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) throw new AppError('Invalid username or password', 401);

  const tokenPayload = { id: user.id, username: user.username };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  const { passwordHash: _, ...safeUser } = user;

  return { user: safeUser, accessToken, refreshToken, cookieMaxAge: REFRESH_COOKIE_MAX_AGE };
};

// ─── Refresh ─────────────────────────────────────────────────
export const refresh = async (oldRefreshToken: string) => {
  let payload;
  try {
    payload = verifyRefreshToken(oldRefreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  // Blacklist the old token
  const decoded = decodeToken(oldRefreshToken);
  if (decoded?.exp) {
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redis.setex(Keys.tokenBlacklist(oldRefreshToken), ttl, '1');
    }
  }

  const tokenPayload = { id: payload.id, username: payload.username };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  return { accessToken, refreshToken, cookieMaxAge: REFRESH_COOKIE_MAX_AGE };
};

// ─── Logout ──────────────────────────────────────────────────
export const logout = async (refreshToken: string) => {
  const decoded = decodeToken(refreshToken);
  if (decoded?.exp) {
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redis.setex(Keys.tokenBlacklist(refreshToken), ttl, '1');
    }
  }
};

// ─── Forgot Password ─────────────────────────────────────────
export const forgotPassword = async (username: string) => {
  const user = await prisma.user.findUnique({ where: { username } });
  // Always respond OK — don't leak whether username exists
  if (!user || !user.passwordHash) return;

  const token = crypto.randomBytes(32).toString('hex');
  const exp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExp: exp },
  });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: `${user.fullName} <${user.username}>`, // username here is email if applicable
    subject: 'Reset your Milky Quiz password',
    html: `
      <p>Hi ${user.fullName},</p>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <a href="${resetUrl}" style="color:#7c6af7">Reset Password</a>
      <p>If you didn't request this, ignore this email.</p>
    `,
  });
};

// ─── Reset Password ──────────────────────────────────────────
export const resetPassword = async (input: ResetPasswordInput) => {
  const user = await prisma.user.findFirst({
    where: {
      resetToken: input.token,
      resetTokenExp: { gt: new Date() },
    },
  });

  if (!user) throw new AppError('Invalid or expired reset token', 400);

  const passwordHash = await hashPassword(input.password);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExp: null },
  });
};
