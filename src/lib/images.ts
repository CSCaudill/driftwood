import type { Photo } from '../types';

const MAX_EDGE = 2048;
const THUMB_EDGE = 560;

export type ProcessedPhoto = Omit<Photo, 'id' | 'memoryId' | 'createdAt'>;

/**
 * Downscale and re-encode an image picked by the user, and read its EXIF
 * capture date so we can suggest a date for the memory.
 * On iOS the system picker already converts HEIC to JPEG.
 */
export async function processImage(file: File): Promise<ProcessedPhoto> {
  const [bitmap, takenAt] = await Promise.all([decode(file), readTakenAt(file)]);
  const full = await encode(bitmap, MAX_EDGE, 0.86);
  const thumb = await encode(bitmap, THUMB_EDGE, 0.8);
  const result = { blob: full.blob, thumb: thumb.blob, width: full.width, height: full.height, takenAt };
  if ('close' in bitmap) bitmap.close();
  return result;
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Fallback through an <img> element for browsers that can't decode directly.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return await createImageBitmap(img);
    } catch {
      throw new Error(`“${file.name}” couldn't be opened. Try a JPEG or PNG.`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

async function encode(bitmap: ImageBitmap, maxEdge: number, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality),
  );
  return { blob, width, height };
}

async function readTakenAt(file: File): Promise<string | null> {
  try {
    const { parse } = await import('exifr');
    const data = await parse(file, ['DateTimeOriginal', 'CreateDate']);
    const d: Date | undefined = data?.DateTimeOriginal ?? data?.CreateDate;
    if (d instanceof Date && !Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  } catch {
    /* no EXIF — that's fine */
  }
  return null;
}

/** Square, center-cropped avatar for a person. */
export async function processAvatar(file: File, size = 320): Promise<Blob> {
  const bitmap = await decode(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  if ('close' in bitmap) bitmap.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', 0.85),
  );
}
