import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createPersistenceScopes } from '../../src/platform/persistence-scope-model';
import { createPrayerLocalStore, type PrayerLocalRaw } from './prayer-local-store';
import { prayerAppearanceKey, prayerFaithKey, prayerHomeKey, prayerJournalKey, prayerLocationKey } from './prayer-local-journal';

async function fixture() {
  const scope = await createPersistenceScopes(async value => createHash('sha256').update(value).digest('hex'))('https://127.0.0.1:9443');
  const directory = mkdtempSync(join(tmpdir(), 'sz-prayer-sqlite-')); mkdirSync(join(directory, 'SQLite'));
  const file = join(directory, 'SQLite', scope.databaseName), db = new Database(file), queries: string[] = [];
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE storage(key TEXT PRIMARY KEY NOT NULL,value TEXT)');
  let beforeWrite: (() => void) | null = null;
  const parameters = (args: unknown[]) => (Array.isArray(args[0]) ? args[0] : args) as (string | null)[];
  const execute = (connection: Database) => ({
    getAllAsync: async (sql: string, ...args: unknown[]) => { queries.push(sql); return connection.query(sql).all(...parameters(args)); },
    runAsync: async (sql: string, ...args: unknown[]) => { queries.push(sql); if (beforeWrite) { const action = beforeWrite; beforeWrite = null; action(); } return connection.query(sql).run(...parameters(args)); },
  });
  const api = { databasePath: file,
    getFirstAsync: async (sql: string, ...args: unknown[]) => { queries.push(sql); return db.query(sql).get(...parameters(args)); },
    withExclusiveTransactionAsync: async (work: (value: unknown) => Promise<void>) => {
      const transaction = new Database(file); transaction.exec('BEGIN');
      try { await work(execute(transaction)); transaction.exec('COMMIT'); }
      catch (error) { transaction.exec('ROLLBACK'); throw error; }
      finally { transaction.close(); }
    } } as unknown as Pick<SQLiteDatabase, 'databasePath' | 'getFirstAsync' | 'withExclusiveTransactionAsync'>;
  const store = createPrayerLocalStore(scope, api);
  const set = (key: string, value: string) => { db.query('INSERT OR REPLACE INTO storage(key,value) VALUES(?,?)').run(key, value); };
  const get = (key: string) => (db.query('SELECT value FROM storage WHERE key=?').get(key) as { value: string } | null)?.value ?? null;
  const before: PrayerLocalRaw = { faithRaw: 'owned faith', homeRaw: 'owned Home', appearanceRaw: 'dark', locationRaw: 'unchanged location' };
  const fill = () => { set(prayerFaithKey, before.faithRaw!); set(prayerHomeKey, before.homeRaw!); set(prayerAppearanceKey, before.appearanceRaw!); set(prayerLocationKey, before.locationRaw!); set(prayerJournalKey, 'owned journal'); set('unrelated', 'never change'); };
  return { store, scope, api, db, set, get, before, fill, queries, concurrent: (value: () => void) => { beforeWrite = value; },
    close: () => { db.close(); rmSync(directory, { recursive: true }); } };
}
test('public SQL transactions preserve exact original bytes and absence while touching only fixed rows', async () => {
  const f = await fixture();
  try {
    f.fill(); const homeRaw = '{\n "eventsGovernorate":"دمشق"\n}';
    await f.store.restoreJournal(f.before, 'owned journal', { faithRaw: null, homeRaw, appearanceRaw: 'light' });
    expect(f.get(prayerFaithKey)).toBeNull(); expect(f.get(prayerHomeKey)).toBe(homeRaw); expect(f.get(prayerAppearanceKey)).toBe('light');
    expect(f.get(prayerLocationKey)).toBe(f.before.locationRaw); expect(f.get(prayerJournalKey)).toBeNull(); expect(f.get('unrelated')).toBe('never change');
    expect(f.queries.filter(sql => sql.startsWith('SELECT')).every(sql => sql.includes('WHERE key'))).toBe(true);
    await expect(f.store.getItemAsync('unrelated')).rejects.toThrow();
    expect(() => createPrayerLocalStore(f.scope, { ...f.api, databasePath: '/production/SQLite/ExpoSQLiteStorage' })).toThrow();
  } finally { f.close(); }
});
test('snapshot insertion refuses a concurrent change or an existing journal without mutation', async () => {
  const f = await fixture();
  try {
    const empty = { faithRaw: null, homeRaw: null, appearanceRaw: null, locationRaw: null };
    await f.store.armJournal(empty, 'owned journal'); expect(f.get(prayerJournalKey)).toBe('owned journal');
    await expect(f.store.armJournal(empty, 'replacement')).rejects.toThrow(); expect(f.get(prayerJournalKey)).toBe('owned journal');
    f.db.query('DELETE FROM storage WHERE key=?').run(prayerJournalKey); f.set(prayerHomeKey, 'unexpected before');
    await expect(f.store.armJournal(empty, 'replacement')).rejects.toThrow(); expect(f.get(prayerJournalKey)).toBeNull(); expect(f.get(prayerHomeKey)).toBe('unexpected before');
  } finally { f.close(); }
});
test('a competing connection after snapshot read refuses the write and preserves its data', async () => {
  const f = await fixture();
  try {
    f.fill(); f.concurrent(() => f.set(prayerHomeKey, 'concurrent Home'));
    await expect(f.store.restoreJournal(f.before, 'owned journal', { faithRaw: null, homeRaw: null, appearanceRaw: null })).rejects.toThrow();
    expect(f.get(prayerHomeKey)).toBe('concurrent Home'); expect(f.get(prayerFaithKey)).toBe(f.before.faithRaw);
    expect(f.get(prayerAppearanceKey)).toBe(f.before.appearanceRaw); expect(f.get(prayerJournalKey)).toBe('owned journal');
  } finally { f.close(); }
});
test('a later SQL failure rolls back earlier restorations and keeps the owned journal', async () => {
  const f = await fixture();
  try {
    f.fill(); f.db.exec(`CREATE TRIGGER refuse_home BEFORE DELETE ON storage WHEN OLD.key='${prayerHomeKey}' BEGIN SELECT RAISE(ABORT,'owned test failure'); END`);
    await expect(f.store.restoreJournal(f.before, 'owned journal', { faithRaw: null, homeRaw: null, appearanceRaw: null })).rejects.toThrow();
    expect(f.get(prayerFaithKey)).toBe(f.before.faithRaw); expect(f.get(prayerHomeKey)).toBe(f.before.homeRaw); expect(f.get(prayerJournalKey)).toBe('owned journal');
  } finally { f.close(); }
});
test('a SQL NULL row is refused rather than mistaken for original absence', async () => {
  const f = await fixture();
  try {
    f.db.query('INSERT INTO storage(key,value) VALUES(?,NULL)').run(prayerHomeKey);
    await expect(f.store.getItemAsync(prayerHomeKey)).rejects.toThrow();
    await expect(f.store.armJournal({ faithRaw: null, homeRaw: null, appearanceRaw: null, locationRaw: null }, 'owned')).rejects.toThrow();
    expect(f.get(prayerJournalKey)).toBeNull();
    expect(() => createPrayerLocalStore({ ...f.scope, origin: 'https://syrian.zone' }, f.api)).toThrow();
  } finally { f.close(); }
});
