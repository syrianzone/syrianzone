export interface ImageUploadAsset { uri: string; fileName?: string | null; mimeType?: string | null; fileSize?: number; width?: number; height?: number }
export interface ImageUploadBounds { maxBytes: number; minWidth?: number; minHeight?: number; maxWidth?: number; maxHeight?: number }
export function imageUploadPart(asset: ImageUploadAsset, bounds: ImageUploadBounds): { uri: string; name: string; type: string } {
  const url = new URL(asset.uri);
  if (url.protocol !== 'file:' || url.hostname || url.search || url.hash || !Number.isFinite(asset.fileSize) || !asset.fileSize || asset.fileSize < 1 || asset.fileSize > bounds.maxBytes) throw new Error('الصورة غير متاحة أو حجمها أكبر من الحد المسموح.');
  for (const [value, min, max] of [[asset.width, bounds.minWidth, bounds.maxWidth], [asset.height, bounds.minHeight, bounds.maxHeight]]) {
    if ((min !== undefined || max !== undefined) && (typeof value !== 'number' || !Number.isFinite(value) || (min !== undefined && value < min) || (max !== undefined && value > max))) throw new Error('أبعاد الصورة غير مناسبة.');
  }
  const extension = url.pathname.split('.').pop()?.toLowerCase();
  const type = asset.mimeType?.toLowerCase() || ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[extension ?? '']);
  if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('اختر صورة JPG أو PNG أو WebP.');
  const suffix = type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'webp';
  const name = (asset.fileName ?? 'image').replace(/\.[^.]*$/, '').replace(/[^\p{L}\p{N}_. -]/gu, '_').slice(0, 100) || 'image';
  return { uri: asset.uri, name: `${name}.${suffix}`, type };
}
