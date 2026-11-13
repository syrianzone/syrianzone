import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyConflictChoices, customLabel, runLoginSync, type SettingConflict } from './settingsSync';
import { adoptAccountLocation, readDeviceCustomCoords } from '../location/preference';

/** The one POST the sync and the conflict choices make, captured per test. */
const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(async (_path: string, _body?: unknown) => ({ status: 'ok' })),
}));
vi.mock('@/Lib/api', () => ({ api: { post: postMock }, API_ROOT: '/api', API_V1: '/api/v1' }));

/**
 * The login sync is the one owner of the account-to-device location seed. These
 * tests pin the consequence: a seed taken from the account can never come back
 * as a device-vs-account disagreement, a genuine difference still surfaces as a
 * conflict, and the two options of a conflict never print the same label.
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
}

function installWindow(): MemoryStorage {
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

/** The account of a user who set their city and coordinates on Home only. */
const LEGACY_ACCOUNT = {
  governorate: 'damascus',
  useCustomCoords: false,
  customLat: '33.51',
  customLon: '36.27',
  muslimUseCustomCoords: false,
  muslimMethod: 13,
};

afterEach(() => {
  vi.unstubAllGlobals();
  postMock.mockClear();
});

describe('login sync on an empty device', () => {
  it('adopts the account location itself and raises no conflict', async () => {
    const storage = installWindow();

    const { conflicts } = await runLoginSync(7, LEGACY_ACCOUNT);

    expect(conflicts).toEqual([]);
    // The account holds its coordinates in the display family only; the device
    // must end up with them in both, or the next surface reads a hole.
    expect(readDeviceCustomCoords()).toEqual({ on: 'false', lat: '33.51', lon: '36.27' });
    expect(storage.getItem('customLat')).toBe('33.51');
    expect(storage.getItem('governorate')).toBe('damascus');
  });

  it('raises no conflict about the location it has just seeded', async () => {
    const storage = installWindow();
    // A page seeded the device from the account before the sync ran — the state
    // Home's mount effect used to leave behind. The sync must read it as one
    // location, not as a device-vs-account disagreement.
    adoptAccountLocation({
      city: LEGACY_ACCOUNT.governorate,
      useCustomCoords: LEGACY_ACCOUNT.useCustomCoords,
      customLat: LEGACY_ACCOUNT.customLat,
      customLon: LEGACY_ACCOUNT.customLon,
    });
    expect(storage.getItem('sz-muslim-use-custom')).toBe('false');
    expect(storage.getItem('sz-muslim-lat')).toBe('33.51');

    const { conflicts } = await runLoginSync(7, LEGACY_ACCOUNT);

    expect(conflicts).toEqual([]);
  });
});

describe('conflicts', () => {
  it('surfaces coordinates that really differ, with two distinct labels', async () => {
    const storage = installWindow();
    storage.setItem('sz-muslim-use-custom', 'false');
    storage.setItem('sz-muslim-lat', '35.5');
    storage.setItem('sz-muslim-lon', '38.2');

    const { conflicts } = await runLoginSync(7, LEGACY_ACCOUNT);

    const custom = conflicts.find((c) => c.key === 'customLoc');
    expect(custom).toBeDefined();
    expect(custom?.local).not.toBe(custom?.server);
    expect(custom?.local).toContain('35.5');
    expect(custom?.server).toContain('33.51');
  });

  it('prints the coordinates of a switched-off unit, so two off values differ', () => {
    const off = { on: 'false', lat: '33.51', lon: '36.27' };
    const otherOff = { on: 'false', lat: '35.5', lon: '38.2' };

    expect(customLabel(off)).not.toBe(customLabel(otherOff));
    expect(customLabel(off)).toBe('معطّلة (33.51، 36.27)');
    expect(customLabel({ on: 'false', lat: '', lon: '' })).toBe('معطّلة');
    expect(customLabel(null)).toBe('—');
  });
});

describe('choosing «هذا الجهاز» for the coordinates', () => {
  const customConflict: SettingConflict = {
    key: 'customLoc',
    label: 'الإحداثيات المخصصة للمواقيت',
    local: '—',
    server: 'مفعّلة (33.51، 36.27)',
  };

  const settingsPosted = () => postMock.mock.calls.at(-1)?.[1] as { settings: Record<string, unknown> };

  it('clears the account pair when the device holds no coordinates', async () => {
    installWindow();

    await applyConflictChoices([customConflict], { customLoc: 'local' });

    // Null, not omission: the account keeps a location the device no longer has
    // unless every family is written, and '' would be rejected by validation.
    expect(settingsPosted().settings).toEqual({
      muslimLat: null,
      muslimLon: null,
      customLat: null,
      customLon: null,
    });
  });

  it('copies the device numbers into both key families', async () => {
    const storage = installWindow();
    storage.setItem('sz-muslim-use-custom', 'false');
    storage.setItem('sz-muslim-lat', '35.5');
    storage.setItem('sz-muslim-lon', '38.2');

    await applyConflictChoices([customConflict], { customLoc: 'local' });

    expect(settingsPosted().settings).toEqual({
      muslimUseCustomCoords: false,
      muslimLat: 35.5,
      muslimLon: 38.2,
      customLat: 35.5,
      customLon: 38.2,
    });
  });
});
