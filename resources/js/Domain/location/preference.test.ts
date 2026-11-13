import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  adoptAccountLocation,
  readDeviceCity,
  readDeviceCustomCoords,
  readLocationPreference,
  resolvePlaceLabel,
  resolvePrayerParams,
  resolveWeatherPoint,
  updateLocationPreference,
  writeDeviceCity,
  writeDeviceCustomCoords,
} from './preference';

/**
 * The preference reads two key families. The prayer family
 * (`sz-muslim-city`, `sz-muslim-*`) is canonical — it is the one the login sync
 * conflict-tracks — and the Home/Roznama family (`governorate`,
 * `sz-roznama-governorate`, `useCustomCoords`, `customLat`, `customLon`) is the
 * older mirror. These tests pin the precedence and the write fan-out so a later
 * edit cannot quietly make one surface read a different city than another.
 */

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  get length(): number {
    return this.data.size;
  }
}

function installWindow() {
  const storage = new MemoryStorage();
  const target = new EventTarget();
  vi.stubGlobal('window', {
    localStorage: storage,
    sessionStorage: new MemoryStorage(),
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  });
  return storage;
}

afterEach(() => vi.unstubAllGlobals());

describe('which stored city wins', () => {
  it('prefers the prayer family over the Home/Roznama keys', () => {
    const storage = installWindow();
    storage.setItem('sz-muslim-city', 'aleppo');
    storage.setItem('governorate', 'damascus');
    storage.setItem('sz-roznama-governorate', 'homs');
    expect(readLocationPreference().city).toBe('aleppo');
  });

  it('falls back to the display key, then the Roznama legacy key', () => {
    const storage = installWindow();
    storage.setItem('sz-roznama-governorate', 'homs');
    expect(readLocationPreference().city).toBe('homs');
    storage.setItem('governorate', 'latakia');
    expect(readLocationPreference().city).toBe('latakia');
  });

  it('treats an unknown slug as absent, then defaults to Damascus', () => {
    const storage = installWindow();
    storage.setItem('sz-muslim-city', 'atlantis');
    storage.setItem('governorate', 'tartus');
    expect(readLocationPreference().city).toBe('tartus');

    storage.setItem('governorate', 'nowhere');
    expect(readLocationPreference().city).toBe('damascus');
  });

  it('publishes an unusable city in each family separately for the login sync', () => {
    const storage = installWindow();
    storage.setItem('sz-muslim-city', 'aleppo');
    storage.setItem('governorate', 'homs');
    storage.setItem('sz-roznama-governorate', 'homs');
    expect(readDeviceCity('prayer')).toBe('aleppo');
    expect(readDeviceCity('display')).toBe('homs');
  });
});

describe('custom coordinates', () => {
  it('prefers the prayer family and keeps an empty string as empty', () => {
    const storage = installWindow();
    storage.setItem('useCustomCoords', 'true');
    storage.setItem('customLat', '33.1');
    storage.setItem('customLon', '36.1');
    expect(readLocationPreference()).toMatchObject({
      useCustomCoords: true,
      customLat: '33.1',
      customLon: '36.1',
    });

    storage.setItem('sz-muslim-use-custom', 'false');
    storage.setItem('sz-muslim-lat', '');
    expect(readLocationPreference()).toMatchObject({ useCustomCoords: false, customLat: '' });
  });

  it('reports null only when no key of either family exists', () => {
    installWindow();
    expect(readDeviceCustomCoords()).toBeNull();
    writeDeviceCustomCoords({ lat: '34' });
    expect(readDeviceCustomCoords()).toEqual({ on: null, lat: '34', lon: '' });
  });
});

