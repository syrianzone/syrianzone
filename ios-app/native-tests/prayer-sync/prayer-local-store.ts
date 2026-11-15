import type { SQLiteDatabase } from 'expo-sqlite';
import { assertFixtureScope } from '../account-fixture-model';
import { prayerAppearanceKey, prayerFaithKey, prayerHomeKey, prayerJournalKey, prayerLocationKey } from './prayer-local-journal';

export interface PrayerLocalRaw { faithRaw: string | null; homeRaw: string | null; appearanceRaw: string | null; locationRaw: string | null }
export interface PrayerOriginals { faithRaw: string | null; homeRaw: string | null; appearanceRaw: string | null }
type Database = Pick<SQLiteDatabase, 'databasePath' | 'getFirstAsync' | 'withExclusiveTransactionAsync'>;
const keys = [prayerFaithKey, prayerHomeKey, prayerAppearanceKey, prayerLocationKey, prayerJournalKey] as const;
const fail = (): never => { throw new Error('The exact fixed-row Prayer transaction was refused.'); };
const values = (raw: PrayerLocalRaw, journal: string | null) => [raw.faithRaw, raw.homeRaw, raw.appearanceRaw, raw.locationRaw, journal];

async function matches(transaction: Pick<SQLiteDatabase, 'getAllAsync'>, expected: readonly (string | null)[]): Promise<void> {
  const rows = await transaction.getAllAsync<{ key: string; value: unknown }>('SELECT key,value FROM storage WHERE key IN (?,?,?,?,?)', [...keys]);
  if (rows.some(row => typeof row.value !== 'string' || !(keys as readonly string[]).includes(row.key))
    || new Set(rows.map(row => row.key)).size !== rows.length
    || keys.some((key, index) => (rows.find(row => row.key === key)?.value ?? null) !== expected[index])) fail();
}

export function createPrayerLocalStore(scope: unknown, database: Database) {
  assertFixtureScope(scope);
  if (!database.databasePath.endsWith('/SQLite/' + scope.databaseName)) fail();
  return {
    async getItemAsync(key: string): Promise<string | null> {
      if (!(keys as readonly string[]).includes(key)) return fail();
      const row = await database.getFirstAsync<{ value: unknown }>('SELECT value FROM storage WHERE key=?', key);
      if (row && typeof row.value !== 'string') return fail();
      return row ? row.value as string : null;
    },
    async armJournal(before: PrayerLocalRaw, encoded: string): Promise<void> {
      await database.withExclusiveTransactionAsync(async transaction => {
        await matches(transaction, values(before, null));
        const result = await transaction.runAsync('INSERT INTO storage(key,value) VALUES(?,?)', prayerJournalKey, encoded);
        if (result.changes !== 1) fail();
        await matches(transaction, values(before, encoded));
      });
    },
    async restoreJournal(before: PrayerLocalRaw, encoded: string, original: PrayerOriginals): Promise<void> {
      await database.withExclusiveTransactionAsync(async transaction => {
        await matches(transaction, values(before, encoded));
        const expected = values(before, encoded), targets = [original.faithRaw, original.homeRaw, original.appearanceRaw];
        for (const [index, target] of targets.entries()) {
          const key = keys[index]!;
          const result = target === null
            ? await transaction.runAsync('DELETE FROM storage WHERE key=? AND value IS ?', key, expected[index]!)
            : expected[index] === null
              ? await transaction.runAsync('INSERT INTO storage(key,value) SELECT ?,? WHERE NOT EXISTS(SELECT 1 FROM storage WHERE key=?)', key, target, key)
              : await transaction.runAsync('UPDATE storage SET value=? WHERE key=? AND value IS ?', target, key, expected[index]!);
          if (result.changes !== (target === null && expected[index] === null ? 0 : 1)) fail();
        }
        const removed = await transaction.runAsync('DELETE FROM storage WHERE key=? AND value IS ?', prayerJournalKey, encoded);
        if (removed.changes !== 1) fail();
        await matches(transaction, values({ ...before, ...original }, null));
      });
    },
  };
}
