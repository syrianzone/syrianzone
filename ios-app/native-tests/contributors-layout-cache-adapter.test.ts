import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { CONTRIBUTORS_TRACE_FILENAME, CONTRIBUTORS_TRACE_LIMITS, createContributorsTraceWriter } from './contributors-layout-trace';
const raw = JSON.stringify({ fixture: 'loaded-contributors-layout', reason: 'timer', cap: 24, initialDataCount: 0, loading: true,
  dataState: { loaded: false, count: 0, loading: true, error: false },
  samples: Object.fromEntries(['outer', 'list', 'header', 'author', 'metric', 'cell0', 'cell1', 'cell2'].map(name => [name, { count: 0, pairs: [] }])), limits: CONTRIBUTORS_TRACE_LIMITS });
const root = 'file:///owned-cache', final = `${root}/${CONTRIBUTORS_TRACE_FILENAME}`, stage = `${final}.staging`;
function adapter(options: { foreignOnCopy?: boolean; preexistingFinal?: boolean; preexistingStage?: boolean } = {}) {
  const bytes = new Map<string, Uint8Array>(), directories = new Set([root]), calls: string[] = [];
  if (options.preexistingFinal) bytes.set(final, new TextEncoder().encode('protected final'));
  if (options.preexistingStage) directories.add(stage);
  function uri(parent: string | { uri: string }, children: string[]): string { return [(typeof parent === 'string' ? parent : parent.uri), ...children].join('/'); }
  class FakeDirectory {
    uri: string;
    constructor(parent: string | { uri: string }, ...children: string[]) { this.uri = uri(parent, children); }
    create(value: unknown): void {
      expect(value).toEqual({ overwrite: false, idempotent: false, intermediates: false });
      if (directories.has(this.uri) || bytes.has(this.uri)) throw Error('Existing path');
      directories.add(this.uri); calls.push('mkdir-owned');
    }
    list(): FakeFile[] { return [...bytes.keys()].filter(name => name.startsWith(this.uri + '/')).map(name => new FakeFile(name)); }
    delete(): void {
      if (this.list().length !== 0) throw Error('Nonempty');
      directories.delete(this.uri); calls.push('rmdir-owned');
    }
  }
  class FakeFile {
    uri: string;
    constructor(parent: string | { uri: string }, ...children: string[]) { this.uri = uri(parent, children); }
    get exists(): boolean { return bytes.has(this.uri); }
    get size(): number { return bytes.get(this.uri)?.byteLength ?? 0; }
    writeSync(value: Uint8Array): void { bytes.set(this.uri, value.slice()); calls.push('writeSync'); }
    write(): Promise<void> { calls.push('unexpected-async-write'); return Promise.resolve(); }
    copySync(target: FakeFile, value: unknown): void {
      expect(value).toEqual({ overwrite: false });
      if (bytes.has(target.uri)) throw Error('Existing final');
      const source = bytes.get(this.uri); if (!source) throw Error('Missing source');
      bytes.set(target.uri, source.slice()); calls.push('copySync');
      if (options.foreignOnCopy) bytes.set(stage + '/unknown', new TextEncoder().encode('untouched'));
    }
    copy(): Promise<void> { calls.push('unexpected-async-copy'); return Promise.resolve(); }
    delete(): void { bytes.delete(this.uri); calls.push('unlink-owned'); }
  }
  const source = readFileSync(new URL('./contributors-layout-fixture.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('function saveNumericTrace('), end = source.indexOf('function initialSamples()', start);
  if (start < 0 || end < start) throw Error('Actual cache adapter not found');
  const compiled = new Bun.Transpiler({ loader: 'ts' }).transformSync(source.slice(start, end));
  const load = new Function('Directory', 'File', 'Paths', 'CONTRIBUTORS_TRACE_FILENAME', 'createContributorsTraceWriter', compiled + '; return saveNumericTrace;') as (...args: unknown[]) => (raw: string) => void;
  return { save: load(FakeDirectory, FakeFile, { cache: root }, CONTRIBUTORS_TRACE_FILENAME, createContributorsTraceWriter), bytes, directories, calls };
}
test('actual adapter completes synchronous write/copy before cleaning its owned stage', () => {
  const io = adapter(); io.save(raw);
  expect(new TextDecoder().decode(io.bytes.get(final))).toBe(raw);
  expect([...io.bytes.keys()]).toEqual([final]); expect([...io.directories]).toEqual([root]);
  expect(io.calls).toEqual(['mkdir-owned', 'writeSync', 'copySync', 'unlink-owned', 'rmdir-owned']);
});
test('actual adapter leaves a preexisting final and stage untouched', () => {
  for (const options of [{ preexistingFinal: true }, { preexistingStage: true }]) {
    const io = adapter(options), beforeBytes = [...io.bytes], beforeDirs = [...io.directories]; io.save(raw);
    expect([...io.bytes]).toEqual(beforeBytes); expect([...io.directories]).toEqual(beforeDirs); expect(io.calls).toEqual([]);
  }
});
test('actual cleanup retains any unexpected entry and its directory without deleting it', () => {
  const io = adapter({ foreignOnCopy: true }); io.save(raw);
  expect(new TextDecoder().decode(io.bytes.get(final))).toBe(raw);
  expect(new TextDecoder().decode(io.bytes.get(stage + '/unknown'))).toBe('untouched');
  expect(io.directories.has(stage)).toBe(true); expect(io.bytes.has(stage + '/trace.json')).toBe(true);
  expect(io.calls).toEqual(['mkdir-owned', 'writeSync', 'copySync']);
});
