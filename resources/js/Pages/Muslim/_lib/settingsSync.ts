import axios from '@/Lib/axios';
import { MUSLIM_GOVERNORATES } from './governorates';
import { PRAYER_METHODS } from './methods';
import { MUSLIM_LS_KEYS, prunePrayerLog } from './prefs';
import { pushGuestBookmarks } from './guestBookmarks';

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
  return MUSLIM_GOVERNORATES[slug]?.label ?? slug;
}

/** Unknown slugs/ids (stale data) count as absent: the other side wins silently. */
function sanitizeCity(v: string | null): string | null {
  if (!v) return null;
  return MUSLIM_GOVERNORATES[v] ? v : null;
}

function sanitizeMethod(v: string | null): string | null {
  if (v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n)) return null;
  return PRAYER_METHODS.some((m) => m.id === n) ? String(n) : null;
}

function finiteNumber(v: string): number | null {
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function methodLabel(id: string | null): string {
  if (id === null || id === '') return '—';
  return PRAYER_METHODS.find((m) => String(m.id) === String(id))?.nameAr ?? String(id);
}

interface CustomLoc {
  on: string | null; // 'true' | 'false' | null
  lat: string;
  lon: string;
}

function readLocalCustom(): CustomLoc | null {
  const on = ls(MUSLIM_LS_KEYS.useCustom);
  const lat = ls(MUSLIM_LS_KEYS.lat) ?? '';
  const lon = ls(MUSLIM_LS_KEYS.lon) ?? '';
  if (on === null && !lat && !lon) return null;
  return { on, lat, lon };
}

function readServerCustom(s: ServerSettings): CustomLoc | null {
  const { muslimUseCustomCoords: on, muslimLat: lat, muslimLon: lon } = s;
  if (on === null || on === undefined) {
    if (lat === null || lat === undefined || lat === '') return null;
  }
  return {
    on: on === null || on === undefined ? null : on ? 'true' : 'false',
    lat: lat === null || lat === undefined ? '' : String(lat),
    lon: lon === null || lon === undefined ? '' : String(lon),
  };
}

export function customLabel(c: CustomLoc | null): string {
  if (!c) return '—';
  if (c.on === 'true' && (c.lat || c.lon)) return `مفعّلة (${c.lat}، ${c.lon})`;
  if (c.on === 'true') return 'مفعّلة';
  if (c.on === 'false') return 'معطّلة';
  return c.lat || c.lon ? `(${c.lat}، ${c.lon})` : '—';
}

function sameCustom(a: CustomLoc | null, b: CustomLoc | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function mergePrayerLog(
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

export interface SyncOutcome {
  conflicts: SettingConflict[];
}

export async function runLoginSync(userId: number, rawSettings: Record<string, unknown> | null | undefined): Promise<SyncOutcome> {
  const server = (rawSettings ?? {}) as ServerSettings;
  const serverPatch: Record<string, unknown> = {};
  let patchEmpty = true;
  const put = (k: string, v: unknown) => {
    serverPatch[k] = v;
    patchEmpty = false;
  };

  // --- prayerLog: OR-union, silent ---
  const localLog = readLocalPrayerLog();
  if (localLog || server.prayerLog) {
    const merged = mergePrayerLog(localLog, server.prayerLog ?? null);
    lsSet(MUSLIM_LS_KEYS.plog, JSON.stringify(merged));
    if (JSON.stringify(merged) !== JSON.stringify(server.prayerLog ?? {})) {
      put('prayerLog', merged);
    }
  }

  // --- quran position: newer timestamp wins, silent ---
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

  // --- quran bookmarks: union push, silent (leftovers stay on device) ---
  try {
    await pushGuestBookmarks((b) =>
      axios.post('/api/v1/quran-bookmarks', { surah: b.surah, ayah: b.ayah, page: b.page, juz: b.juz }),
    );
  } catch {
    // best-effort; leftovers retry next login
  }

  // --- scalar keys: fill empties silently, collect conflicts ---
  const conflicts: SettingConflict[] = [];

  const scalar = (
    key: ConflictKey,
    label: string,
    local: string | null,
    serverVal: string | null,
    display: (v: string) => string,
    toServer: (v: string) => unknown,
    toLocal: (v: string) => void,
  ) => {
    const l = local === '' ? null : local;
    const s = serverVal === '' ? null : serverVal;
    if (l === null && s === null) return;
    if (s === null && l !== null) {
      put(serverKeyFor(key), toServer(l));
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
    sanitizeCity(ls('governorate') ?? ls('sz-roznama-governorate')),
    sanitizeCity(server.governorate ?? null),
    cityLabel,
    (v) => v,
    (v) => {
      lsSet('governorate', v);
      lsSet('sz-roznama-governorate', v);
    },
  );

  scalar(
    'muslimCity', 'مدينة المواقيت',
    sanitizeCity(ls(MUSLIM_LS_KEYS.city)),
    sanitizeCity(server.muslimCity ?? null),
    cityLabel,
    (v) => v,
    (v) => lsSet(MUSLIM_LS_KEYS.city, v),
  );

  scalar(
    'muslimMethod', 'طريقة حساب المواقيت',
    sanitizeMethod(ls(MUSLIM_LS_KEYS.method)),
    sanitizeMethod(server.muslimMethod === null || server.muslimMethod === undefined ? null : String(server.muslimMethod)),
    methodLabel,
    (v) => Number(v),
    (v) => lsSet(MUSLIM_LS_KEYS.method, v),
  );

  // Custom location is a unit: {on, lat, lon}.
  const localCustom = readLocalCustom();
  const serverCustom = readServerCustom(server);
  if (localCustom === null && serverCustom === null) {
    // nothing
  } else if (serverCustom === null && localCustom !== null) {
    if (localCustom.on !== null) put('muslimUseCustomCoords', localCustom.on === 'true');
    const lat = finiteNumber(localCustom.lat);
    const lon = finiteNumber(localCustom.lon);
    if (lat !== null) put('muslimLat', lat);
    if (lon !== null) put('muslimLon', lon);
  } else if (localCustom === null && serverCustom !== null) {
    if (serverCustom.on !== null) lsSet(MUSLIM_LS_KEYS.useCustom, serverCustom.on);
    if (serverCustom.lat !== '') lsSet(MUSLIM_LS_KEYS.lat, serverCustom.lat);
    if (serverCustom.lon !== '') lsSet(MUSLIM_LS_KEYS.lon, serverCustom.lon);
  } else if (!sameCustom(localCustom, serverCustom)) {
    conflicts.push({
      key: 'customLoc',
      label: 'الإحداثيات المخصصة للمواقيت',
      local: customLabel(localCustom),
      server: customLabel(serverCustom),
    });
  }

  if (!patchEmpty) {
    try {
      await axios.post('/api/user/settings', { settings: serverPatch });
    } catch {
      // best-effort; conflicts (if any) still surface for explicit choice
    }
  }

  void userId;
  return { conflicts };
}

function serverKeyFor(key: ConflictKey): string {
  switch (key) {
    case 'governorate':
      return 'governorate';
    case 'muslimCity':
      return 'muslimCity';
    case 'muslimMethod':
      return 'muslimMethod';
    case 'customLoc':
      return 'muslimUseCustomCoords';
  }
}

/** Apply modal choices: write winners to both sides + push one batch. */
export async function applyConflictChoices(
  conflicts: SettingConflict[],
  choices: Partial<ConflictChoices>,
): Promise<void> {
  const serverPatch: Record<string, unknown> = {};
  for (const c of conflicts) {
    const choice = choices[c.key];
    if (!choice) continue;
    if (c.key === 'governorate' || c.key === 'muslimCity' || c.key === 'muslimMethod') {
      const lsKey =
        c.key === 'governorate' ? 'governorate' : c.key === 'muslimCity' ? MUSLIM_LS_KEYS.city : MUSLIM_LS_KEYS.method;
      if (choice === 'local') {
        const v = ls(lsKey);
        if (v !== null) {
          if (c.key === 'muslimMethod') {
            const n = Number(v);
            if (Number.isFinite(n)) serverPatch[serverKeyFor(c.key)] = n;
          } else {
            serverPatch[serverKeyFor(c.key)] = v;
          }
          if (c.key === 'governorate') lsSet('sz-roznama-governorate', v);
        }
      } else {
        // server wins: pull into device storage (re-read from account below).
      }
    } else if (c.key === 'customLoc') {
      if (choice === 'local') {
        const cur = readLocalCustom();
        if (cur?.on !== null && cur?.on !== undefined) serverPatch.muslimUseCustomCoords = cur.on === 'true';
        const lat = cur ? finiteNumber(cur.lat) : null;
        const lon = cur ? finiteNumber(cur.lon) : null;
        if (lat !== null) serverPatch.muslimLat = lat;
        if (lon !== null) serverPatch.muslimLon = lon;
      }
    }
  }
  if (Object.keys(serverPatch).length > 0) {
    await axios.post('/api/user/settings', { settings: serverPatch });
  }
}

/** Pull the current account values for conflicted keys into device storage. */
export function pullServerValues(rawSettings: Record<string, unknown> | null | undefined, keys: ConflictKey[]): void {
  const s = (rawSettings ?? {}) as ServerSettings;
  for (const key of keys) {
    if (key === 'governorate' && s.governorate) {
      lsSet('governorate', s.governorate);
      lsSet('sz-roznama-governorate', s.governorate);
    } else if (key === 'muslimCity' && s.muslimCity) {
      lsSet(MUSLIM_LS_KEYS.city, s.muslimCity);
    } else if (key === 'muslimMethod' && s.muslimMethod !== null && s.muslimMethod !== undefined) {
      lsSet(MUSLIM_LS_KEYS.method, String(s.muslimMethod));
    } else if (key === 'customLoc') {
      const cur = readServerCustom(s);
      if (!cur) continue;
      if (cur.on !== null) lsSet(MUSLIM_LS_KEYS.useCustom, cur.on);
      lsSet(MUSLIM_LS_KEYS.lat, cur.lat);
      lsSet(MUSLIM_LS_KEYS.lon, cur.lon);
    }
  }
}
