import raw from '../../../resources/data/weather.json';
import { array, finiteNumber, integer, record, text } from './validation';
import { externalUrl } from './links-model';
export interface Weather { temp: number; description: string; icon: string; forecast: { date: string; min: number; max: number; code: number }[] }
const descriptions = new Map([...raw.codes, ...raw.descriptions].map(row => [row.en.trim().toLowerCase(), row.label]));
export const weatherCodeAr = (code: number): string | null => raw.codes.find(row => row.code === code)?.short ?? null;
export function decodeWeather(value: unknown): Weather {
  const row = record(value), description = text(row.description);
  return { temp: Math.round(finiteNumber(row.temp)), description: descriptions.get(description.trim().toLowerCase()) ?? description, icon: text(row.icon),
    forecast: row.forecast == null ? [] : array(row.forecast).slice(0, 14).map(item => { const day = record(item); return { date: text(day.date), min: finiteNumber(day.min), max: finiteNumber(day.max), code: integer(day.code) }; }) };
}
export interface PublicEvent { id: string; name: string; description: string; url: string; address: string; online: boolean; free: boolean; price: number | null; date: string; time: string; province: string; provinceName: string; category: string; organizer: string }
export function decodeEvents(value: unknown): { fallback: boolean; events: PublicEvent[] } {
  const row = record(value);
  return { fallback: row.is_fallback === true, events: array(row.events).slice(0, 200).map(rawEvent => {
    const event = record(rawEvent), date = text(event.event_date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('تاريخ الفعالية غير صالح.');
    return { id: text(event.id), name: text(event.name), description: text(event.description, ''), url: externalUrl(text(event.url)), address: text(event.address, ''), online: event.is_online === true,
      free: event.is_free === true, price: event.ticket_price == null ? null : finiteNumber(event.ticket_price), date, time: text(event.event_time, ''), province: text(event.province, ''), provinceName: text(event.provinceName, ''), category: text(event.category, ''), organizer: text(event.organizer, '') };
  }) };
}

// PORT STATUS: source resources/js/Domain/weather/weather.ts and resources/js/Pages/Roznama/Index.tsx; confidence high; todos 0.
