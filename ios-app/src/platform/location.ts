import { useEffect, useSyncExternalStore } from 'react';
import * as Location from 'expo-location';
import { api } from '../api';
import { firstLocation } from '../location';
import { readDocument, writeDocument } from './storage';
import { decodeLocation, defaultLocation, type GeoPoint, type LocationPatch, type LocationPreference } from './location-model';
import { validTimeZone } from './prayer-zone';

export { accountPatchForLocation, decodeLocation, governorates, isDeviceLocation, resolvePlaceLabel, resolvePrayerParams, resolveWeatherPoint, usesCustomCoordinates } from './location-model';
export type { GeoPoint, LocMode, LocationPatch, LocationPreference } from './location-model';

const KEY = 'syrian-zone.location.v1';
let current = defaultLocation;
let status = { ready: false, error: null as string | null };
let initial: Promise<void> | null = null;
let writes = Promise.resolve();
let gps: Promise<GeoPoint> | null = null;
const subscribers = new Set<() => void>();
function emit(): void { subscribers.forEach(callback => callback()); }
function subscribe(callback: () => void): () => void { subscribers.add(callback); return () => { subscribers.delete(callback); }; }

export function initializeLocationPreference(): Promise<void> {
  if (!initial) {
    initial = readDocument(KEY, decodeLocation, defaultLocation).then((value: LocationPreference) => {
      current = value; status = { ready: true, error: null }; emit();
    }).catch((error: unknown) => {
      initial = null; status = { ready: false, error: 'تعذر قراءة إعداد الموقع. أعد المحاولة.' }; emit(); throw error;
    });
  }
  const pending = initial;
  if (!pending) return Promise.reject(new Error('تعذر بدء قراءة الموقع.'));
  return pending;
}
export function readLocationPreference(): LocationPreference { return current; }
export function useLocationPreference(): LocationPreference {
  useEffect(() => { void initializeLocationPreference().catch(() => undefined); }, []);
  return useSyncExternalStore(subscribe, readLocationPreference, readLocationPreference);
}
export function useLocationStatus(): { ready: boolean; error: string | null } {
  return useSyncExternalStore(subscribe, () => status, () => status);
}
export function updateLocationPreference(patch: LocationPatch): Promise<void> {
  const operation = writes.catch(() => undefined).then(async () => {
    await initializeLocationPreference();
    const next = decodeLocation({ ...current, ...patch });
    await writeDocument(KEY, next);
    current = next; status = { ready: true, error: null }; emit();
  });
  writes = operation.catch((error: unknown) => { status = { ...status, error: 'تعذر حفظ إعداد الموقع. حاول مجدداً.' }; emit(); throw error; });
  // Consumers receive the failure, while the queue keeps accepting later retries.
  void writes.catch(() => undefined);
  return operation;
}

export function resolveGps(): Promise<GeoPoint> {
  if (gps) return gps;
  gps = (async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) throw new Error('تم رفض إذن الموقع. فعّله من إعدادات الجهاز أو اختر مدينة يدوياً.');
    async function fix(accuracy: Location.Accuracy, timeout: number): Promise<GeoPoint> {
      const point = await firstLocation(async (onPosition, onError) => Location.watchPositionAsync({ accuracy, timeInterval: 1000, distanceInterval: 0 },
        value => onPosition(value.coords), onError), new AbortController().signal, timeout);
      return { lat: Math.round(point.latitude * 100) / 100, lon: Math.round(point.longitude * 100) / 100,
        label: 'موقع الجهاز (GPS)', source: 'gps', at: Date.now() };
    }
    try { return await fix(Location.Accuracy.Low, 10_000); }
    catch { return fix(Location.Accuracy.High, 30_000); }
  })().finally(() => { gps = null; });
  return gps;
}
export async function resolveIp(signal?: AbortSignal): Promise<GeoPoint> {
  const controller = new AbortController();
  const forward = (): void => controller.abort();
  signal?.addEventListener('abort', forward, { once: true });
  const timer = setTimeout(forward, 9000);
  try {
    if (signal?.aborted) throw new Error('cancelled');
    // The allowlisted public transport never attaches a site bearer token.
    const data = await api.externalJson('https://ipwho.is/', value => value, { signal: controller.signal });
    if (!data || typeof data !== 'object') throw new Error('invalid');
    const value = data as Record<string, unknown>;
    const timezone = value.timezone && typeof value.timezone === 'object' && 'id' in value.timezone ? value.timezone.id : null;
    const lat = value.latitude, lon = value.longitude;
    if (value.success === false || typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)
      || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('invalid');
    return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100,
      label: [value.city, value.country].filter((part): part is string => typeof part === 'string' && part.length > 0).join('، ') || 'التعرف عبر الإنترنت (IP)', source: 'ip', at: Date.now(), ...(validTimeZone(timezone) ? { timezone } : {}) };
  } catch { throw new Error('تعذر التعرف عبر الإنترنت. تحقق من الاتصال أو اختر مدينة يدوياً.'); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', forward); }
}

// PORT STATUS: source resources/js/Domain/location/location.ts; confidence high; todos 0.
