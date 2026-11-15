import { array, assetUrl, finiteNumber, integer, record, text } from '../../platform/validation';
import { externalUrl } from '../../platform/links-model';
import weatherData from '../../../../resources/data/weather.json';
import games from '../../../../resources/data/games.json';
import siteModules from '../../../../resources/data/site-modules.json';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const arabic = require('../../../../resources/js/Lib/arabic') as { normalizeArabic(value: string): string };
export interface NavigationItem { id: string; title: string; subtitle: string; href: string; target: string; iconKey: string | null; image: string | null; isInternal: boolean; external: boolean }
export function decodeNavigation(value: unknown): NavigationItem[] {
  return array(record(value).items).filter(item => {
    const row = record(item); return row.enabled !== false && row.showOnHome !== false;
  }).map(item => {
    const row = record(item), href = text(row.href);
    if (!href.startsWith('/') || href.startsWith('//')) externalUrl(href);
    return { id: text(row.id), title: text(row.text ?? row.title), subtitle: text(row.subtitle, ''), href,
      target: text(row.target, text(row.id)), iconKey: row.iconKey == null ? null : text(row.iconKey), image: assetUrl(row.iconUrl ?? row.image),
      isInternal: row.isInternal === true, external: row.external === true || /^https?:/.test(href) };
  });
}
export const bundledCatalogue = decodeNavigation({ items: siteModules.modules.map(module => ({ ...module, text: module.title, enabled: true, showOnHome: true })) });
export interface CustomLink { id: string; url: string; name: string; icon: string }
export interface HomePreferences { showWeather: boolean; showPrayerTimes: boolean; showEvents: boolean; eventsGovernorate: string; customLinks: CustomLink[] }
export const defaultPreferences: HomePreferences = { showWeather: true, showPrayerTimes: true, showEvents: true, eventsGovernorate: 'all', customLinks: [] };
export function linkDraft(id: string, name: string, url: string, icon: string): CustomLink {
  if (!id || id.length > 64 || !name.trim() || name.trim().length > 100 || url.length > 2048 || icon.length > 32) throw new Error('تحقق من الاسم والرابط.');
  return { id, name: name.trim(), url: externalUrl(url.trim()), icon: icon.trim() };
}
export function decodeHomePreferences(value: unknown): HomePreferences {
  const row = record(value);
  return { showWeather: typeof row.showWeather === 'boolean' ? row.showWeather : true, showPrayerTimes: typeof row.showPrayerTimes === 'boolean' ? row.showPrayerTimes : true,
    showEvents: typeof row.showEvents === 'boolean' ? row.showEvents : true, eventsGovernorate: text(row.eventsGovernorate, 'all'),
    customLinks: array(row.customLinks ?? []).map(item => { const link = record(item); return linkDraft(text(link.id), text(link.name ?? link.label ?? link.title, 'رابط'), text(link.url), text(link.icon, '')); }) };
}
export function matchesSearch(query: string, ...targets: string[]): boolean {
  const haystack = arabic.normalizeArabic(targets.join(' '));
  return arabic.normalizeArabic(query).trim().split(/\s+/).filter(Boolean).every(token => haystack.includes(token));
}
export interface SearchResult { id: string; title: string; subtitle: string; section: string; params: Record<string, string>; url?: string }
export function gameSearchResults(query: string): SearchResult[] {
  return games.filter(game => matchesSearch(query, game.title, game.slug, 'لعبة العاب شدة ورق')).map(game => ({ id: game.slug, title: game.title,
    subtitle: 'comingSoon' in game && game.comingSoon ? 'قريباً' : '', section: game.slug, params: {},
    ...('external' in game && game.external && 'href' in game ? { url: externalUrl(game.href) } : {}) }));
}
export type RemoteSearch = Record<'routes' | 'places' | 'phonebook' | 'officials' | 'govapps', SearchResult[]>;
export function decodeSearch(value: unknown): RemoteSearch {
  const row = record(value);
  const result: RemoteSearch = { routes: [], places: [], phonebook: [], officials: [], govapps: [] };
  for (const group of ['routes', 'places', 'phonebook', 'officials', 'govapps'] as const) result[group] = array(row[group]).map(raw => {
    const item = record(raw), id = group === 'places' ? String(integer(item.id)) : text(item.id);
    const title = text(group === 'places' ? item.name : item.nameAr);
    return { id, title, subtitle: text(group === 'phonebook' ? item.number : item.nameEn, ''),
      section: { routes: 'transit', places: 'place', phonebook: 'phonebook', officials: 'syofficial', govapps: 'govapps' }[group],
      params: group === 'routes' ? { cityId: text(item.cityId), routeId: id } : group === 'places' ? { id } : { id, q: title } };
  });
  return result;
}
export interface Weather { temp: number; description: string; icon: string }
export function weatherSymbol(code: string): 'sun.max' | 'cloud' | 'cloud.rain' | 'cloud.bolt' | 'snowflake' | 'wind' {
  switch (code.slice(0, 2)) {
    case '03': case '04': return 'cloud';
    case '09': case '10': return 'cloud.rain';
    case '11': return 'cloud.bolt';
    case '13': return 'snowflake';
    case '50': return 'wind';
    default: return 'sun.max';
  }
}
const descriptions = new Map([...weatherData.codes, ...weatherData.descriptions].map(row => [row.en.toLowerCase(), row.label]));
export function decodeWeather(value: unknown): Weather {
  const row = record(value), description = text(row.description);
  return { temp: Math.round(finiteNumber(row.temp)), description: descriptions.get(description.toLowerCase()) ?? description, icon: text(row.icon) };
}
export function decodePrayer(value: unknown): Record<string, string> {
  const timings = record(record(value).timings);
  return Object.fromEntries(Object.entries(timings).map(([key, raw]) => {
    const time = text(raw); if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('وقت صلاة غير صالح.');
    return [key, time];
  }));
}
export interface HomeEvent { id: string; name: string; url: string; date: string; time: string; address: string; province: string; free: boolean; online: boolean; price: number | null }
export function decodeEvents(value: unknown): { fallback: boolean; event: HomeEvent | null } {
  const row = record(value), raw = array(row.events)[0];
  if (!raw) return { fallback: row.is_fallback === true, event: null };
  const event = record(raw);
  return { fallback: row.is_fallback === true, event: { id: text(event.id), name: text(event.name), url: externalUrl(text(event.url)), date: text(event.event_date),
    time: text(event.event_time, ''), address: text(event.address, ''), province: text(event.province), free: event.is_free === true, online: event.is_online === true,
    price: event.ticket_price == null ? null : finiteNumber(event.ticket_price) } };
}
// PORT STATUS: source resources/js/Pages/Home.tsx and resources/js/Components/GlobalSearch.tsx; confidence high; todos 0.
