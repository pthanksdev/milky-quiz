import { Readable } from 'stream';
import cloudinary from '../config/cloudinary';

export type CloudinaryFolder =
  | 'milky-quiz/avatars'
  | 'milky-quiz/covers'
  | 'milky-quiz/questions'
  | 'milky-quiz/documents';

export interface UploadResult {
  url: string;
  publicId: string;
}

/**
 * Upload a buffer (from Multer memory storage) to Cloudinary.
 * Streams the buffer — no temp disk write.
 */
export const uploadBuffer = (
  buffer: Buffer,
  folder: CloudinaryFolder,
  resourceType: 'image' | 'raw' = 'image',
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Upload failed'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    Readable.from(buffer).pipe(uploadStream);
  });
};

/**
 * Delete an asset from Cloudinary by its public_id.
 * Called when a user replaces an existing image.
 */
export const deleteAsset = (publicId: string, resourceType: 'image' | 'raw' = 'image') =>
  cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
