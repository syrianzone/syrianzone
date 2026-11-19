import { Directory, File, FileMode, Paths, type FileHandle } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { requireNativeModule } from 'expo';
import { fetch as expoFetch } from 'expo/fetch';
import { randomUUID } from 'expo-crypto';
import { ArchiveBudgetError, collectArchive, exportFilename, safeArchivePath, validateArchiveEntries } from './document-model';
import { imageExportPlan } from './image-export-model';
import { prepareExportFile } from './file-export-flow';
import { namedExportLocation } from './export-location';

interface NativeFiles {
  zip(directory: string): Promise<string>;
  imageDataUri(file: string): Promise<string>;
  preview(file: string, title: string): Promise<void>;
  encodeImage(file: string, width: number, height: number, format: string, quality: number): Promise<string>;
}
function nativeFiles(): NativeFiles {
  return requireNativeModule<NativeFiles>('SyrianFiles');
}
function downloadUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('رابط الملف غير صالح.');
  return url.toString();
}
function validFilename(value: string): boolean {
  return /^[\p{L}\p{N}_. -]{1,128}$/u.test(value) && !value.startsWith('.') && value.includes('.');
}
function exportTarget(filename: string): { directory: Directory; file: File } {
  const location = namedExportLocation(filename, randomUUID());
  const directory = new Directory(Paths.cache, location.directory);
  directory.create();
  return { directory, file: new File(directory, location.filename) };
}

export async function downloadImageDataUri(url: string): Promise<string> {
  const file = new File(Paths.cache, `sz-image-${randomUUID()}`);
  try {
    await File.downloadFileAsync(downloadUrl(url), file);
    return await nativeFiles().imageDataUri(file.uri);
  } finally {
    if (file.exists) file.delete();
  }
}

async function stageArchiveFile(url: string, file: File, remaining: number): Promise<number> {
  const controller = new AbortController();
  const timeout = new Error('انتهت مهلة تنزيل ملف الأرشيف.');
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  function refreshIdleTimer(): void {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(timeout), 60_000);
  }
  let reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>> | undefined;
  let handle: FileHandle | undefined;
  try {
    refreshIdleTimer();
    const response = await expoFetch(downloadUrl(url), { signal: controller.signal });
    if (controller.signal.aborted) throw timeout;
    refreshIdleTimer();
    if (!response.ok) throw new Error('تعذّر تنزيل ملف الأرشيف.');
    if (response.url) downloadUrl(response.url);
    reader = response.body?.getReader();
    file.create();
    if (!reader) return 0;
    handle = file.open(FileMode.WriteOnly);

    let size = 0;
    for (;;) {
      const chunk = await reader.read();
      if (controller.signal.aborted) throw timeout;
      if (chunk.done) break;
      const bytes = chunk.value.byteLength;
      if (bytes > remaining - size) throw new ArchiveBudgetError();
      if (bytes > 0) refreshIdleTimer();
      await handle.writeBytes(chunk.value);
      size += bytes;
    }
    handle.close();
    return size;
  } catch (error) {
    const failure = controller.signal.aborted ? timeout : error;
    controller.abort();
    try { handle?.close(); } catch { /* Keep the download error. */ }
    await reader?.cancel().catch(() => {});
    throw failure;
  } finally {
    clearTimeout(idleTimer);
    reader?.releaseLock();
  }
}

