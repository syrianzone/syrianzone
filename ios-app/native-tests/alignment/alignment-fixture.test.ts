import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultAlignment } from '../../src/features/Alignment/model';
import { createPersistenceScopes } from '../../src/platform/persistence-scope-model';
import { alignmentDocumentKey, alignmentOwnerKey, alignmentPointName, createAlignmentFixture } from './alignment-fixture-model';
import { parseAlignmentFixtureLaunch } from './alignment-launch-model';
import { createAlignmentLocalStore } from './alignment-local-store';

const run = '12345678-1234-4234-8234-123456789ABC', other = '22345678-1234-4234-8234-123456789ABC';
const origin = 'https://127.0.0.1:9443', gate = 'synthetic-own-gate-123456789';
const launch = (stage: string) => `syrianzone://fixture/session?user=member&variant=alignment&run=${run}&stage=${stage}#${gate}`;
const owned = () => ({ ...defaultAlignment(), dots: [{ id: 1234, name: alignmentPointName(run), color: '#f44336', x: 0.375, y: 0.625 }] });

test('closed Alignment launch requires one exact member run and stage with no duplicates or cleanup variant', () => {
  expect(parseAlignmentFixtureLaunch(origin, launch('fresh'))).toEqual({ kind: 'session', user: 'member', gate, variant: 'alignment', run, stage: 'fresh' });
  for (const stage of ['resume', 'close'] as const) expect(parseAlignmentFixtureLaunch(origin, launch(stage))?.stage).toBe(stage);
  for (const invalid of [launch('fresh').replace('member', 'admin'), launch('unknown'), launch('fresh').replace('/session?', '/cleanup?'),
    launch('fresh').replace('#', '&stage=fresh#'), launch('fresh').replace('#', '&extra=true#'), launch('fresh').replace(run, run.toLowerCase()),
    launch('fresh').replace('/session?', '/%73ession?'), launch('fresh').replace(gate, 'short')]) {
    expect(() => parseAlignmentFixtureLaunch(origin, invalid)).toThrow();
  }
  expect(() => parseAlignmentFixtureLaunch('https://syrian.zone', launch('fresh'))).toThrow();
  expect(parseAlignmentFixtureLaunch(origin, 'syrianzone://fixture/cleanup')).toBeNull();
});

async function fixture() {
  const scope = await createPersistenceScopes(async value => createHash('sha256').update(value).digest('hex'))(origin);
  const directory = mkdtempSync(join(tmpdir(), 'sz-alignment-sqlite-')); mkdirSync(join(directory, 'SQLite'));
  const file = join(directory, 'SQLite', scope.databaseName), db = new Database(file);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE storage(key TEXT PRIMARY KEY NOT NULL,value TEXT)');
  const parameters = (args: unknown[]) => (Array.isArray(args[0]) ? args[0] : args) as (string | null)[];
  let beforeWrite: (() => void) | null = null;
  const api = { databasePath: file,
    withExclusiveTransactionAsync: async (work: (value: unknown) => Promise<void>) => {
      const transaction = new Database(file); transaction.exec('BEGIN');
      try {
        await work({
          getAllAsync: async (sql: string, ...args: unknown[]) => transaction.query(sql).all(...parameters(args)),
          runAsync: async (sql: string, ...args: unknown[]) => {
            if (beforeWrite) { const action = beforeWrite; beforeWrite = null; action(); }
            return transaction.query(sql).run(...parameters(args));
          },
        });
        transaction.exec('COMMIT');
      } catch (error) { transaction.exec('ROLLBACK'); throw error; }
      finally { transaction.close(); }
    },
  } as unknown as Pick<SQLiteDatabase, 'databasePath' | 'withExclusiveTransactionAsync'>;
  const set = (key: string, raw: string) => db.query('INSERT OR REPLACE INTO storage(key,value) VALUES(?,?)').run(key, raw);
  const get = (key: string) => (db.query('SELECT value FROM storage WHERE key=?').get(key) as { value: string } | null)?.value ?? null;
  const store = createAlignmentLocalStore(scope, api), model = createAlignmentFixture(store);
  return { db, scope, api, set, get, store, model, concurrent: (action: () => void) => { beforeWrite = action; },
    close: () => { db.close(); rmSync(directory, { recursive: true }); } };
}

test('fresh preflight refuses every existing raw drawing/proof unchanged, including encoded null and invalid private bytes', async () => {
  for (const raw of ['null', '', '{private unknown bytes', JSON.stringify(defaultAlignment())]) {
    const f = await fixture();
    try {
      f.set(alignmentDocumentKey, raw); f.set('unrelated', 'private original');
      await expect(f.model.prepare(run, 'fresh')).rejects.toThrow();
      expect(f.get(alignmentDocumentKey)).toBe(raw); expect(f.get(alignmentOwnerKey)).toBeNull(); expect(f.get('unrelated')).toBe('private original');
    } finally { f.close(); }
  }
  const f = await fixture();
  try {
    f.set(alignmentOwnerKey, '{unknown proof'); await expect(f.model.prepare(run, 'fresh')).rejects.toThrow();
    expect(f.get(alignmentOwnerKey)).toBe('{unknown proof'); expect(f.get(alignmentDocumentKey)).toBeNull();
  } finally { f.close(); }
});

