import { describe, expect, test } from 'bun:test';
import { createLocalStore, type KeyValueStore } from './storage';
import type { Place } from './domain';

function memoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    getItemAsync: async (key) => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); },
  };
}

const place: Place = {
  id: 12, name: 'سوق الحميدية', category: 'market', description: null,
  coordinate: { latitude: 33.511, longitude: 36.302 }, thumbnail: null, savesCount: 2,
};

describe('device-local preferences', () => {
  test('restores appearance and a saved place after reopening', async () => {
    const database = memoryStore();
    const first = createLocalStore(database);
    await first.setAppearance('dark');
    await first.setSaved([place]);
    expect(await createLocalStore(database).load()).toEqual({ appearance: 'dark', saved: [place] });
  });

  test('deduplicates saves and persists removal', async () => {
    const store = createLocalStore(memoryStore());
    await store.setSaved([place, place]);
    expect((await store.load()).saved).toEqual([place]);
    await store.setSaved([]);
    expect((await store.load()).saved).toEqual([]);
  });

  test('reports corrupt saved data instead of replacing it', async () => {
    const database = memoryStore();
    await database.setItemAsync('syrian-zone.saved.v1', '{bad json');
    await expect(createLocalStore(database).load()).rejects.toThrow();
    expect(await database.getItemAsync('syrian-zone.saved.v1')).toBe('{bad json');
  });

  test('keeps a failed write visible to the caller', async () => {
    const store = createLocalStore({
      getItemAsync: async () => null,
      setItemAsync: async () => { throw new Error('disk full'); },
    });
    await expect(store.setSaved([place])).rejects.toThrow('disk full');
  });
});