export interface ZipOptions {
  preservePaths?: boolean;
  allowPartial?: boolean;
  onProgress?(percent: number): void;
}
export interface ZipResult {
  failed: string[];
  completed: number;
  bytes: number;
}
export function shareZipFiles(
  files: readonly { url: string; filename: string }[],
  archiveName: string,
): Promise<void>;
export function shareZipFiles(
  files: readonly { url: string; filename: string }[],
  archiveName: string,
  options: ZipOptions,
): Promise<ZipResult>;
export async function shareZipFiles(
  files: readonly { url: string; filename: string }[],
  archiveName: string,
  options?: ZipOptions,
): Promise<void | ZipResult> {
  if (!validFilename(archiveName) || !archiveName.toLowerCase().endsWith('.zip'))
    throw new Error('قائمة الملفات غير صالحة.');
  validateArchiveEntries(files, options?.preservePaths ? files.length : 200);
  for (const file of files) {
    if (!options?.preservePaths && !validFilename(file.filename)) throw new Error('اسم الملف غير صالح.');
    downloadUrl(file.url);
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error('المشاركة غير متاحة على هذا الجهاز.');
  const staging = new Directory(Paths.cache, `sz-zip-${randomUUID()}`);
  const directory = new Directory(staging, archiveName.slice(0, -4));
  let archive: File | null = null;
  let sharedDirectory: Directory | null = null;
  let completed = false;
  staging.create();
  try {
    directory.create();
    function target(filename: string): File {
      const parts = safeArchivePath(filename).split('/'),
        name = parts.pop();
      if (!name) throw new Error('اسم الملف غير صالح.');
      const parent = parts.length ? new Directory(directory, ...parts) : directory;
      if (!parent.exists) parent.create({ intermediates: true });
      return new File(parent, name);
    }
    const result = await collectArchive(
      files,
      {
        download: (item, remaining) => stageArchiveFile(item.url, target(item.filename), remaining),
        remove: async (item) => {
          const file = target(item.filename);
          if (file.exists) file.delete();
        },
      },
      {
        allowPartial: options?.allowPartial ?? false,
        maxBytes: options?.preservePaths
          ? Math.max(0, Math.floor(Paths.availableDiskSpace / 3))
          : 100_000_000,
        ...(options?.onProgress ? { onProgress: options.onProgress } : {}),
      },
    );
    archive = new File(await nativeFiles().zip(directory.uri));
    const shared = exportTarget(archiveName);
    sharedDirectory = shared.directory;
    await archive.move(shared.file);
    await Sharing.shareAsync(archive.uri, { mimeType: 'application/zip', dialogTitle: archiveName });
    completed = true;
    if (options) return result;
  } finally {
    let cleanupFailure: { error: unknown } | undefined;
    for (const entry of [archive, sharedDirectory, staging]) {
      try {
        if (entry?.exists) entry.delete();
      } catch (error) {
        cleanupFailure ??= { error };
      }
    }
    if (completed && cleanupFailure) throw cleanupFailure.error;
  }
}

export async function previewFile({ url, filename }: { url: string; filename: string }): Promise<void> {
  const name = filename.replace(/[\u0000-\u001f/\\:]/g, '_').slice(-128) || 'file';
  const file = new File(Paths.cache, `sz-preview-${randomUUID()}-${name}`);
  try {
    await File.downloadFileAsync(downloadUrl(url), file);
    if (file.size > 50 * 1024 * 1024) throw new Error('الملف أكبر من حد المعاينة، نزّله إلى تطبيق الملفات.');
    await nativeFiles().preview(file.uri, filename.slice(0, 255));
  } finally {
    if (file.exists) file.delete();
  }
}

export interface SvgExportView {
  toDataURL(callback: (base64: string) => void, options?: object): void;
}
export interface SvgImageOptions {
  width: number;
  height: number;
  signal?: AbortSignal;
  format?: 'png' | 'jpg';
  quality?: number;
}
function ensureImageActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('تم إلغاء تجهيز الصورة.');
}
export async function createSvgImageFile(
  svg: SvgExportView,
  { width, height, signal, format, quality }: SvgImageOptions,
): Promise<{ file: File; mimeType: string }> {
  const plan = imageExportPlan({
    width,
    height,
    ...(format ? { format } : {}),
    ...(quality !== undefined ? { quality } : {}),
  });
  ensureImageActive(signal);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let aborted: (() => void) | undefined;
  let base64: string;
  try {
    base64 = await new Promise<string>((resolve, reject) => {
      aborted = () => reject(new Error('تم إلغاء تجهيز الصورة.'));
      signal?.addEventListener('abort', aborted, { once: true });
      timer = setTimeout(() => reject(new Error('انتهت مهلة تجهيز الصورة. حاول مجدداً.')), 15_000);
      svg.toDataURL(
        (value) => {
          if (value) resolve(value);
          else reject(new Error('تعذر تجهيز الصورة.'));
        },
        { width: plan.renderWidth, height: plan.renderHeight },
      );
    });
  } finally {
    if (timer) clearTimeout(timer);
    if (aborted) signal?.removeEventListener('abort', aborted);
  }
  ensureImageActive(signal);
  const source = new File(Paths.cache, `sz-svg-${randomUUID()}.png`);
  source.create();
  const image = await prepareExportFile(
    {
      write: () => source.write(base64, { encoding: 'base64' }),
      encode: async () => {
        try {
          return new File(
            await nativeFiles().encodeImage(source.uri, width, height, plan.format, plan.quality),
          );
        } catch (cause) {
          throw new Error('تعذر إنشاء ملف الصورة. جرّب حجماً أصغر.', { cause });
        }
      },
      removeSource: () => {
        if (source.exists) source.delete();
      },
      removeOutput: (output) => {
        if (output.exists) output.delete();
      },
    },
    () => signal?.aborted ?? false,
  );
  return { file: image, mimeType: plan.mimeType };
}

