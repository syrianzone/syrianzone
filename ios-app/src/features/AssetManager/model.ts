import { normalizeSearch } from '../../domain';
import { safeArchivePath } from '../../platform/document-model';
import { array, integer, record, text } from '../../platform/validation';
export interface ManagedAsset {
  path: string;
  filename: string;
  folder: string;
  size: number;
  last_modified: number | null;
  url: string;
}
export interface AssetPage {
  files: ManagedAsset[];
  totalSize: number;
  hasMore: boolean;
  cursor: string | null;
}
export function decodeAsset(value: unknown): ManagedAsset {
  const row = record(value),
    path = safeArchivePath(text(row.path)),
    size = integer(row.size),
    url = new URL(text(row.url));
  if (size < 0 || url.protocol !== 'https:' || url.username || url.password)
    throw new Error('بيانات الملف غير صالحة.');
  return {
    path,
    filename: text(row.filename),
    folder: text(row.folder, 'root'),
    size,
    last_modified: row.last_modified == null ? null : integer(row.last_modified),
    url: url.toString(),
  };
}
export function decodeAssetPage(value: unknown): AssetPage {
  const row = record(value);
  if (row.success !== true || typeof row.has_more !== 'boolean') throw new Error('تعذر قراءة قائمة الملفات.');
  const files = array(row.files).map(decodeAsset),
    cursor = row.next_cursor == null ? null : text(row.next_cursor);
  if (row.has_more && !cursor) throw new Error('مؤشر الصفحة التالية غير صالح.');
  return { files, totalSize: files.reduce((sum, file) => sum + file.size, 0), hasMore: row.has_more, cursor };
}
export function mergeAssetPage(previous: AssetPage | null, page: AssetPage): AssetPage {
  const files = Array.from(
    new Map([...(previous?.files ?? []), ...page.files].map((file) => [file.path, file])).values(),
  );
  return { ...page, files, totalSize: files.reduce((sum, file) => sum + file.size, 0) };
}
export function assetFolders(files: readonly ManagedAsset[]): { value: string; label: string }[] {
  const folders = new Map<string, number>();
  for (const file of files) folders.set(file.folder, (folders.get(file.folder) ?? 0) + 1);
  return [
    { value: '', label: `كل المجلدات (${files.length})` },
    ...Array.from(folders)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, count]) => ({ value, label: `${value} (${count})` })),
  ];
}
export function assetMatches(file: ManagedAsset, query: string, folder: string): boolean {
  return (
    (!folder || file.folder === folder) &&
    normalizeSearch(`${file.filename} ${file.path}`).includes(normalizeSearch(query))
  );
}
export function assetIsImage(filename: string): boolean {
  return /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(filename);
}
export function formatBytes(value: number): string {
  return value < 1024
    ? `${value} B`
    : value < 1024 * 1024
      ? `${(value / 1024).toFixed(1)} KB`
      : value < 1024 * 1024 * 1024
        ? `${(value / 1024 / 1024).toFixed(1)} MB`
        : `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
