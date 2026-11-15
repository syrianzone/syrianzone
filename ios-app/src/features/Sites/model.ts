// eslint-disable-next-line @typescript-eslint/no-require-imports -- Run the unchanged web search algorithm across the native boundary.
const { normalizeArabic } = require('../../../../resources/js/Lib/arabic') as { normalizeArabic(value: string): string };
import { array, record, text } from '../../platform/validation';
export interface Website { id: string; name: string; url: string; type: string; description: string }
export interface SitesPage { items: Website[]; fetchedAt: string | null }
export function decodeSitesPage(value: unknown): SitesPage {
  const page = record(value);
  return { items: array(page.initialWebsites).map(item => {
    const row = record(item);
    const url = new URL(text(row.url));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('رابط الموقع غير صالح.');
    return { id: text(row.id), name: text(row.name), url: url.toString(), type: text(row.type, ''), description: text(row.description, '') };
  }), fetchedAt: page.fetchedAt == null ? null : text(page.fetchedAt) };
}
export function typeLabel(type: string): string {
  if (type.includes('مدونة شخصية')) return 'المدونات الشخصية';
  if (type.includes('شركة') || type.includes('مبادرة')) return 'المواقع التعريفية';
  if (type.includes('مجلة') || type.includes('إخباري')) return 'المدونات والمواقع الإخبارية';
  return type;
}
export function filterSites(items: Website[], query: string, type: string): Website[] {
  const search = normalizeArabic(query);
  return items.filter(item => (!type || item.type === type) && normalizeArabic(`${item.name} ${item.description} ${item.url}`).includes(search));
}
// PORT STATUS: source resources/js/Pages/Sites/SitesClient.tsx; confidence high; todos 0.
