import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as documentModel from './document-model';
import * as exportLocation from './export-location';
import * as exportFlow from './file-export-flow';
import * as imageModel from './image-export-model';
import type { shareZipFiles } from './files';

const code = ts.transpileModule(readFileSync(new URL('./files.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const files = [{ url: 'https://example.com/tile.png', filename: 'tile.png' }];

interface Download {
  chunks: number[];
  failAfter?: number;
  status?: number;
  finalUrl?: string;
  bodyless?: boolean;
  headerDelay?: number;
  chunkDelays?: number[];
}

function zipFixture(options: {
  failCreation?: boolean;
  failDeletion?: 'file' | 'directory';
  failShare?: boolean;
  availableDiskSpace?: number;
  downloads?: Record<string, Download>;
}) {
  const cache = 'file:///cache';
  const id = '00000000-0000-4000-8000-000000000000';
  const shared = `${cache}/sz-export-${id}`;
  const entries = new Set<string>();
  const writes: [string, number][] = [];
  const closed: string[] = [], aborted: string[] = [], canceled: string[] = [], released: string[] = [];
  const archived: string[][] = [];
  const creationFailure = new Error('directory creation failed');
  const deletionFailure = new Error('temporary deletion failed');
  const shareFailure = new Error('sharing failed');
  const downloadFailure = new Error('download failed');
  const download = (url: string) => options.downloads?.[new URL(url).pathname] ?? { chunks: [10] };
  const timeouts = new Map<number, { at: number; callback(): void }>();
  let now = 0, nextTimeout = 0;
  function advance(ms: number): void {
    now += ms;
    for (const [timer, task] of timeouts) {
      if (task.at > now) continue;
      timeouts.delete(timer);
      task.callback();
    }
  }

  class Entry {
    uri: string;
    constructor(parent: string | Entry, ...parts: string[]) {
      this.uri = [typeof parent === 'string' ? parent : parent.uri, ...parts].join('/');
    }
    get exists(): boolean {
      return entries.has(this.uri);
    }
    create(): void {
      if (options.failCreation && this.uri.endsWith('/bundle')) throw creationFailure;
      entries.add(this.uri);
    }
    delete(): void {
      if (options.failDeletion === 'file' && this.uri === `${shared}/bundle.zip`) throw deletionFailure;
      if (options.failDeletion === 'directory' && this.uri === shared) throw deletionFailure;
      for (const entry of entries) {
        if (entry === this.uri || entry.startsWith(`${this.uri}/`)) entries.delete(entry);
      }
    }
  }

  class NativeFile extends Entry {
    size = 0;
    get name(): string { return this.uri.split('/').at(-1)!; }
    static async downloadFileAsync(url: string, file: NativeFile): Promise<NativeFile> {
      const response = download(url), status = response.status ?? 200;
      if (status < 200 || status >= 300) throw downloadFailure;
      file.create();
      file.size = response.chunks.reduce((sum, size) => sum + size, 0);
      writes.push([file.name, file.size]);
      if (response.failAfter !== undefined) throw downloadFailure;
      return file;
    }
    open() {
      return {
        writeBytes: async (chunk: Uint8Array) => { this.size += chunk.byteLength; writes.push([this.name, chunk.byteLength]); },
        close: () => { closed.push(this.name); },
      };
    }
    async move(file: NativeFile): Promise<void> {
      entries.delete(this.uri);
      this.uri = file.uri;
      entries.add(this.uri);
    }
  }

  const imports = {
    'expo-file-system': { Directory: Entry, File: NativeFile, FileMode: { WriteOnly: 'w' }, Paths: { cache, availableDiskSpace: options.availableDiskSpace ?? 300 } },
    'expo/fetch': { fetch: async (url: string, init: { signal: AbortSignal }) => {
      const pathname = new URL(url).pathname;
      const response = download(url), status = response.status ?? 200;
      init.signal.addEventListener('abort', () => { aborted.push(pathname); });
      advance(response.headerDelay ?? 0);
      if (init.signal.aborted) throw downloadFailure;
      let index = 0;
      return { ok: status >= 200 && status < 300, status, url: response.finalUrl ?? url,
        body: response.bodyless ? null : { getReader: () => ({
          read: async () => {
            advance(response.chunkDelays?.[index] ?? 0);
            if (init.signal.aborted) throw downloadFailure;
            if (index === response.failAfter) throw downloadFailure;
            if (index >= response.chunks.length) return { done: true };
            return { done: false, value: new Uint8Array(response.chunks[index++]!) };
          },
          cancel: async () => { canceled.push(pathname); },
          releaseLock: () => { released.push(pathname); },
        }) },
      };
    } },
    'expo-sharing': {
      isAvailableAsync: async () => true,
      shareAsync: async () => {
        if (options.failShare) throw shareFailure;
      },
    },
    expo: {
      requireNativeModule: () => ({
        zip: async (directory: string) => {
          archived.push([...entries].filter(path => path.startsWith(`${directory}/`)));
          const uri = `${cache}/native.zip`;
          entries.add(uri);
          return uri;
        },
      }),
    },
    'expo-crypto': { randomUUID: () => id },
    './document-model': documentModel,
    './export-location': exportLocation,
    './file-export-flow': exportFlow,
    './image-export-model': imageModel,
  };
  const exports = {} as { shareZipFiles: typeof shareZipFiles };
  runInNewContext(code, {
    exports,
    URL,
    AbortController,
    setTimeout: (callback: () => void, delay: number) => { const key = ++nextTimeout; timeouts.set(key, { callback, at: now + delay }); return key; },
    clearTimeout: (key: number) => { timeouts.delete(key); },
    require: (name: keyof typeof imports) => imports[name],
  });
  return { ...exports, entries, shared, creationFailure, deletionFailure, shareFailure, writes, closed, aborted, canceled, released, archived, timeouts };
}

test('a ZIP staging subdirectory creation failure removes the owned staging root', async () => {
  const app = zipFixture({ failCreation: true });
  await expect(app.shareZipFiles(files, 'bundle.zip')).rejects.toBe(app.creationFailure);
  expect(app.entries.size).toBe(0);
});

test('a ZIP file deletion failure still removes the share and staging directories', async () => {
  const app = zipFixture({ failDeletion: 'file' });
  await expect(app.shareZipFiles(files, 'bundle.zip')).rejects.toBe(app.deletionFailure);
  expect(app.entries.size).toBe(0);
});

test('a ZIP share failure keeps its error when the share directory cannot be removed', async () => {
  const app = zipFixture({
    failDeletion: 'directory',
    failShare: true,
  });
  await expect(app.shareZipFiles(files, 'bundle.zip')).rejects.toBe(app.shareFailure);
  expect([...app.entries]).toEqual([app.shared]);
});

test('ZIP stops before writing a chunk that would exceed the shared disk allowance', async () => {
  const app = zipFixture({ availableDiskSpace: 30, downloads: { '/first.bin': { chunks: [4] }, '/second.bin': { chunks: [5, 2, 1] } } });
  const entries = ['first.bin', 'second.bin'].map(filename => ({ url: `https://example.com/${filename}`, filename }));
  await expect(app.shareZipFiles(entries, 'bundle.zip', { preservePaths: true, allowPartial: true })).rejects.toThrow('لا توجد مساحة كافية');
  expect(app.writes).toEqual([['first.bin', 4], ['second.bin', 5]]);
  expect(app.aborted).toEqual(['/second.bin']);
  expect(app.canceled).toEqual(['/second.bin']);
  expect(app.closed).toEqual(['first.bin', 'second.bin']);
  expect(app.released).toEqual(['/first.bin', '/second.bin']);
  expect(app.archived).toHaveLength(0);
  expect(app.entries.size).toBe(0);
});

test('a partial ZIP skips failed downloads, reuses their space, and accepts a valid empty file', async () => {
  const app = zipFixture({ availableDiskSpace: 30, downloads: {
    '/missing.bin': { status: 404, chunks: [1] }, '/broken.bin': { chunks: [5], failAfter: 1 },
    '/empty.bin': { status: 204, chunks: [], bodyless: true }, '/ready.bin': { chunks: [8, 2], finalUrl: 'https://cdn.example.com/ready.bin' },
  } });
  const entries = ['missing.bin', 'broken.bin', 'empty.bin', 'ready.bin'].map(filename => ({ url: `https://example.com/${filename}`, filename }));
  const progress: number[] = [];
  expect(await app.shareZipFiles(entries, 'bundle.zip', { preservePaths: true, allowPartial: true, onProgress: value => progress.push(value) }))
    .toEqual({ failed: ['missing.bin', 'broken.bin'], completed: 2, bytes: 10 });
  expect(app.writes).toEqual([['broken.bin', 5], ['ready.bin', 8], ['ready.bin', 2]]);
  expect(app.archived[0]?.map(path => path.split('/').at(-1))).toEqual(['empty.bin', 'ready.bin']);
  expect(app.aborted).toEqual(['/missing.bin', '/broken.bin']);
  expect(app.canceled).toEqual(['/broken.bin']);
  expect(app.closed).toEqual(['broken.bin', 'ready.bin']);
  expect(progress).toEqual([25, 50, 75, 100]);
  expect(app.entries.size).toBe(0);
});

test('ZIP refreshes the idle timeout on incoming data and skips timed-out entries in partial mode', async () => {
  const app = zipFixture({ downloads: {
    '/active.bin': { chunks: [4, 2], headerDelay: 40_000, chunkDelays: [40_000, 40_000] },
    '/no-headers.bin': { chunks: [1], headerDelay: 60_000 },
    '/stalled.bin': { chunks: [3, 2], chunkDelays: [10_000, 60_000] },
    '/ready.bin': { chunks: [4] },
  } });
  const entries = ['active.bin', 'no-headers.bin', 'stalled.bin', 'ready.bin']
    .map(filename => ({ url: `https://example.com/${filename}`, filename }));
  expect(await app.shareZipFiles(entries, 'bundle.zip', { preservePaths: true, allowPartial: true }))
    .toEqual({ failed: ['no-headers.bin', 'stalled.bin'], completed: 2, bytes: 10 });
  expect(app.writes).toEqual([['active.bin', 4], ['active.bin', 2], ['stalled.bin', 3], ['ready.bin', 4]]);
  expect(app.aborted).toEqual(['/no-headers.bin', '/stalled.bin']);
  expect(app.canceled).toEqual(['/stalled.bin']);
  expect(app.closed).toEqual(['active.bin', 'stalled.bin', 'ready.bin']);
  expect(app.archived[0]?.map(path => path.split('/').at(-1))).toEqual(['active.bin', 'ready.bin']);
  expect(app.timeouts.size).toBe(0);
  expect(app.entries.size).toBe(0);
});
