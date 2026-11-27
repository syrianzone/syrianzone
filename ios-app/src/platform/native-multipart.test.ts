import { expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import * as imageModel from './upload-model';
import * as documentModel from './document-model';
import type * as uploads from './uploads';
import type * as documents from './documents';

const requireFromApp = createRequire(import.meta.url);
const babel: { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null } = requireFromApp('@babel/core');
const compiled = new Map<string, string>();
function compile(path: string): string {
  let code = compiled.get(path);
  if (!code) {
    code = babel.transformFileSync(fileURLToPath(new URL(path, import.meta.url)), {
      babelrc: false, configFile: false, envName: 'production', presets: ['babel-preset-expo'],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
      caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, isNodeModule: false, supportsStaticESM: true },
    })?.code ?? undefined;
    if (!code) throw new Error('Native multipart compilation returned no code.');
    compiled.set(path, code);
  }
  return code;
}

function evaluate(path: string, imports: (name: string) => unknown, globals: Record<string, unknown> = {}): Record<string, unknown> {
  const module = { exports: {} as Record<string, unknown> };
  runInNewContext(compile(path), { module, exports: module.exports, Blob, Uint8Array, TextEncoder, Symbol, ...globals,
    require(name: string): unknown {
      if (name.startsWith('@babel/runtime/')) return requireFromApp(name);
      return imports(name);
    },
  });
  return module.exports;
}

function sdkFormData(): typeof FormData {
  const rejectImport = (name: string): never => { throw new Error('Unexpected SDK FormData import: ' + name); };
  const native = evaluate('../../node_modules/react-native/Libraries/Network/FormData.js', rejectImport).default as typeof FormData;
  const patch = evaluate('../../node_modules/expo/src/winter/FormData.ts', rejectImport).installFormDataPatch as (value: typeof FormData) => typeof FormData;
  return patch(native);
}

const serialize = evaluate('../../node_modules/expo/src/winter/fetch/convertFormData.ts', name => {
  if (name === '../../utils/blobUtils') return { blobToArrayBufferAsync: async () => { throw new Error('Unexpected runtime Blob conversion.'); } };
  throw new Error('Unexpected SDK multipart import: ' + name);
}).convertFormDataAsync as (form: FormData, boundary: string) => Promise<{ body: Uint8Array; boundary: string }>;

interface TestFile { size: number; contents: Uint8Array; read?: () => Promise<Uint8Array> }
function nativeUploads(files: Record<string, TestFile>) {
  let reads = 0;
  class NativeFile {
    constructor(readonly uri: string) {}
    get size(): number { return files[this.uri]!.size; }
    get name(): string { return 'native-cache-name.bin'; }
    get type(): string { return 'application/octet-stream'; }
    async bytes(): Promise<Uint8Array> {
      reads++;
      const file = files[this.uri]!;
      return file.read ? file.read() : file.contents;
    }
    bytesSync(): never { throw new Error('Uploads must not read native file bytes synchronously.'); }
  }
  const NativeFormData = sdkFormData();
  const imports = (name: string): unknown => {
    if (name === 'expo-file-system') return { File: NativeFile };
    if (name === 'expo-image-picker' || name === 'expo-document-picker') return {};
    if (name === './upload-model') return imageModel;
    if (name === './document-model') return documentModel;
    if (name === './native-upload-part') return evaluate('./native-upload-part.ts', imports);
    throw new Error('Unexpected native upload dependency: ' + name);
  };
  const globals = { FormData: NativeFormData, URL };
  return {
    images: evaluate('./uploads.ts', imports, globals) as unknown as typeof uploads,
    documents: evaluate('./documents.ts', imports, globals) as unknown as typeof documents,
    form: () => new NativeFormData(),
    reads: () => reads,
  };
}

const boundary = '----NativeMultipartRegression';
function expectedBody(prefix: string, bytes: Uint8Array): Uint8Array {
  return new Uint8Array([...new TextEncoder().encode(`--${boundary}\r\n${prefix}\r\n\r\n`), ...bytes, ...new TextEncoder().encode(`\r\n--${boundary}--\r\n`)]);
}

test('the installed Expo serializer rejects the legacy React Native URI upload descriptor', async () => {
  const NativeFormData = sdkFormData(), form = new NativeFormData();
  form.append('photos[]', { uri: 'file:///cache/native.png', name: 'native.png', type: 'image/png' } as unknown as Blob);
  await expect(serialize(form, boundary)).rejects.toThrow('Unsupported FormDataPart implementation');
});

