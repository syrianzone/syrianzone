import { saveAccountSettings, type AccountSettingsPatch } from '@/Domain/settings/accountSettings';

/**
 * Home's display preferences: the three widget toggles and the events
 * governorate.
 *
 * The page seeds them from the account and writes them on mount, and the
 * settings dialog edits them; both go through here, so a new toggle is one
 * entry in `TOGGLES` instead of an edit on two surfaces that must agree. The
 * device keys stay `sz-showWeather` / `sz-showPrayerTimes` / `sz-showEvents`
 * and `eventsGovernorate`.
 */

export type HomeToggleKey = 'showWeather' | 'showPrayerTimes' | 'showEvents';

export type HomeDisplayPrefs = Record<HomeToggleKey, boolean>;

/**
 * What the server renders, and what the first client render must repeat for
 * hydration: the account/device answer arrives in the mount effect, not here.
 */
export const DEFAULT_HOME_DISPLAY_PREFS: HomeDisplayPrefs = {
  showWeather: true,
  showPrayerTimes: true,
  showEvents: true,
};

const TOGGLES: ReadonlyArray<{ key: HomeToggleKey; storageKey: string }> = [
  { key: 'showWeather', storageKey: 'sz-showWeather' },
  { key: 'showPrayerTimes', storageKey: 'sz-showPrayerTimes' },
  { key: 'showEvents', storageKey: 'sz-showEvents' },
];

const EVENTS_GOVERNORATE_KEY = 'eventsGovernorate';

function readDevice(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeDevice(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // private mode: the session still works, nothing is persisted
  }
}

/** The account's answer when it holds one, else the device's; missing means shown. */
export function readHomeDisplayPrefs(
  settings: Record<string, unknown> | null | undefined,
): HomeDisplayPrefs {
  const prefs = {} as HomeDisplayPrefs;
  for (const { key, storageKey } of TOGGLES) {
    const fromAccount = settings?.[key];
    prefs[key] = typeof fromAccount === 'boolean' ? fromAccount : readDevice(storageKey) !== 'false';
  }
  return prefs;
}

/** Seed the device keys from the values the page resolved, once per mount. */
export function persistHomeDisplayPrefs(prefs: HomeDisplayPrefs): void {
  for (const { key, storageKey } of TOGGLES) writeDevice(storageKey, String(prefs[key]));
}

function togglePatch(key: HomeToggleKey, value: boolean): AccountSettingsPatch {
  switch (key) {
    case 'showWeather':
      return { showWeather: value };
    case 'showPrayerTimes':
      return { showPrayerTimes: value };
    case 'showEvents':
      return { showEvents: value };
  }
}

/**
 * Flip one widget: the device key always moves, and the account mirror too when
 * there is an account (`signedIn`).
 */
export function setHomeToggle(key: HomeToggleKey, value: boolean, signedIn: boolean): void {
  const toggle = TOGGLES.find((candidate) => candidate.key === key);
  if (toggle) writeDevice(toggle.storageKey, String(value));
  if (signedIn) saveAccountSettings(togglePatch(key, value));
}

/** The events governorate (`all` when neither side has one). */
export function readEventsGovernorate(settings: Record<string, unknown> | null | undefined): string {
  const fromAccount = settings?.[EVENTS_GOVERNORATE_KEY];
  if (typeof fromAccount === 'string' && fromAccount !== '') return fromAccount;
  return readDevice(EVENTS_GOVERNORATE_KEY) ?? 'all';
}

/**
 * Persist the events governorate on both sides. It used to be written only into
 * the mount effect, so a choice made in the dialog was gone after a reload.
 */
export function setEventsGovernorate(governorate: string, signedIn: boolean): void {
  writeDevice(EVENTS_GOVERNORATE_KEY, governorate);
  if (signedIn) saveAccountSettings({ eventsGovernorate: governorate });
}
