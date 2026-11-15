import type { SQLiteDatabase } from 'expo-sqlite';
import { assertFixtureScope } from '../account-fixture-model';
import { alignmentDocumentKey, alignmentOwnerKey, type AlignmentFixtureStore, type AlignmentPair } from './alignment-fixture-model';

type Database = Pick<SQLiteDatabase, 'databasePath' | 'withExclusiveTransactionAsync'>;
const refused = (): never => { throw new Error('The fixed two-key Alignment transaction was refused.'); };

export function createAlignmentLocalStore(scope: unknown, database: Database): AlignmentFixtureStore {
  assertFixtureScope(scope);
  if (!database.databasePath.endsWith('/SQLite/' + scope.databaseName)) return refused();
  const read = async (transaction: Pick<SQLiteDatabase, 'getAllAsync'>): Promise<AlignmentPair> => {
    const rows = await transaction.getAllAsync<{ key: string; value: unknown }>('SELECT key,value FROM storage WHERE key IN (?,?)', alignmentDocumentKey, alignmentOwnerKey);
    if (rows.length > 2 || new Set(rows.map(row => row.key)).size !== rows.length
      || rows.some(row => ![alignmentDocumentKey, alignmentOwnerKey].includes(row.key) || typeof row.value !== 'string')) return refused();
    return { document: rows.find(row => row.key === alignmentDocumentKey)?.value as string ?? null,
      owner: rows.find(row => row.key === alignmentOwnerKey)?.value as string ?? null };
  };
  const same = (left: AlignmentPair, right: AlignmentPair): boolean => left.document === right.document && left.owner === right.owner;
  return {
    async read() {
      let result: AlignmentPair | null = null;
      await database.withExclusiveTransactionAsync(async transaction => { result = await read(transaction); });
      if (!result) return refused();
      return result;
    },
    async owner(before, next) {
      await database.withExclusiveTransactionAsync(async transaction => {
        if (!same(await read(transaction), before)) return refused();
        const result = before.owner === null
          ? await transaction.runAsync('INSERT INTO storage(key,value) VALUES(?,?)', alignmentOwnerKey, next)
          : await transaction.runAsync('UPDATE storage SET value=? WHERE key=? AND value IS ?', next, alignmentOwnerKey, before.owner);
        if (result.changes !== 1 || !same(await read(transaction), { ...before, owner: next })) return refused();
      });
    },
    async close(before) {
      if (before.document === null || before.owner === null) return refused();
      await database.withExclusiveTransactionAsync(async transaction => {
        if (!same(await read(transaction), before)) return refused();
        for (const [key, raw] of [[alignmentDocumentKey, before.document], [alignmentOwnerKey, before.owner]]) {
          const result = await transaction.runAsync('DELETE FROM storage WHERE key=? AND value IS ?', key!, raw!);
          if (result.changes !== 1) return refused();
        }
        if (!same(await read(transaction), { document: null, owner: null })) return refused();
      });
    },
  };
}
