// Closed trace for this one fixture nonce. No configurable path or arbitrary metadata.
export const CONTRIBUTORS_TRACE_FILENAME = 'native-contributors-layout-257bbcc6-4f6a-4c5b-898e-55472edd071f.json';
export const CONTRIBUTORS_TRACE_LIMITS = 'Fixture-only public source page, real cells and first-three numeric cell Host observations. No full App context, external actions or product cause conclusion.';
const KEYS = ['outer', 'list', 'header', 'author', 'metric', 'cell0', 'cell1', 'cell2'];
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid trace.');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, expected: string[]): void {
  if (Object.keys(value).sort().join(',') !== expected.slice().sort().join(',')) throw new Error('Invalid trace.');
}
export function contributorsTraceBytes(raw: string): Uint8Array {
  const bytes = new TextEncoder().encode(raw);
  if (bytes.length === 0 || bytes.length > 16 * 1024) throw new Error('Invalid trace.');
  const value = object(JSON.parse(raw));
  keys(value, ['fixture', 'reason', 'cap', 'initialDataCount', 'loading', 'dataState', 'samples', 'limits']);
  if (JSON.stringify(value) !== raw || value.fixture !== 'loaded-contributors-layout' || (typeof value.reason !== 'string' || !['cap', 'timer'].includes(value.reason))
    || value.cap !== 24 || value.initialDataCount !== 0 || typeof value.loading !== 'boolean' || value.limits !== CONTRIBUTORS_TRACE_LIMITS) throw new Error('Invalid trace.');
  const state = object(value.dataState);
  keys(state, ['loaded', 'count', 'loading', 'error']);
  if (typeof state.loaded !== 'boolean' || typeof state.loading !== 'boolean' || typeof state.error !== 'boolean'
    || state.loading !== value.loading || state.loaded !== (!state.loading && !state.error) || !Number.isSafeInteger(state.count) || Number(state.count) < 0) throw new Error('Invalid trace.');
  const samples = object(value.samples);
  keys(samples, KEYS);
  for (const name of KEYS) {
    const sample = object(samples[name]);
    keys(sample, ['count', 'pairs']);
    if (!Number.isInteger(sample.count) || Number(sample.count) < 0 || Number(sample.count) > 24 || !Array.isArray(sample.pairs) || sample.pairs.length !== sample.count) throw new Error('Invalid trace.');
    for (const pair of sample.pairs) {
      if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(number => typeof number === 'number' && Number.isFinite(number) && number >= 0)) throw new Error('Invalid trace.');
    }
  }
  return bytes;
}

// These operations are specific to the fixed cache trace, not a filesystem API.
export function createContributorsTraceWriter(files: {
  finalExists(): boolean;
  createOwnedStage(): void;
  writeOwnedStage(bytes: Uint8Array): void;
  copyToFinalWithoutOverwrite(): void;
  removePositivelyCreatedStage(): void;
}): (raw: string) => 'written' | 'refused' | 'failed' {
  let attempted = false;
  return raw => {
    if (attempted) return 'refused';
    attempted = true;
    let created = false;
    try {
      const bytes = contributorsTraceBytes(raw);
      if (files.finalExists()) return 'refused';
      files.createOwnedStage();
      created = true;
      files.writeOwnedStage(bytes);
      files.copyToFinalWithoutOverwrite();
      return 'written';
    } catch {
      return 'failed';
    } finally {
      if (created) { try { files.removePositivelyCreatedStage(); } catch { /* Retain the owned staging path if cleanup cannot be confirmed. */ } }
    }
  };
}
