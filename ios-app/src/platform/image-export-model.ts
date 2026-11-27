export interface ImageExportInput {
  width: number;
  height: number;
  format?: 'png' | 'jpg';
  quality?: number;
}
export function imageExportPlan({ width, height, format = 'png', quality = 0.9 }: ImageExportInput) {
  const limit = 16_000_000;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > limit / height ||
    !Number.isFinite(quality) ||
    quality < 0 ||
    quality > 1 ||
    !['png', 'jpg'].includes(format)
  )
    throw new Error('حجم الصورة أو إعدادات تصديرها غير صالحة.');
  // The pinned native SVG patch uses exact pixels for explicit export bounds.
  // Keep integer geometry unchanged, including coprime aspect ratios.
  return {
    width,
    height,
    renderWidth: width,
    renderHeight: height,
    format,
    quality,
    mimeType: format === 'jpg' ? 'image/jpeg' : 'image/png',
  };
}