describe('writes land in both families', () => {
  it('a city write fills the prayer key and the Home/Roznama pair', () => {
    const storage = installWindow();
    updateLocationPreference({ city: 'idlib' });
    expect(storage.getItem('sz-muslim-city')).toBe('idlib');
    expect(storage.getItem('governorate')).toBe('idlib');
    expect(storage.getItem('sz-roznama-governorate')).toBe('idlib');
  });

  it('a display-family write keeps its own channel', () => {
    const storage = installWindow();
    writeDeviceCity('display', 'daraa');
    expect(storage.getItem('governorate')).toBe('daraa');
    expect(storage.getItem('sz-roznama-governorate')).toBe('daraa');
    expect(storage.getItem('sz-muslim-city')).toBeNull();
  });

  it('mode custom is the same switch as useCustomCoords', () => {
    const storage = installWindow();
    updateLocationPreference({ mode: 'custom' });
    expect(storage.getItem('sz-muslim-use-custom')).toBe('true');
    expect(storage.getItem('useCustomCoords')).toBe('true');
    updateLocationPreference({ mode: 'city' });
    expect(storage.getItem('sz-muslim-use-custom')).toBe('false');
    expect(storage.getItem('useCustomCoords')).toBe('false');
  });

  it('coordinates are written to both families', () => {
    const storage = installWindow();
    updateLocationPreference({ customLat: '35.5', customLon: '38.2' });
    expect(storage.getItem('sz-muslim-lat')).toBe('35.5');
    expect(storage.getItem('customLat')).toBe('35.5');
    expect(storage.getItem('sz-muslim-lon')).toBe('38.2');
    expect(storage.getItem('customLon')).toBe('38.2');
  });
});

describe('the mount-time account seed', () => {
  it('never overwrites a device value', () => {
    const storage = installWindow();
    storage.setItem('sz-muslim-city', 'aleppo');
    storage.setItem('sz-muslim-lat', '1');
    adoptAccountLocation({ city: 'damascus', customLat: '33', customLon: '36' });
    expect(storage.getItem('sz-muslim-city')).toBe('aleppo');
    expect(storage.getItem('governorate')).toBeNull();
    expect(storage.getItem('sz-muslim-lat')).toBe('1');
  });

  it('fills an empty device from the account', () => {
    const storage = installWindow();
    adoptAccountLocation({
      city: 'hama',
      useCustomCoords: true,
      customLat: 35.1,
      customLon: '36.7',
    });
    expect(storage.getItem('sz-muslim-city')).toBe('hama');
    expect(storage.getItem('governorate')).toBe('hama');
    expect(storage.getItem('sz-roznama-governorate')).toBe('hama');
    expect(storage.getItem('sz-muslim-use-custom')).toBe('true');
    expect(storage.getItem('customLat')).toBe('35.1');
    expect(storage.getItem('customLon')).toBe('36.7');
  });
});

describe('preference to request parameters', () => {
  const base = {
    city: 'damascus',
    useCustomCoords: false,
    customLat: '',
    customLon: '',
    mode: 'city' as const,
    geo: null,
  };

  it('sends the governorate slug in city mode', () => {
    expect(resolvePrayerParams({ ...base, city: 'aleppo' }, 3)).toEqual({
      governorate: 'aleppo',
      method: 3,
    });
  });

  it('sends the resolved point for GPS/IP', () => {
    const geo = { lat: 33.5, lon: 36.3, label: 'موقع الجهاز (GPS)', source: 'gps' as const, at: 0 };
    expect(resolvePrayerParams({ ...base, mode: 'gps', geo }, 5)).toEqual({
      latitude: 33.5,
      longitude: 36.3,
      method: 5,
    });
  });

  it('sends manual coordinates in custom mode and ignores unusable numbers', () => {
    expect(
      resolvePrayerParams({ ...base, mode: 'custom', customLat: '35.1', customLon: '38.2' }, 4),
    ).toEqual({ latitude: 35.1, longitude: 38.2, method: 4 });
    expect(resolvePrayerParams({ ...base, mode: 'custom', customLat: 'x' }, 4)).toEqual({
      governorate: 'damascus',
      method: 4,
    });
  });

  it('resolves the weather point through the same order', () => {
    const geo = { lat: 1, lon: 2, label: 'IP', source: 'ip' as const, at: 0 };
    expect(resolveWeatherPoint({ ...base, mode: 'ip', geo })).toEqual({ lat: 1, lon: 2 });
    expect(
      resolveWeatherPoint({ ...base, mode: 'custom', customLat: '35', customLon: '38' }),
    ).toEqual({ lat: 35, lon: 38 });
    expect(resolveWeatherPoint({ ...base, city: 'aleppo' })).toEqual({ lat: 36.2021, lon: 37.1343 });
  });

  it('labels the place the numbers belong to', () => {
    const geo = { lat: 1, lon: 2, label: 'حلب', source: 'ip' as const, at: 0 };
    expect(resolvePlaceLabel({ ...base, mode: 'ip', geo })).toBe('حلب');
    expect(resolvePlaceLabel({ ...base, mode: 'custom' })).toBe('إحداثيات مخصصة');
    expect(resolvePlaceLabel({ ...base, city: 'aleppo' })).toBe('حلب');
  });
});
