import { api, apiErrorMessage } from '@/Lib/api';
import { notify } from '@/Lib/notify';

/**
 * The account-settings write path: `POST /api/user/settings`.
 *
 * One module owns the URL, the `{ settings }` envelope, the debounce, the
 * flush-on-hide and the failure policy, so the surfaces that mirror a device
 * preference (Home, Roznama, `/muslim`, the appearance menu and the login sync)
 * send one batch with one timer instead of five. Callers are signed in; a guest
 * keeps the value on the device only.
 *
 * The keys are the ones `UserSettingsController::update()` validates; adding a
 * synced preference means adding it here as well.
 */

export const USER_SETTINGS_URL = '/api/user/settings';

/** Long enough that a burst of toggles is one request, short enough that a
 * navigation away does not need the unload flush. */
const DEBOUNCE_MS = 500;

/** A home-screen link as the account stores it (`settings.customLinks`). */
export interface AccountCustomLink {
  id: string;
  url: string;
  name?: string;
  label?: string;
  title?: string;
  icon?: string;
}

export interface AccountSettingsPatch {
  theme?: string;
  fontFamily?: 'ibm-plex' | 'system';
  language?: 'ar' | 'en';
  governorate?: string;
  eventsGovernorate?: string;
  clockFormat?: '12' | '24';
  searchEngine?: 'duckduckgo' | 'google' | 'bing' | 'searx' | 'custom';
  showClock?: boolean;
  showWeather?: boolean;
  showPrayerTimes?: boolean;
  showEvents?: boolean;
  showSearch?: boolean;
  useCustomCoords?: boolean | null;
  customLat?: number | null;
  customLon?: number | null;
  customSearchUrl?: string;
  customLinks?: AccountCustomLink[];
  muslimCity?: string | null;
  muslimMethod?: number | null;
  muslimUseCustomCoords?: boolean | null;
  muslimLat?: number | null;
  muslimLon?: number | null;
  prayerLog?: Record<string, Record<string, boolean>> | null;
  quranLastPage?: number | null;
  quranLastJuz?: number | null;
  quranPageAt?: number | null;
  quranReciterId?: string | null;
  quranRadioBytes?: number | null;
  quranRadioSeconds?: number | null;
}

let pending: AccountSettingsPatch = {};
let timer: ReturnType<typeof setTimeout> | null = null;
let unloadBound = false;

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

/**
 * Coalesce into the pending batch: the last write of a key wins, and a key set
 * by two surfaces in the same burst is sent once.
 */
function merge(patch: AccountSettingsPatch): void {
  pending = { ...pending, ...patch };
}

/** A save queued just before a navigation or a tab close still has to land. */
function bindUnloadFlush(): void {
  if (unloadBound || typeof window === 'undefined') return;
  unloadBound = true;
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush(true);
  });
  window.addEventListener('pagehide', () => void flush(true));
}

async function flush(keepalive: boolean): Promise<void> {
  clearTimer();
  const batch = pending;
  pending = {};
  if (Object.keys(batch).length === 0) return;
  try {
    await api.post(USER_SETTINGS_URL, { settings: batch }, keepalive ? { keepalive: true } : undefined);
  } catch (error) {
    // Unloading: the page is gone before a toast could be read.
    if (keepalive) return;
    notify.error(apiErrorMessage(error, 'تعذّر حفظ إعداداتك في حسابك'));
  }
}

/** Queue a partial account-settings write; the batch is sent after the debounce. */
export function saveAccountSettings(patch: AccountSettingsPatch): void {
  merge(patch);
  bindUnloadFlush();
  clearTimer();
  timer = setTimeout(() => void flush(false), DEBOUNCE_MS);
}

/**
 * Send now and wait for the answer: the login sync and the conflict modal
 * report an outcome before they finish, so they cannot leave it in the timer.
 */
export function postAccountSettings(patch: AccountSettingsPatch): Promise<void> {
  merge(patch);
  return flush(false);
}
