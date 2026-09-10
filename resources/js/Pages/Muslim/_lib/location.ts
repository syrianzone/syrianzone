import { useEffect, useState } from 'react';

// Shared device-location layer for prayer times (GPS → IP → manual city).
// GPS and IP resolve to coordinates consumed by the existing
// /api/prayer-times?latitude=&longitude= path; manual city lists stay as the
// last resort everywhere. Geo state is device-local (localStorage only, never
// synced to the account — a phone and a laptop are rarely in one place).

export type LocMode = 'city' | 'gps' | 'ip' | 'custom';

export interface GeoPoint {
  lat: number;
  lon: number;
  /** Human label, e.g. city/country from IP or "GPS". */
  label: string;
  /** Source that produced it. */
  source: 'gps' | 'ip';
  /** Epoch ms of resolution. */
  at: number;
}

const LS_MODE = 'sz-muslim-loc-mode';
const LS_GEO = 'sz-muslim-geo';
export const LOC_CHANGED_EVENT = 'sz:loc-changed';

function notifyChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LOC_CHANGED_EVENT));
  }
}

/** Re-render/signal hook for surfaces that read location outside React state. */
export function useLocSignal(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(LOC_CHANGED_EVENT, bump);
    return () => window.removeEventListener(LOC_CHANGED_EVENT, bump);
  }, []);
  return tick;
}

export function getLocMode(): LocMode {
  if (typeof window === 'undefined') return 'city';
  const v = window.localStorage.getItem(LS_MODE);
  return v === 'gps' || v === 'ip' || v === 'custom' ? v : 'city';
}

export function setLocMode(mode: LocMode): void {
  try {
    window.localStorage.setItem(LS_MODE, mode);
  } catch {
    // private mode: state still works for the session
  }
  notifyChanged();
}

export function getGeo(): GeoPoint | null {
  try {
    const raw = window.localStorage.getItem(LS_GEO);
    if (!raw) return null;
    const g = JSON.parse(raw) as GeoPoint;
    if (!Number.isFinite(g.lat) || !Number.isFinite(g.lon)) return null;
    if (g.lat < -90 || g.lat > 90 || g.lon < -180 || g.lon > 180) return null;
    return g;
  } catch {
    return null;
  }
}

export function setGeo(geo: GeoPoint): void {
  try {
    window.localStorage.setItem(LS_GEO, JSON.stringify(geo));
  } catch {
    // private mode
  }
  notifyChanged();
}

export function clearGeo(): void {
  try {
    window.localStorage.removeItem(LS_GEO);
  } catch {
    // ignore
  }
  notifyChanged();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// --- GPS (Geolocation API: most accurate, needs user permission + HTTPS) ---

export function gpsAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

export function resolveGps(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!gpsAvailable()) {
      reject(new Error('المتصفح لا يدعم تحديد الموقع'));
      return;
    }
    // Geolocation API only exists in secure contexts (HTTPS or localhost).
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      reject(new Error('تحديد الموقع يحتاج اتصالاً آمناً (HTTPS) — جرّب عبر الإنترنت (IP)'));
      return;
    }

    const attempt = (
      options: PositionOptions,
      onFail: (err: GeolocationPositionError) => void,
    ) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: round2(pos.coords.latitude),
            lon: round2(pos.coords.longitude),
            label: 'موقع الجهاز (GPS)',
            source: 'gps',
            at: Date.now(),
          });
        },
        onFail,
        options,
      );
    };

    // Attempt 1: fast low-power fix. Attempt 2 (on timeout/unavailable):
    // high-accuracy fix with a longer window — this rescues most indoor
    // and first-fix failures instead of dead-ending at "try again".
    attempt({ enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }, (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        reject(new Error('تم رفض إذن الموقع — فعّله من المتصفح أو استخدم التعرف عبر IP'));
        return;
      }
      if (err.code !== err.TIMEOUT && err.code !== err.POSITION_UNAVAILABLE) {
        reject(new Error('تعذر تحديد الموقع — حاول مجدداً'));
        return;
      }
      attempt({ enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }, (err2) => {
        if (err2.code === err2.PERMISSION_DENIED) {
          reject(new Error('تم رفض إذن الموقع — فعّله من المتصفح أو استخدم التعرف عبر IP'));
        } else if (err2.code === err2.TIMEOUT) {
          reject(new Error('تعذر التقاط إشارة كافية — جرّب قرب نافذة أو فعّل الـ WiFi ثم أعد المحاولة'));
        } else {
          reject(new Error('تعذر تحديد الموقع على هذا الجهاز — تأكد من تفعيل خدمات الموقع في النظام أو استخدم التعرف عبر IP'));
        }
      });
    });
  });
}

// --- IP geolocation (city-level, no permission; client-side on purpose:
// the app deliberately does not trust forwarded edge IPs server-side, and
// the client's own egress IP is what must be geolocated) ---

interface IpWhoResponse {
  success?: boolean;
  message?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
}

export async function resolveIp(signal?: AbortSignal): Promise<GeoPoint> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 9000);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch('https://ipwho.is/', { signal: ctrl.signal });
    if (!res.ok) throw new Error('IP lookup failed');
    const data = (await res.json()) as IpWhoResponse;
    if (data.success === false) throw new Error(data.message || 'IP lookup failed');
    const lat = Number(data.latitude);
    const lon = Number(data.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('IP lookup failed');
    const place = [data.city, data.country].filter(Boolean).join('، ');
    return {
      lat: round2(lat),
      lon: round2(lon),
      label: place || 'التعرف عبر الإنترنت (IP)',
      source: 'ip',
      at: Date.now(),
    };
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw new Error('انتهت مهلة التعرف — حاول مجدداً');
    throw new Error('تعذر التعرف عبر الإنترنت — تحقق من الاتصال أو أدخل المدينة يدوياً');
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// --- Effective prayer params shared by /muslim, Home, Roznama, Board ---
// GPS/IP modes use the resolved point; anything unresolved falls back to the
// surface's manual city (and its own custom coords when enabled).

export interface EffectiveInput {
  mode: LocMode;
  geo: GeoPoint | null;
  manualCity: string;
  method: number;
  useCustomCoords?: boolean;
  customLat?: string;
  customLon?: string;
}

export function effectivePrayerParams(input: EffectiveInput): Record<string, string | number> {
  const { mode, geo, manualCity, method } = input;
  if ((mode === 'gps' || mode === 'ip') && geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lon)) {
    return { latitude: geo.lat, longitude: geo.lon, method };
  }
  // Manual coordinates are a first-class mode now; the legacy flag path
  // stays for states stored before the radio existed.
  const customOn = input.useCustomCoords === true || mode === 'custom';
  if (customOn && input.customLat && input.customLon) {
    const lat = Number(input.customLat);
    const lon = Number(input.customLon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return { latitude: lat, longitude: lon, method };
    }
  }
  return { governorate: manualCity || 'damascus', method };
}
