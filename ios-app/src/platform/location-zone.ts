import * as Location from 'expo-location';
import { readDocument, writeDocument } from './storage';
import { resolvePrayerParams, type LocationPreference } from './location-model';
import { validTimeZone } from './prayer-zone';
import { createZoneResolver } from './zone-resolver';
const resolver = createZoneResolver({ read: key => readDocument<unknown>(key, value => value, null), write: writeDocument,
  reverse: async point => (await Location.reverseGeocodeAsync({ latitude: point.lat, longitude: point.lon }))[0]?.timezone });
function pointFor(location: LocationPreference): { lat: number; lon: number } | null { const params = resolvePrayerParams(location, 3); return typeof params.latitude === 'number' && typeof params.longitude === 'number' ? { lat: params.latitude, lon: params.longitude } : null; }
export function knownPrayerZone(location: LocationPreference): string | null {
  const point = pointFor(location); if (!point) return 'Asia/Damascus';
  if ((location.mode === 'gps' || location.mode === 'ip') && validTimeZone(location.geo?.timezone)) return location.geo.timezone;
  return resolver.peek(point);
}
export function resolvePrayerZone(location: LocationPreference): Promise<string> { const known = knownPrayerZone(location); if (known) return Promise.resolve(known); const point = pointFor(location); return point ? resolver.resolve(point) : Promise.resolve('Asia/Damascus'); }
export function rememberPrayerZone(location: LocationPreference, zone: string): void { const point = pointFor(location); if (point) resolver.remember(point, zone); }
