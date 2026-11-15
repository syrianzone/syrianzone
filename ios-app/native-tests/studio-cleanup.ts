import { assertFixtureScope } from './account-fixture-model';

interface FixtureCleanupStorage {
  getAllKeysAsync(): Promise<string[]>;
  removeItemAsync(key: string): Promise<unknown>;
  clearAsync(): Promise<unknown>;
  closeAsync(): Promise<void>;
}

export async function clearFixturePersonalStorage(scope: unknown, storage: FixtureCleanupStorage, preserveStudioPending: boolean, preservePrayerState = false, preserveAlignmentDocument = false): Promise<void> {
  assertFixtureScope(scope);
  if ([preserveStudioPending, preservePrayerState, preserveAlignmentDocument].filter(Boolean).length > 1) throw new Error('Mixed fixture preservation modes rejected.');
  try {
    if (preservePrayerState) return;
    if (!preserveStudioPending && !preserveAlignmentDocument) { await storage.clearAsync(); return; }
    const keys = await storage.getAllKeysAsync();
    if (!Array.isArray(keys) || keys.some(key => typeof key !== 'string')) throw new Error('Local fixture cleanup keys rejected.');
    for (const key of keys) {
      const protectedKey = preserveStudioPending ? key === 'syrian-zone.document.transit-studio.pending.v1'
        : key === 'syrian-zone.document.alignment.v1' || key === 'syrian-zone.native-fixture.alignment-owner.v1';
      if (!protectedKey) await storage.removeItemAsync(key);
    }
  } finally { await storage.closeAsync(); }
}
