export interface SelectedDocument {
  uri: string;
  name: string;
  size: number;
  mimeType?: string;
}
export function exportFilename(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 255 &&
    value !== '.' &&
    value !== '..' &&
    !/[\u0000-\u001f/\\:]/.test(value)
  );
}
export function documentPart(asset: SelectedDocument): { uri: string; name: string; type: string } {
  const url = new URL(asset.uri);
  if (
    url.protocol !== 'file:' ||
    url.hostname ||
    url.search ||
    url.hash ||
    !Number.isSafeInteger(asset.size) ||
    asset.size < 0 ||
    asset.size > 50 * 1024 * 1024 ||
    !asset.name ||
    asset.name.length > 255 ||
    /[\u0000\r\n/\\]/.test(asset.name)
  )
    throw new Error('الملف غير متاح أو يتجاوز الحد المسموح وهو ٥٠ ميغابايت.');
  if (asset.mimeType && !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(asset.mimeType))
    throw new Error('نوع الملف غير صالح.');
  return { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' };
}
export function safeArchivePath(path: string): string {
  if (
    !path ||
    path.length > 1024 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    /[\u0000-\u001f:]/.test(path) ||
    path.split('/').some((segment) => !segment || segment === '.' || segment === '..' || segment.length > 255)
  )
    throw new Error('مسار ملف الأرشيف غير صالح.');
  return path;
}
export function validateArchiveEntries(files: readonly { filename: string }[], maxFiles = 200): void {
  if (!files.length || files.length > maxFiles) throw new Error('قائمة الملفات غير صالحة.');
  const names = new Set(files.map(file => safeArchivePath(file.filename).normalize('NFC').toLocaleLowerCase('en-US')));
  const conflict = 'تتعارض أسماء بعض الملفات. نزّلها منفردة للحفاظ عليها.';
  if (names.size !== files.length) throw new Error(conflict);
  for (const name of names) {
    for (let slash = name.indexOf('/'); slash !== -1; slash = name.indexOf('/', slash + 1)) {
      if (names.has(name.slice(0, slash))) throw new Error(conflict);
    }
  }
}
export class ArchiveBudgetError extends Error {
  constructor() {
    super('لا توجد مساحة كافية لتجميع الملفات. نزّل مجموعة أصغر.');
  }
}
export async function collectArchive<T extends { filename: string }>(
  files: readonly T[],
  port: { download(item: T, remaining: number): Promise<number>; remove(item: T): Promise<void> },
  options: { allowPartial: boolean; maxBytes: number; onProgress?(percent: number): void },
): Promise<{ failed: string[]; completed: number; bytes: number }> {
  const failed: string[] = [];
  let completed = 0,
    bytes = 0,
    attempted = 0;
  for (const item of files) {
    try {
      const remaining = options.maxBytes - bytes;
      const size = await port.download(item, remaining);
      if (size > remaining) throw new ArchiveBudgetError();
      bytes += size;
      completed++;
    } catch (error) {
      await port.remove(item);
      if (!options.allowPartial || error instanceof ArchiveBudgetError) throw error;
      failed.push(item.filename);
    } finally {
      attempted++;
      options.onProgress?.(Math.round((attempted / files.length) * 100));
    }
  }
  if (!completed) throw new Error('تعذر تنزيل جميع الملفات. لم يتم إنشاء أرشيف فارغ.');
  return { failed, completed, bytes };
}
