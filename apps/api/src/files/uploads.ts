import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import type { StoredExt } from './file-storage.js';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif']);

/**
 * Re-encodes images to WebP (max 1600px). Re-encoding drops all metadata, so EXIF
 * GPS from the owner's phone never reaches the server's disk or other users.
 * File type comes from the bytes, never from the client's filename or mimetype.
 */
export async function prepareUpload(
  file: Express.Multer.File | undefined,
  { allowPdf }: { allowPdf: boolean },
): Promise<{ data: Buffer; ext: StoredExt }> {
  if (!file) throw new BadRequestException('A file is required (multipart field "file")');
  const { buffer } = file;

  if (allowPdf && buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return { data: buffer, ext: 'pdf' };
  }
  const format = await sharp(buffer)
    .metadata()
    .then((m) => m.format)
    .catch(() => undefined);
  if (!format || !IMAGE_FORMATS.has(format)) {
    throw new BadRequestException(
      allowPdf ? 'File must be an image or a PDF' : 'File must be an image',
    );
  }
  const data = await sharp(buffer)
    .rotate() // apply EXIF orientation before it is dropped
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  return { data, ext: 'webp' };
}
