import { addBookmark } from '@/Domain/quran/bookmarksApi';
import { getGovernorateNameAr, governorateById } from '../geography/governorates';
import { isAcceptedPrayerMethod, PRAYER_METHODS } from '../prayer/methods';
import { MUSLIM_LS_KEYS, prunePrayerLog } from './prefs';
import { postAccountSettings, type AccountSettingsPatch } from './accountSettings';
import { pushGuestBookmarks } from '../quran/guestBookmarks';
import {
  accountCustomCoords,
  accountLocation,
  adoptAccountLocation,
  readDeviceCity,
  readDeviceCustomCoords,
  writeDeviceCity,
  writeDeviceCustomCoords,
  type AccountLocation,
  type DeviceCustomCoords,
} from '../location/preference';

// Login settings sync for Muslim Corner + Roznama + Homepage.
// Layers: device localStorage (guests + offline) vs users.settings (account).
//
// Rules (see docs/modules/settings-sync.md):
// - Server empty + device set  -> push device value silently.
// - Device empty + server set  -> pull server value silently.
// - Both set + equal           -> nothing.
// - Both set + differ          -> conflict modal (4 curated keys only).
// - prayerLog                  -> OR-union per day/prayer, silent.
// - quran position             -> newer timestamp wins, silent.
// - quran bookmarks            -> union push to server, silent.

export type ConflictKey = 'governorate' | 'muslimCity' | 'muslimMethod' | 'customLoc';

export interface SettingConflict {
  key: ConflictKey;
  /** Arabic label, e.g. "مدينة المواقيت". */
  label: string;
  /** Human-readable device value. */
  local: string;
  /** Human-readable account value. */
  server: string;
}

export type ConflictChoices = Record<ConflictKey, 'local' | 'server'>;

interface ServerSettings {
  governorate?: string | null;
  muslimCity?: string | null;
  muslimMethod?: number | string | null;
  useCustomCoords?: boolean | null;
  customLat?: number | string | null;
  customLon?: number | string | null;
  muslimUseCustomCoords?: boolean | null;
  muslimLat?: number | string | null;
  muslimLon?: number | string | null;
  prayerLog?: Record<string, Record<string, boolean>> | null;
  quranLastPage?: number | null;
  quranPageAt?: number | null;
}

function ls(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // private mode
  }
}

export function cityLabel(slug: string | null): string {
  if (!slug) return '—';
  return governorateById(slug)?.nameAr ?? getGovernorateNameAr(slug);
}

/** Unknown slugs/ids (stale data) count as absent: the other side wins silently. */
function sanitizeCity(v: string | null): string | null {
  if (!v) return null;
  return governorateById(v) ? v : null;
}

function sanitizeMethod(v: string | null): string | null {
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n)) return null;
  // Every id the timings endpoint accepts, offered in the picker or not: an id
  // another client stored is a real choice, not absent data.
  return isAcceptedPrayerMethod(n) ? String(n) : null;
}

