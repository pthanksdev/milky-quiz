import { prisma } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { uploadBuffer, deleteAsset } from '../../utils/cloudinary';
import type { UpdateProfileInput } from './user.schema';

const safeSelect = {
  id: true,
  fullName: true,
  username: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: safeSelect });
  if (!user) throw new AppError('User not found', 404);
  return user;
};

export const updateMe = async (userId: string, input: UpdateProfileInput) => {
  if (input.username) {
    const conflict = await prisma.user.findFirst({
      where: { username: input.username, NOT: { id: userId } },
    });
    if (conflict) throw new AppError('Username already taken', 409);
  }

  return prisma.user.update({
    where: { id: userId },
    data: input,
    select: safeSelect,
  });
};

export const updateAvatar = async (userId: string, buffer: Buffer) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404);

  // Delete old avatar from Cloudinary if exists
  if (user.avatarPublicId) {
    await deleteAsset(user.avatarPublicId);
  }

  const { url, publicId } = await uploadBuffer(buffer, 'milky-quiz/avatars');

  return prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: url, avatarPublicId: publicId },
    select: safeSelect,
  });
};
