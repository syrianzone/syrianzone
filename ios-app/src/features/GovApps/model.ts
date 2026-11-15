// eslint-disable-next-line @typescript-eslint/no-require-imports -- Run the unchanged web search algorithm across the native boundary.
const { normalizeArabic } = require('../../../../resources/js/Lib/arabic') as { normalizeArabic(value: string): string };
import { array, assetUrl, record, text } from '../../platform/validation';
export type Platform = 'apple' | 'android' | 'official';
export interface GovApp { id: string; name: string; description: string; icon: string | null; images: string[]; links: Partial<Record<Platform, string>>; legacyLinks: string[] }
export function decodeGovApps(value: unknown): GovApp[] {
  return array(record(value).initialData).map(item => {
    const row = record(item);
    const rawLinks = row.links == null || Array.isArray(row.links) ? {} : record(row.links);
    const legacyLinks = (Array.isArray(row.links) ? row.links : Object.entries(rawLinks).filter(([key]) => !['apple', 'android', 'official'].includes(key)).map(([, link]) => link)).map(link => text(link, '').trim()).filter(Boolean);
    const links: Partial<Record<Platform, string>> = {};
    for (const key of ['apple', 'android', 'official'] as const) { const link = text(rawLinks[key], '').trim(); if (link) links[key] = link; }
    return { id: text(row.id), name: text(row.name), description: text(row.description, ''), icon: assetUrl(row.icon), images: array(row.images ?? []).map(image => assetUrl(image)).filter((url): url is string => url !== null), links, legacyLinks };
  });
}
export function filterGovApps(items: GovApp[], query: string, platforms: readonly Platform[]): GovApp[] {
  const search = normalizeArabic(query);
  return items.filter(item => normalizeArabic(`${item.name} ${item.description}`).includes(search) && (!platforms.length || platforms.some(key => Boolean(item.links[key]))));
}
// PORT STATUS: source resources/js/Pages/GovApps/GovAppsClient.tsx; confidence high; todos 0.