test('actual SQLite lifecycle pins one native-created point, cold resumes exactly, and atomically removes only saved defaults', async () => {
  const f = await fixture();
  try {
    f.set('unrelated', 'original');
    expect(await f.model.prepare(run, 'fresh')).toMatchObject({ initiallyAbsent: true, phase: 'armed' });
    await expect(f.model.close(run)).rejects.toThrow();
    f.set(alignmentDocumentKey, JSON.stringify(owned()));
    expect(await f.model.observe(run)).toMatchObject({ defaultAxes: true, defaultPalette: true, dots: owned().dots });
    expect(await f.model.checkpoint(run)).toMatchObject({ phase: 'checkpoint', dots: owned().dots });
    expect(await f.model.prepare(run, 'resume')).toMatchObject({ phase: 'checkpoint', point: owned().dots[0] });
    await expect(f.model.prepare(other, 'resume')).rejects.toThrow();
    await expect(f.model.acknowledgeEmptySaved(run)).rejects.toThrow();
    f.set(alignmentDocumentKey, JSON.stringify(defaultAlignment()));
    await expect(f.model.close(run)).rejects.toThrow();
    expect(await f.model.acknowledgeEmptySaved(run)).toMatchObject({ phase: 'empty-saved', dots: [] });
    expect(await f.model.close(run)).toMatchObject({ phase: 'closed', ownerAbsent: true, documentAbsent: true });
    expect(f.get(alignmentDocumentKey)).toBeNull(); expect(f.get(alignmentOwnerKey)).toBeNull(); expect(f.get('unrelated')).toBe('original');
  } finally { f.close(); }
});

test('resume and close refuse foreign state, unknown keys, palette/axes/coordinate/point changes without mutation', async () => {
  const mutations = [
    (state: ReturnType<typeof owned>) => ({ ...state, extra: true }),
    (state: ReturnType<typeof owned>) => ({ ...state, axes: { ...state.axes, left: 'foreign' } }),
    (state: ReturnType<typeof owned>) => ({ ...state, colors: { ...state.colors, topLeft: '#000000' } }),
    (state: ReturnType<typeof owned>) => ({ ...state, dots: [{ ...state.dots[0], extra: true }] }),
    (state: ReturnType<typeof owned>) => ({ ...state, dots: [{ ...state.dots[0], id: 999 }] }),
    (state: ReturnType<typeof owned>) => ({ ...state, dots: [{ ...state.dots[0], name: 'foreign' }] }),
    (state: ReturnType<typeof owned>) => ({ ...state, dots: [{ ...state.dots[0], x: 0.5 }] }),
    (state: ReturnType<typeof owned>) => ({ ...state, dots: [...state.dots, { ...state.dots[0], id: 999 }] }),
  ];
  const f = await fixture();
  try {
    await f.model.prepare(run, 'fresh'); f.set(alignmentDocumentKey, JSON.stringify(owned())); await f.model.checkpoint(run);
    const proof = f.get(alignmentOwnerKey);
    for (const change of mutations) {
      const raw = JSON.stringify(change(owned())); f.set(alignmentDocumentKey, raw);
      await expect(f.model.prepare(run, 'resume')).rejects.toThrow();
      await expect(f.model.close(run)).rejects.toThrow();
      expect(f.get(alignmentDocumentKey)).toBe(raw); expect(f.get(alignmentOwnerKey)).toBe(proof);
    }
  } finally { f.close(); }
});

test('a later SQL failure rolls back the first deletion and keeps exact proof for retry', async () => {
  const f = await fixture();
  try {
    await f.model.prepare(run, 'fresh'); f.set(alignmentDocumentKey, JSON.stringify(owned())); await f.model.checkpoint(run);
    f.set(alignmentDocumentKey, JSON.stringify(defaultAlignment())); await f.model.acknowledgeEmptySaved(run);
    const before = await f.store.read();
    f.db.exec(`CREATE TRIGGER refuse_owner BEFORE DELETE ON storage WHEN OLD.key='${alignmentOwnerKey}' BEGIN SELECT RAISE(ABORT,'owned failure'); END`);
    await expect(f.model.close(run)).rejects.toThrow(); expect(await f.store.read()).toEqual(before);
    f.db.exec('DROP TRIGGER refuse_owner'); await f.model.close(run); expect(await f.store.read()).toEqual({ document: null, owner: null });
  } finally { f.close(); }
});

test('a competing connection after snapshot read cannot be overwritten or deleted', async () => {
  const f = await fixture();
  try {
    await f.model.prepare(run, 'fresh'); f.set(alignmentDocumentKey, JSON.stringify(owned()));
    const proof = f.get(alignmentOwnerKey);
    f.concurrent(() => f.set(alignmentDocumentKey, 'concurrent private bytes'));
    await expect(f.model.checkpoint(run)).rejects.toThrow();
    expect(f.get(alignmentDocumentKey)).toBe('concurrent private bytes'); expect(f.get(alignmentOwnerKey)).toBe(proof);
    expect(() => createAlignmentLocalStore({ ...f.scope, origin: 'https://syrian.zone' }, f.api)).toThrow();
    expect(() => createAlignmentLocalStore(f.scope, { ...f.api, databasePath: '/foreign/SQLite/other' })).toThrow();
  } finally { f.close(); }
});
