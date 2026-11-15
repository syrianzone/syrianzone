import { prayerAppearanceKey, prayerFaithKey, prayerHomeKey, prayerJournalKey, prayerLocationKey } from './prayer-local-journal';
import type { PrayerLocalRaw, PrayerOriginals } from './prayer-local-store';
const keys = [prayerFaithKey, prayerHomeKey, prayerAppearanceKey, prayerLocationKey, prayerJournalKey];
export function memoryPrayerStore(values: Map<string, string>, write: (key: string) => void = () => {}, remove: (key: string) => void = () => {}, beforeHome: () => void = () => {}) {
  const compare = (before: PrayerLocalRaw, journal: string | null) => {
    const expected = [before.faithRaw, before.homeRaw, before.appearanceRaw, before.locationRaw, journal];
    if (keys.some((key, index) => (values.get(key) ?? null) !== expected[index])) throw new Error('Owned memory snapshot changed.');
  };
  return {
    getItemAsync: async (key: string) => values.get(key) ?? null,
    armJournal: async (before: PrayerLocalRaw, encoded: string) => { compare(before, null); values.set(prayerJournalKey, encoded); write(prayerJournalKey); },
    restoreJournal: async (before: PrayerLocalRaw, encoded: string, original: PrayerOriginals) => {
      compare(before, encoded);
      const saved = keys.map(key => values.get(key));
      try {
        const targets = [original.faithRaw, original.homeRaw, original.appearanceRaw];
        for (const [index, value] of targets.entries()) {
          const key = keys[index]!; if (key === prayerHomeKey) beforeHome();
          if (value === null) { values.delete(key); remove(key); } else { values.set(key, value); write(key); }
        }
        values.delete(prayerJournalKey); remove(prayerJournalKey);
      } catch (error) {
        keys.forEach((key, index) => { const value = saved[index]; if (value === undefined) values.delete(key); else values.set(key, value); });
        throw error;
      }
    },
  };
}
