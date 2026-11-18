const MAX_SIDE = 2000;
const SKIP_BELOW_BYTES = 1_500_000;

export function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Shrinks photos in the browser before upload: modern phone cameras produce files over the
 * API's 10 MB limit, and sending 1 MB instead of 12 MB is faster on mobile data. The server
 * still re-encodes everything; this only makes the upload fit and fly.
 * Falls back to the original file when the browser can't decode it (e.g. HEIC outside Safari).
 */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_SIDE);
  if (file.size <= SKIP_BELOW_BYTES && width === bitmap.width) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob) return file;
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
}