test('the production image part serializes exact binary bytes with its sanitized filename and MIME', async () => {
  const uri = 'file:///cache/native-cache-name.bin', bytes = new Uint8Array([0, 255, 13, 10, 137, 80, 78, 71]);
  const native = nativeUploads({ [uri]: { size: bytes.length, contents: bytes } });
  const form = native.images.imageFormData('photos[]', { uri, fileName: 'رحلة?/IMG.HEIC', mimeType: 'image/png', width: 100, height: 80 }, { maxBytes: 4096, minWidth: 64, minHeight: 64 });
  expect(native.reads()).toBe(0);
  const result = await serialize(form, boundary);
  expect(result.boundary).toBe(boundary);
  expect(result.body).toEqual(expectedBody('content-disposition: form-data; name="photos[]"; filename="%D8%B1%D8%AD%D9%84%D8%A9__IMG.png"\r\ncontent-type: image/png', bytes));
  expect(native.reads()).toBe(1);
});

test('the production document part awaits native bytes and preserves the original valid name and MIME', async () => {
  const uri = 'file:///cache/native-cache-name.bin', bytes = new Uint8Array([37, 80, 68, 70, 0, 255]);
  let finishRead: ((value: Uint8Array) => void) | undefined;
  const read = new Promise<Uint8Array>(resolve => { finishRead = resolve; });
  const native = nativeUploads({ [uri]: { size: bytes.length, contents: bytes, read: () => read } });
  const form = native.documents.documentFormData('attachment', { uri, name: 'نسخة نهائية.pdf', size: 999, mimeType: 'application/pdf' });
  expect(native.reads()).toBe(0);
  let settled = false;
  const pending = serialize(form, boundary).then(result => { settled = true; return result; });
  await Promise.resolve();
  expect(native.reads()).toBe(1);
  expect(settled).toBe(false);
  finishRead!(bytes);
  expect((await pending).body).toEqual(expectedBody('content-disposition: form-data; name="attachment"; filename="%D9%86%D8%B3%D8%AE%D8%A9%20%D9%86%D9%87%D8%A7%D8%A6%D9%8A%D8%A9.pdf"\r\ncontent-type: application/pdf', bytes));
});

test('image and document validation still rejects unsafe or oversized parts before reading bytes', () => {
  const uri = 'file:///cache/native.png', native = nativeUploads({ [uri]: { size: 50 * 1024 * 1024 + 1, contents: new Uint8Array() } });
  expect(() => native.images.imageFormData('photos[]', { uri, mimeType: 'image/png' }, { maxBytes: 4096 })).toThrow();
  expect(() => native.documents.documentFormData('attachment', { uri, name: 'file.pdf', size: 1 })).toThrow();
  expect(() => native.documents.documentFormData('attachment\r\nX', { uri, name: 'file.pdf', size: 1 })).toThrow();
  expect(native.reads()).toBe(0);
});

test('deferred image and document serialization rejects files changed before or during the native read', async () => {
  for (const kind of ['image', 'document'] as const) for (const timing of ['before', 'during', 'short-read'] as const) {
    const uri = 'file:///cache/native.png', bytes = new Uint8Array([0, 128, 255]);
    const file: TestFile = { size: bytes.length, contents: bytes, read: async () => {
      if (timing === 'during') file.size++;
      return timing === 'short-read' ? bytes.slice(1) : bytes;
    } };
    const native = nativeUploads({ [uri]: file });
    const form = kind === 'image' ? native.images.imageFormData('photo', { uri, mimeType: 'image/png' }, { maxBytes: 3 })
      : native.documents.documentFormData('file', { uri, name: 'native.png', size: 3 });
    if (timing === 'before') file.size++;
    await expect(serialize(form, boundary)).rejects.toThrow('تغير الملف المختار');
    expect(native.reads()).toBe(timing === 'before' ? 0 : 1);
  }
});

test('native read errors propagate and valid empty documents remain accepted', async () => {
  const uri = 'file:///cache/document', failure = new Error('Synthetic native read failure');
  for (const kind of ['image', 'document'] as const) {
    const native = nativeUploads({ [uri]: { size: 1, contents: new Uint8Array([1]), read: async () => { throw failure; } } });
    const form = kind === 'image' ? native.images.imageFormData('photo', { uri, mimeType: 'image/png' }, { maxBytes: 3 })
      : native.documents.documentFormData('file', { uri, name: 'document', size: 1 });
    await expect(serialize(form, boundary)).rejects.toBe(failure);
  }
  const empty = nativeUploads({ [uri]: { size: 0, contents: new Uint8Array() } });
  const emptyForm = empty.documents.documentFormData('file', { uri, name: 'empty', size: 0 });
  expect((await serialize(emptyForm, boundary)).body).toEqual(expectedBody('content-disposition: form-data; name="file"; filename="empty"\r\ncontent-type: application/octet-stream', new Uint8Array()));
});
