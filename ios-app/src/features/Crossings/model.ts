import raw from '../../../../resources/data/crossings.json';
import { SYRIA_TIMEZONE } from '../../../../resources/js/Domain/geography/syria';

// PORT NOTE: Keep schedule rules independent of browser sharing and map libraries.
export interface WorkWindow { label?: string; start?: string; end?: string; h24?: boolean }
export type Direction = 'north' | 'west' | 'east' | 'south' | 'sea';
export type Status = 'open' | 'closed' | 'opening' | 'pending';
export interface Crossing {
  n: number; name: string; intl: string; category: 'crossing' | 'port'; country: string | null;
  direction: Direction; coordinate: { latitude: number; longitude: number }; opType: string | null;
  windows: WorkWindow[]; mapsUrl: string; openingSoon: boolean; override: { status?: 'open' | 'closed'; message?: string } | null;
}
export const DIRECTION_ORDER: Direction[] = ['north', 'west', 'east', 'south', 'sea'];
export const DIRECTION_LABELS: Record<Direction, string> = { north: 'المنافذ الشمالية', west: 'المنافذ الغربية', east: 'المنافذ الشرقية', south: 'المنافذ الجنوبية', sea: 'المرافئ البحرية' };
export const STATUS_TEXT: Record<Status, string> = { open: 'مفتوح الآن', closed: 'مغلق الآن', opening: 'قيد الافتتاح', pending: 'جارٍ التحقق' };
export const SOURCE_PAGE_URL = 'https://syria-border-crossings.vercel.app/';
export const DEFAULT_CENTER = { latitude: 35, longitude: 38 };
const fail = (): never => { throw new Error('بيانات المنافذ غير صالحة'); };
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail();
const text = (value: unknown): string => typeof value === 'string' && value.trim().length > 0 ? value : fail();
const maybeText = (value: unknown): string | null => value == null || value === '' ? null : text(value);
const time = (value: unknown): string => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fail();

export function decodeCrossings(input: unknown): Crossing[] {
  const data = record(input);
  if (!Array.isArray(data.crossings)) return fail();
  const ids = new Set<number>();
  return data.crossings.map((crossingValue: unknown): Crossing => {
    const item = record(crossingValue);
    if (typeof item.n !== 'number' || !Number.isSafeInteger(item.n) || item.n <= 0 || ids.has(item.n)) return fail();
    ids.add(item.n);
    const latitude = item.lat; const longitude = item.lon;
    if (typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return fail();
    if (item.category !== 'crossing' && item.category !== 'port') return fail();
    if (!DIRECTION_ORDER.includes(item.direction as Direction) || typeof item.openingSoon !== 'boolean' || !Array.isArray(item.windows)) return fail();
    const windows = item.windows.map((value: unknown): WorkWindow => {
      const window = record(value);
      const label = maybeText(window.label);
      if (window.h24 === true) return { h24: true, ...(label ? { label } : {}) };
      return { start: time(window.start), end: time(window.end), ...(label ? { label } : {}) };
    });
    let override: Crossing['override'] = null;
    if (item.override !== null) {
      const value = record(item.override);
      if (value.status !== undefined && value.status !== 'open' && value.status !== 'closed') return fail();
      const message = maybeText(value.message);
      override = { ...(value.status ? { status: value.status } : {}), ...(message ? { message } : {}) };
    }
    const mapsUrl = text(item.mapsUrl);
    try { if (new URL(mapsUrl).protocol !== 'https:') return fail(); } catch { return fail(); }
    const intl = text(item.intl);
    if (!/^\d{8,15}$/.test(intl)) return fail();
    return { n: item.n, name: text(item.name), intl, category: item.category, country: maybeText(item.country), direction: item.direction as Direction,
      coordinate: { latitude, longitude }, opType: maybeText(item.opType), windows, mapsUrl, openingSoon: item.openingSoon, override };
  });
}
export const crossings = decodeCrossings(raw);
export const meta = raw.meta;

const wallClock = new Intl.DateTimeFormat('en-GB', { timeZone: SYRIA_TIMEZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
export function syriaClock(now: Date = new Date()): { text: string; minutes: number; offset: string } {
  const parts = wallClock.formatToParts(now);
  const number = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);
  const hour = number('hour'); const minute = number('minute'); const second = number('second');
  const wall = Date.UTC(number('year'), number('month') - 1, number('day'), hour, minute, second);
  const offset = Math.round((wall - now.getTime()) / 60_000);
  const abs = Math.abs(offset);
  return { text: [hour, minute, second].map(value => String(value).padStart(2, '0')).join(':'), minutes: hour * 60 + minute,
    offset: `GMT${offset < 0 ? '-' : '+'}${Math.floor(abs / 60)}${abs % 60 ? `:${String(abs % 60).padStart(2, '0')}` : ''}` };
}
function timeToMinutes(value: string): number { const [hours = 0, minutes = 0] = value.split(':').map(Number); return hours * 60 + minutes; }
export function isWindowOpen(window: WorkWindow, nowMin: number): boolean {
  if (window.h24) return true;
  if (!window.start || !window.end || !Number.isFinite(nowMin)) return false;
  const start = timeToMinutes(window.start); const end = timeToMinutes(window.end);
  if (start === end) return true;
  return start < end ? nowMin >= start && nowMin < end : nowMin >= start || nowMin < end;
}
export function statusOf(crossing: Crossing, nowMin: number | null): Status {
  if (crossing.openingSoon) return 'opening';
  if (nowMin === null) return 'pending';
  if (crossing.override?.status) return crossing.override.status;
  return crossing.windows.some(window => isWindowOpen(window, nowMin)) ? 'open' : 'closed';
}
export function windowLabel(window: WorkWindow): string {
  if (window.h24) return 'على مدار الساعة';
  const format = (value: string) => { const [hour = 0, minute = 0] = value.split(':').map(Number); return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'ص' : 'م'}`; };
  return window.start && window.end ? `${format(window.start)} - ${format(window.end)}` : 'ساعات غير متاحة';
}
export function formatIntl(intl: string): string { return `+${intl.slice(0, 3)} ${intl.slice(3, 6)} ${intl.slice(6, 9)} ${intl.slice(9)}`; }
export function buildShareMessage(crossing: Crossing, now = new Date()): string {
  const status = statusOf(crossing, syriaClock(now).minutes);
  const lines = [`🛂 ${crossing.name}`, `${status === 'opening' ? '🟡' : status === 'open' ? '🟢' : '🔴'} ${STATUS_TEXT[status]}`];
  if (status !== 'opening') {
    if (crossing.opType) lines.push(`🚦 ${crossing.opType}`);
    crossing.windows.forEach(window => lines.push(`🕘 ${window.label ? `${window.label}: ` : 'ساعات العمل: '}${windowLabel(window)}`));
  }
  if (crossing.country) lines.push(`🌍 الدولة المقابلة: ${crossing.country}`);
  lines.push(`📞 واتساب: ${formatIntl(crossing.intl)}`, `📍 الموقع: ${crossing.mapsUrl}`, '', `🔗 التفاصيل: https://syrian.zone/crossings?c=${crossing.n}`, 'عبر المساحة السورية 🇸🇾');
  return lines.join('\n');
}
// PORT STATUS: source resources/js/Domain/crossings/crossings.ts; confidence high; todos 0.