function finiteNumber(v: string): number | null {
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function methodLabel(id: string | null): string {
  if (id === null || id === '') return '—';
  return PRAYER_METHODS.find((m) => String(m.id) === String(id))?.nameAr ?? String(id);
}

function readLocalCustom(): DeviceCustomCoords | null {
  return readDeviceCustomCoords();
}

export function customLabel(c: DeviceCustomCoords | null): string {
  if (!c) return '—';
  const point = c.lat || c.lon ? `(${c.lat}، ${c.lon})` : '';
  if (c.on === 'true') return point ? `مفعّلة ${point}` : 'مفعّلة';
  // "off" still owns the two numbers, and two off values can differ: an option
  // that prints only «معطّلة» would offer the user one choice twice.
  if (c.on === 'false') return point ? `معطّلة ${point}` : 'معطّلة';
  return point || '—';
}

function sameCustom(a: DeviceCustomCoords | null, b: DeviceCustomCoords | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function mergePrayerLog(
  local: Record<string, Record<string, boolean>> | null,
  server: Record<string, Record<string, boolean>> | null,
): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = {};
  for (const [day, prayers] of Object.entries({ ...(server ?? {}), ...(local ?? {}) })) {
    const s = server?.[day] ?? {};
    const l = local?.[day] ?? {};
    const merged: Record<string, boolean> = {};
    for (const k of new Set([...Object.keys(s), ...Object.keys(l), ...Object.keys(prayers ?? {})])) {
      merged[k] = Boolean(s[k] || l[k]);
    }
    out[day] = merged;
  }
  return prunePrayerLog(out);
}

function readLocalPrayerLog(): Record<string, Record<string, boolean>> | null {
  try {
    const raw = ls(MUSLIM_LS_KEYS.plog);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, Record<string, boolean>>;
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

interface SyncOutcome {
  conflicts: SettingConflict[];
}

export async function runLoginSync(userId: number, rawSettings: Record<string, unknown> | null | undefined): Promise<SyncOutcome> {
  const server = (rawSettings ?? {}) as ServerSettings;
  const account = accountLocation(server);
  // The sync is the one owner of the account-to-device seed: filling an empty
  // device here, before anything is compared, keeps the fill out of the
  // device-vs-account diff it would otherwise look like (docs/modules/settings-sync.md §4).
  adoptAccountLocation(account);
  const serverPatch: AccountSettingsPatch = {};
  const put = <K extends keyof AccountSettingsPatch>(key: K, value: AccountSettingsPatch[K]) => {
    serverPatch[key] = value;
  };

  const localLog = readLocalPrayerLog();
  if (localLog || server.prayerLog) {
    const merged = mergePrayerLog(localLog, server.prayerLog ?? null);
    lsSet(MUSLIM_LS_KEYS.plog, JSON.stringify(merged));
    if (JSON.stringify(merged) !== JSON.stringify(server.prayerLog ?? {})) {
      put('prayerLog', merged);
    }
  }

  const localPage = Number(ls(MUSLIM_LS_KEYS.page) ?? '');
  const localAt = Number(ls(MUSLIM_LS_KEYS.at) ?? 0);
  const serverPage = server.quranLastPage ?? null;
  const serverAt = Number(server.quranPageAt ?? 0);
  if (Number.isFinite(localPage) && localPage >= 1) {
    if (serverPage === null || serverPage === undefined) {
      put('quranLastPage', localPage);
      if (localAt > 0) put('quranPageAt', Math.floor(localAt / 1000));
    } else if (localAt > serverAt * 1000 && localAt > 0) {
      put('quranLastPage', localPage);
      put('quranPageAt', Math.floor(localAt / 1000));
    } else if (serverAt * 1000 > localAt) {
      lsSet(MUSLIM_LS_KEYS.page, String(serverPage));
      lsSet(MUSLIM_LS_KEYS.at, String(serverAt * 1000));
    }
  } else if (serverPage !== null && serverPage !== undefined) {
    lsSet(MUSLIM_LS_KEYS.page, String(serverPage));
    if (serverAt > 0) lsSet(MUSLIM_LS_KEYS.at, String(serverAt * 1000));
  }

  try {
    await pushGuestBookmarks((b) => addBookmark(b));
  } catch {
    // best-effort; leftovers retry next login
  }

  const conflicts: SettingConflict[] = [];

  // One scalar preference: push a device-only value, adopt an account-only one,
  // and surface a real difference as a conflict. `key` is the account's key
  // spelling, so a chosen value and its account field cannot drift apart.
  const scalar = <K extends Exclude<ConflictKey, 'customLoc'>>(
    key: K,
    label: string,
    local: string | null,
    serverVal: string | null,
    display: (v: string) => string,
    toServer: (v: string) => AccountSettingsPatch[K],
    toLocal: (v: string) => void,
  ) => {
    const l = local === '' ? null : local;
    const s = serverVal === '' ? null : serverVal;
    if (l === null && s === null) return;
    if (s === null && l !== null) {
      put(key, toServer(l));
      return;
    }
    if (l === null && s !== null) {
      toLocal(s);
      return;
    }
    if (l !== s) {
      conflicts.push({ key, label, local: display(l as string), server: display(s as string) });
    }
  };

  scalar(
    'governorate', 'المدينة (الرئيسية والروزنامة)',
    sanitizeCity(readDeviceCity('display')),
    sanitizeCity(server.governorate ?? null),
    cityLabel,
    (v) => v,
    (v) => writeDeviceCity('display', v),
  );

  scalar(
    'muslimCity', 'مدينة المواقيت',
    sanitizeCity(readDeviceCity('prayer')),
    sanitizeCity(server.muslimCity ?? null),
    cityLabel,
    (v) => v,
    (v) => writeDeviceCity('prayer', v),
  );

  scalar(
    'muslimMethod', 'طريقة حساب المواقيت',
    sanitizeMethod(ls(MUSLIM_LS_KEYS.method)),
    sanitizeMethod(server.muslimMethod === null || server.muslimMethod === undefined ? null : String(server.muslimMethod)),
    methodLabel,
    (v) => Number(v),
    (v) => lsSet(MUSLIM_LS_KEYS.method, v),
  );

  // Custom location is a unit: {on, lat, lon}, and the account may hold it in
  // either key family (Home wrote the display pair, `/muslim` the prayer pair).
  const localCustom = readLocalCustom();
  const serverCustom = accountCustomCoords(account);
  if (localCustom === null && serverCustom === null) {
    // nothing
  } else if (serverCustom === null && localCustom !== null) {
    if (localCustom.on !== null) put('muslimUseCustomCoords', localCustom.on === 'true');
    const lat = finiteNumber(localCustom.lat);
    const lon = finiteNumber(localCustom.lon);
    if (lat !== null) put('muslimLat', lat);
    if (lon !== null) put('muslimLon', lon);
  } else if (localCustom === null && serverCustom !== null) {
    writeDeviceCustomCoords({
      ...(serverCustom.on !== null ? { on: serverCustom.on } : {}),
      ...(serverCustom.lat !== '' ? { lat: serverCustom.lat } : {}),
      ...(serverCustom.lon !== '' ? { lon: serverCustom.lon } : {}),
    });
  } else if (!sameCustom(localCustom, serverCustom)) {
    conflicts.push({
      key: 'customLoc',
      label: 'الإحداثيات المخصصة للمواقيت',
      local: customLabel(localCustom),
      server: customLabel(serverCustom),
    });
  }

  if (Object.keys(serverPatch).length > 0) {
    // Best-effort: the device already holds the merged values, and any conflict
    // still surfaces for an explicit choice.
    await postAccountSettings(serverPatch);
  }

  void userId;
  return { conflicts };
}

/**
 * Apply the modal's choices: the winner is written to both sides in one call,
 * so a "server wins" choice can no longer depend on a second function running
 * afterwards with the same key list.
 */
export async function applyConflictChoices(
  conflicts: SettingConflict[],
  choices: Partial<ConflictChoices>,
  serverSettings: Record<string, unknown> | null | undefined,
): Promise<void> {
  const server = (serverSettings ?? {}) as ServerSettings;
  const account = accountLocation(server);
  const serverPatch: AccountSettingsPatch = {};

  for (const c of conflicts) {
    const choice = choices[c.key];
    if (!choice) continue;

    if (choice === 'server') {
      adoptAccountChoice(c.key, server, account);
      continue;
    }

    if (c.key === 'customLoc') {
      const cur = readLocalCustom();
      if (cur?.on !== null && cur?.on !== undefined) serverPatch.muslimUseCustomCoords = cur.on === 'true';
      const lat = cur ? finiteNumber(cur.lat) : null;
      const lon = cur ? finiteNumber(cur.lon) : null;
      // «هذا الجهاز» with no coordinates is a choice, not a missing value: it
      // clears the account's pair (null) in both key families, or the account
      // keeps a location the device no longer has.
      serverPatch.muslimLat = lat;
      serverPatch.muslimLon = lon;
      serverPatch.customLat = lat;
      serverPatch.customLon = lon;
      continue;
    }

    if (c.key === 'muslimMethod') {
      const stored = ls(MUSLIM_LS_KEYS.method);
      const method = stored === null ? null : Number(stored);
      if (method !== null && Number.isFinite(method)) {
        serverPatch.muslimMethod = method;
        lsSet(MUSLIM_LS_KEYS.method, String(method));
      }
      continue;
    }

    const channel = c.key === 'governorate' ? 'display' : 'prayer';
    const city = readDeviceCity(channel);
    if (city === null) continue;
    if (c.key === 'governorate') serverPatch.governorate = city;
    else serverPatch.muslimCity = city;
    writeDeviceCity(channel, city);
  }

  if (Object.keys(serverPatch).length > 0) await postAccountSettings(serverPatch);
}

/** Write the account's value for one conflicted key onto this device. */
function adoptAccountChoice(key: ConflictKey, server: ServerSettings, account: AccountLocation): void {
  if (key === 'governorate' && server.governorate) {
    writeDeviceCity('display', server.governorate);
  } else if (key === 'muslimCity' && server.muslimCity) {
    writeDeviceCity('prayer', server.muslimCity);
  } else if (key === 'muslimMethod' && server.muslimMethod !== null && server.muslimMethod !== undefined) {
    lsSet(MUSLIM_LS_KEYS.method, String(server.muslimMethod));
  } else if (key === 'customLoc') {
    const cur = accountCustomCoords(account);
    if (!cur) return;
    // An empty lat/lon here means the account has none: clear the device copy
    // so the next login compares equal.
    writeDeviceCustomCoords({ ...(cur.on !== null ? { on: cur.on } : {}), lat: cur.lat, lon: cur.lon });
  }
}
