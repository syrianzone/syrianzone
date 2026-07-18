import type { PlaceCategory } from './types';

export const MAX_PLACE_PHOTOS = 10;
export const MAX_PLACE_PHOTO_BYTES = 12 * 1024 * 1024;

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const mimeByExtension: Readonly<Record<string, string>> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export interface PickedPhotoCandidate {
  fileName?: string | null;
  fileSize?: number;
  height?: number;
  mimeType?: string | null;
  uri: string;
  width?: number;
}

export interface PlacePhotoUpload {
  fileName: string;
  fileSize: number;
  mimeType: string;
  uri: string;
}

interface PlaceSubmissionInput {
  category: PlaceCategory | null;
  description: string;
  name: string;
  photos: readonly PlacePhotoUpload[];
}

function extensionOf(value: string): string | null {
  const clean = value.split(/[?#]/, 1)[0] ?? '';
  const match = clean.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function fileNameOf(candidate: PickedPhotoCandidate, index: number): string {
  if (candidate.fileName?.trim()) {
    return candidate.fileName.trim();
  }

  const rawName = candidate.uri.split(/[/?#]/).filter(Boolean).at(-1);
  if (rawName) {
    try {
      return decodeURIComponent(rawName);
    } catch {
      return rawName;
    }
  }

  const extension = extensionOf(candidate.uri) ?? 'jpg';
  return `place-photo-${index + 1}.${extension}`;
}

function mimeTypeOf(candidate: PickedPhotoCandidate, fileName: string): string | null {
  const provided = candidate.mimeType?.toLowerCase();
  if (provided === 'image/jpg') {
    return 'image/jpeg';
  }
  if (provided) {
    return provided;
  }

  const extension = extensionOf(fileName) ?? extensionOf(candidate.uri);
  return extension ? (mimeByExtension[extension] ?? null) : null;
}

export function mergePickedPhotos(
  current: readonly PlacePhotoUpload[],
  picked: readonly PickedPhotoCandidate[],
  max = MAX_PLACE_PHOTOS,
): { errors: string[]; photos: PlacePhotoUpload[] } {
  const errors: string[] = [];
  const photos = [...current];
  const knownUris = new Set(current.map((photo) => photo.uri));

  for (const [index, candidate] of picked.entries()) {
    if (knownUris.has(candidate.uri)) {
      continue;
    }
    if (photos.length >= max) {
      errors.push(`الحد الأقصى ${max} صور.`);
      break;
    }

    const fileName = fileNameOf(candidate, index);
    const mimeType = mimeTypeOf(candidate, fileName);
    if (!mimeType || !allowedMimeTypes.has(mimeType)) {
      errors.push(`الصورة ${fileName} ليست بصيغة JPEG أو PNG أو WebP.`);
      continue;
    }
    if (!candidate.fileSize || candidate.fileSize < 0) {
      errors.push(`تعذر التحقق من حجم الصورة ${fileName}.`);
      continue;
    }
    if (candidate.fileSize > MAX_PLACE_PHOTO_BYTES) {
      errors.push(`الصورة ${fileName} تتجاوز 12 ميغابايت.`);
      continue;
    }
    if (
      candidate.width !== undefined &&
      candidate.height !== undefined &&
      (candidate.width < 200 || candidate.height < 200)
    ) {
      errors.push(`الصورة ${fileName} أصغر من 200x200 بكسل.`);
      continue;
    }
    if (
      candidate.width !== undefined &&
      candidate.height !== undefined &&
      (candidate.width > 6000 || candidate.height > 6000)
    ) {
      errors.push(`الصورة ${fileName} تتجاوز 6000x6000 بكسل.`);
      continue;
    }

    photos.push({
      fileName,
      fileSize: candidate.fileSize,
      mimeType,
      uri: candidate.uri,
    });
    knownUris.add(candidate.uri);
  }

  return { errors, photos };
}

export function validatePlaceSubmission(
  input: PlaceSubmissionInput,
): string | null {
  const name = input.name.trim();
  if (name.length === 0 || name.length > 160) {
    return 'أدخل اسم المكان، بحد أقصى 160 حرفاً.';
  }
  if (!input.category) {
    return 'اختر تصنيف المكان.';
  }

  const description = input.description.trim();
  if (description.length < 20 || description.length > 1000) {
    return 'الوصف يجب أن يكون بين 20 و1000 حرف.';
  }
  if (
    input.photos.length < 1 ||
    input.photos.length > MAX_PLACE_PHOTOS
  ) {
    return 'أضف من صورة واحدة إلى 10 صور.';
  }

  return null;
}