export async function shareSvgImage(
  svg: SvgExportView,
  { filename, ...options }: SvgImageOptions & { filename: string },
): Promise<void> {
  if (!exportFilename(filename)) throw new Error('اسم الملف غير صالح.');
  if (!(await Sharing.isAvailableAsync())) throw new Error('المشاركة غير متاحة على هذا الجهاز.');
  const rendered = await createSvgImageFile(svg, options);
  let sharedDirectory: Directory | null = null;
  try {
    const shared = exportTarget(filename);
    sharedDirectory = shared.directory;
    await rendered.file.move(shared.file);
    if (options.signal?.aborted) throw new Error('تم إلغاء المشاركة.');
    await Sharing.shareAsync(rendered.file.uri, { mimeType: rendered.mimeType, dialogTitle: filename });
  } finally {
    if (rendered.file.exists) rendered.file.delete();
    if (sharedDirectory?.exists) sharedDirectory.delete();
  }
}

export function shareSvgPng(
  svg: SvgExportView,
  options: { filename: string; width: number; height: number; signal?: AbortSignal },
): Promise<void> {
  return shareSvgImage(svg, { ...options, format: 'png' });
}

export async function shareFile({
  url,
  text,
  base64,
  filename,
  mimeType,
  signal,
}: {
  url?: string;
  text?: string;
  base64?: string;
  filename: string;
  mimeType: string;
  signal?: AbortSignal;
}): Promise<void> {
  if (signal?.aborted) throw new Error('تم إلغاء المشاركة.');
  if (!exportFilename(filename)) throw new Error('اسم الملف غير صالح.');
  if ([url, text, base64].filter((value) => value !== undefined).length !== 1)
    throw new Error('بيانات الملف غير صالحة.');
  if (!(await Sharing.isAvailableAsync())) throw new Error('المشاركة غير متاحة على هذا الجهاز.');
  const { directory, file } = exportTarget(filename);
  try {
    if (url !== undefined) {
      await File.downloadFileAsync(downloadUrl(url), file, { idempotent: true });
    } else {
      file.create({ overwrite: true });
      if (base64 !== undefined) await file.write(base64, { encoding: 'base64' });
      else await file.write(text ?? '');
    }
    if (signal?.aborted) throw new Error('تم إلغاء المشاركة.');
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
  } finally {
    if (file.exists) file.delete();
    if (directory.exists) directory.delete();
  }
}
