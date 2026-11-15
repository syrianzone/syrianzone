import { expect, test } from 'bun:test';
import { CONTRIBUTORS_TRACE_FILENAME, CONTRIBUTORS_TRACE_LIMITS, contributorsTraceBytes, createContributorsTraceWriter } from './contributors-layout-trace';
const baseline = () => ({ fixture: 'loaded-contributors-layout', reason: 'cap', cap: 24, initialDataCount: 0, loading: false,
  dataState: { loaded: true, count: 42, loading: false, error: false },
  samples: Object.fromEntries(['outer', 'list', 'header', 'author', 'metric', 'cell0', 'cell1', 'cell2'].map(name => [name, { count: 1, pairs: [[366, 52.33333333333333]] }])),
  limits: CONTRIBUTORS_TRACE_LIMITS });
function filePort(options: { final?: string; stage?: boolean; race?: boolean; writeFails?: boolean; cleanupFails?: boolean } = {}) {
  let final = options.final, stage = options.stage ?? false, contents: Uint8Array | undefined;
  const calls: string[] = [];
  return { calls, result: () => ({ final, stage, contents }), port: {
    finalExists: () => { calls.push('exists'); return final !== undefined; },
    createOwnedStage: () => { calls.push('mkdir-exclusive'); if (stage) throw Error('Existing stage'); stage = true; },
    writeOwnedStage: (bytes: Uint8Array) => { calls.push('write'); if (options.writeFails) throw Error('Write failed'); contents = bytes; },
    copyToFinalWithoutOverwrite: () => { calls.push('copy-no-overwrite'); if (options.race) final = 'concurrent foreign bytes'; if (final !== undefined) throw Error('Destination exists'); final = new TextDecoder().decode(contents); },
    removePositivelyCreatedStage: () => { calls.push('cleanup-owned'); if (options.cleanupFails) throw Error('Cleanup failed'); stage = false; contents = undefined; }
  } };
}
test('closed payload retains floating observations, zeros and pre-load flags without identifiers', () => {
  const value = baseline();
  expect(CONTRIBUTORS_TRACE_FILENAME).toBe('native-contributors-layout-257bbcc6-4f6a-4c5b-898e-55472edd071f.json');
  expect(new TextDecoder().decode(contributorsTraceBytes(JSON.stringify(value)))).toBe(JSON.stringify(value));
  const pending = { ...value, reason: 'timer', loading: true, dataState: { loaded: false, count: 0, loading: true, error: false } };
  pending.samples.cell0 = { count: 0, pairs: [] };
  expect(contributorsTraceBytes(JSON.stringify(pending)).byteLength).toBeLessThanOrEqual(16 * 1024);
});
test('unknown metadata, identifiers, malformed flags and arrays cannot enter the cache', () => {
  const value = baseline();
  for (const input of [{ ...value, username: 'foreign' }, { ...value, reason: ['cap'] }, { ...value, reason: 'manual' },
    { ...value, fixture: 'initial-contributors-layout' }, { ...value, limits: 'https://foreign.invalid' },
    { ...value, dataState: { ...value.dataState, url: 'foreign' } }, { ...value, dataState: { ...value.dataState, count: '42' } },
    { ...value, dataState: { ...value.dataState, loaded: false } }, { ...value, samples: { ...value.samples, user: { count: 0, pairs: [] } } }]) {
    expect(() => contributorsTraceBytes(JSON.stringify(input))).toThrow();
  }
});
test('pair counts, primitives, nonfinite values, duplicate keys and byte bounds reject before filesystem work', () => {
  for (const sample of [{ count: 25, pairs: Array.from({ length: 25 }, () => [1, 2]) }, { count: 1, pairs: [] },
    { count: 1, pairs: [[1, 'foreign']] }, { count: 1, pairs: [[-1, 1]] }, { count: 1, pairs: [[Infinity, 1]] }, { count: 1, pairs: [[1, 2, 3]] }]) {
    const value = baseline(); value.samples.author = sample as NonNullable<typeof value.samples.author>;
    const io = filePort(); expect(createContributorsTraceWriter(io.port)(JSON.stringify(value))).toBe('failed'); expect(io.calls).toEqual([]);
  }
  const raw = JSON.stringify(baseline());
  expect(() => contributorsTraceBytes(raw.replace('"reason":"cap"', '"reason":"cap","reason":"timer"'))).toThrow();
  expect(() => contributorsTraceBytes(' '.repeat(16 * 1024 + 1))).toThrow();
});
test('one successful attempt publishes the exact payload and removes only its created stage', () => {
  const io = filePort(), write = createContributorsTraceWriter(io.port), raw = JSON.stringify(baseline());
  expect(write(raw)).toBe('written'); expect(io.result()).toEqual({ final: raw, stage: false, contents: undefined });
  expect(io.calls).toEqual(['exists', 'mkdir-exclusive', 'write', 'copy-no-overwrite', 'cleanup-owned']);
  expect(write(raw)).toBe('refused'); expect(io.calls.length).toBe(5);
});
test('preexisting final or stage paths remain untouched and are never cleaned up', () => {
  for (const options of [{ final: 'protected' }, { stage: true }]) {
    const io = filePort(options), before = io.result();
    expect(createContributorsTraceWriter(io.port)(JSON.stringify(baseline()))).not.toBe('written');
    expect(io.result()).toEqual(before); expect(io.calls.includes('cleanup-owned')).toBe(false);
    expect(io.calls.includes('write')).toBe(false);
  }
});
test('a destination collision during publish cannot overwrite it', () => {
  const io = filePort({ race: true });
  expect(createContributorsTraceWriter(io.port)(JSON.stringify(baseline()))).toBe('failed');
  expect(io.result().final).toBe('concurrent foreign bytes'); expect(io.result().stage).toBe(false);
});
test('write and cleanup failures remain inconclusive and never retry or delete a final', () => {
  const io = filePort({ writeFails: true }), write = createContributorsTraceWriter(io.port);
  expect(write(JSON.stringify(baseline()))).toBe('failed'); expect(io.result().final).toBeUndefined(); expect(io.result().stage).toBe(false);
  expect(write(JSON.stringify(baseline()))).toBe('refused');
  const retained = filePort({ cleanupFails: true });
  expect(createContributorsTraceWriter(retained.port)(JSON.stringify(baseline()))).toBe('written');
  expect(retained.result().stage).toBe(true); expect(retained.result().final).toBe(JSON.stringify(baseline()));
});
