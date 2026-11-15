import { decodePlace, type Place } from './domain';

export type AppearanceMode = 'light' | 'dark';
export interface KeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}
export interface LocalState { appearance: AppearanceMode | null; saved: Place[] }

const SAVED_KEY = 'syrian-zone.saved.v1';
const APPEARANCE_KEY = 'syrian-zone.appearance.v1';

export function createLocalStore(storage: KeyValueStore): {
  load(): Promise<LocalState>;
  setAppearance(mode: AppearanceMode): Promise<void>;
  setSaved(places: Place[]): Promise<void>;
} {
  return {
    async load() {
      const [rawAppearance, rawSaved] = await Promise.all([
        storage.getItemAsync(APPEARANCE_KEY), storage.getItemAsync(SAVED_KEY),
      ]);
      if (rawAppearance !== null && rawAppearance !== 'light' && rawAppearance !== 'dark') {
        throw new Error('تعذر قراءة إعداد المظهر المحفوظ.');
      }
      const decoded: unknown = rawSaved === null ? [] : JSON.parse(rawSaved);
      if (!Array.isArray(decoded)) throw new Error('تعذر قراءة الأماكن المحفوظة.');
      return { appearance: rawAppearance, saved: decoded.map(decodePlace) };
    },
    setAppearance: (mode) => storage.setItemAsync(APPEARANCE_KEY, mode),
    setSaved(places) {
      const unique = Array.from(new Map(places.map((place) => [place.id, place])).values());
      return storage.setItemAsync(SAVED_KEY, JSON.stringify(unique.map((place) => ({
        id: place.id, name: place.name, category: place.category, description: place.description,
        lat: place.coordinate.latitude, lng: place.coordinate.longitude,
        thumb_url: place.thumbnail, saves_count: place.savesCount,
      }))));
    },
  };
}
