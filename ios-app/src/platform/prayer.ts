import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import type { Resource } from '../resource';
import { useForegroundClock } from './clock';
import { todayKey } from './faith-model';
import { resolvePrayerParams, type LocationPreference } from './location-model';
import { decodePrayerTimes, type PrayerTimes } from './prayer-model';
import { readDocument, writeDocument } from './storage';
import { record, text } from './validation';
import { useScreenActive } from './lifecycle';
import { knownPrayerZone, rememberPrayerZone, resolvePrayerZone } from './location-zone';
import { prayerScheduleInZone, validTimeZone, zonedDay } from './prayer-zone';
import type { PrayerSchedule } from './prayer-rules';

export { decodePrayerTimes } from './prayer-model';
export type { PrayerTimes } from './prayer-model';
interface Cached { day: string; data: PrayerTimes; timezone: string | null }
function decodeCache(value: unknown): Cached { const row = record(value); return { day: text(row.day), data: decodePrayerTimes(row.data), timezone: validTimeZone(row.timezone) ? row.timezone : null }; }
function hash(value: string): string {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return (result >>> 0).toString(16);
}
export interface PrayerResource extends Resource<PrayerTimes> { cachedDay: string | null; now: Date; timezone: string | null; fresh: boolean; schedule(options?: { includeSunrise?: boolean; rollover?: boolean }): PrayerSchedule | null }
export function usePrayerTimes(location: LocationPreference, method: number, enabled = true): PrayerResource {
  const now = useForegroundClock(1000, enabled), focused = useScreenActive();
  const key = JSON.stringify(resolvePrayerParams(location, method)), cacheKey = `prayer.v1.${hash(key)}`;
  const params = useMemo(() => JSON.parse(key) as Record<string, string | number>, [key]);
  const locationRef = useRef(location); locationRef.current = location;
  const [state, setState] = useState<{ data: PrayerTimes | null; loading: boolean; error: string | null; cachedDay: string | null; sourceKey: string; timezone: string | null }>({ data: null, loading: true, error: null, cachedDay: null, sourceKey: key, timezone: knownPrayerZone(location) });
  const [revision, setRevision] = useState(0);
  const zone = state.sourceKey === key ? state.timezone ?? knownPrayerZone(location) : knownPrayerZone(location), day = zonedDay(now, zone ?? 'Asia/Damascus');
  const loaded = useRef('');
  useEffect(() => {
    if (!enabled || !focused) { setState(previous => ({ ...previous, loading: false })); return; }
    if (loaded.current === `${key}:${day}:${revision}`) return;
    const controller = new AbortController();
    const ownLocation = locationRef.current;
    let active = true, timedOut = false;
    setState(previous => previous.sourceKey === key ? { ...previous, loading: true, error: null } : { data: null, loading: true, error: null, cachedDay: null, sourceKey: key, timezone: knownPrayerZone(ownLocation) });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 12_000);
    void (async () => {
      try {
        const cached = await readDocument<Cached | null>(cacheKey, decodeCache, null);
        if (active && cached) { if (cached.timezone) rememberPrayerZone(ownLocation, cached.timezone); setState(previous => ({ ...previous, data: cached.data, cachedDay: cached.day, timezone: cached.timezone ?? previous.timezone })); }
      } catch { /* A public-response cache is optional, unlike saved personal preferences. */ }
      if (!active) return;
      if (controller.signal.aborted) {
        setState(previous => ({ ...previous, loading: false, error: 'انتهت مهلة تحميل المواقيت. أعد المحاولة.' }));
        clearTimeout(timer);
        return;
      }
      try {
        const legacyDay = todayKey(), initialZone = knownPrayerZone(ownLocation), initialDay = zonedDay(new Date(), initialZone ?? 'Asia/Damascus');
        const zoneRequest = resolvePrayerZone(ownLocation).catch(() => null);
        let data = await api.request('prayer-times', decodePrayerTimes, { params: { ...params, date: initialDay }, signal: controller.signal });
        let timezone = validTimeZone(data.timezone) ? data.timezone : await zoneRequest;
        if (!active) return;
        let servedDay = data.date ?? legacyDay;
        if (timezone && servedDay !== zonedDay(new Date(), timezone)) {
          const target = zonedDay(new Date(), timezone);
          data = await api.request('prayer-times', decodePrayerTimes, { params: { ...params, date: target }, signal: controller.signal });
          timezone = validTimeZone(data.timezone) ? data.timezone : timezone; servedDay = data.date ?? legacyDay;
        }
        if (!active) return;
        if (timezone) rememberPrayerZone(ownLocation, timezone);
        const error = !timezone ? 'تعذر تحديد المنطقة الزمنية للموقع. تُعرض المواقيت دون عد تنازلي. أعد المحاولة.' : servedDay !== zonedDay(new Date(), timezone) ? 'لم يوفر الخادم مواقيت اليوم في الموقع المحدد. تُعرض المواقيت المحفوظة دون عد تنازلي.' : null;
        if (!error && timezone) loaded.current = `${key}:${zonedDay(new Date(), timezone)}:${revision}`;
        setState({ data, loading: false, error, cachedDay: servedDay, sourceKey: key, timezone });
        void writeDocument(cacheKey, { day: servedDay, data, timezone }).catch(() => undefined);
      } catch (reason) {
        if (!active) return;
        setState(previous => ({ ...previous, loading: false,
          error: timedOut && previous.data && previous.timezone && previous.cachedDay === zonedDay(new Date(), previous.timezone) ? null : timedOut ? 'انتهت مهلة تحميل المواقيت. أعد المحاولة.' : reason instanceof Error ? reason.message : 'تعذر تحميل المواقيت.' }));
      } finally { clearTimeout(timer); }
    })();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [cacheKey, day, enabled, focused, key, params, revision]);
  return { ...state, data: state.sourceKey === key ? state.data : null, error: state.sourceKey === key ? state.error : null, loading: state.sourceKey === key ? state.loading : true, now, fresh: state.sourceKey === key && state.timezone !== null && state.cachedDay === zonedDay(now, state.timezone),
    schedule: options => state.sourceKey === key ? prayerScheduleInZone(state.data?.timings, now, state.timezone, state.cachedDay, options) : null,
    reload: useCallback(() => setRevision(value => value + 1), []) };
}

// PORT STATUS: source resources/js/Domain/prayer/times.ts; confidence medium; todos 1 native reverse-geocoder and selected-zone midnight verification.
