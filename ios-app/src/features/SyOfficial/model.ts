// eslint-disable-next-line @typescript-eslint/no-require-imports -- Run the unchanged web search algorithm across the native boundary.
const { normalizeArabic } = require('../../../../resources/js/Lib/arabic') as { normalizeArabic(value: string): string };
import { array, assetUrl, record, text } from '../../platform/validation';
export interface OfficialCategory { id: string; labelAr: string; labelEn: string }
export interface OfficialEntity { id: string; name: string; nameAr: string; description: string; descriptionAr: string; image: string | null; category: string; socials: Record<string, string> }
export interface OfficialPage { categories: OfficialCategory[]; items: OfficialEntity[] }
export function decodeOfficialPage(value: unknown): OfficialPage {
  const page = record(value);
  return {
    categories: array(page.categories).map(item => { const c = record(item); return { id: text(c.id), labelAr: text(c.label_ar), labelEn: text(c.label_en, '') }; }),
    items: array(page.initialData).map(item => {
      const row = record(item);
      const socials = Object.fromEntries(Object.entries(row.socials == null ? {} : record(row.socials)).map(([key, url]) => [key, text(url, '')]));
      return { id: text(row.id), name: text(row.name), nameAr: text(row.name_ar), description: text(row.description, ''), descriptionAr: text(row.description_ar, ''), image: assetUrl(row.image), category: text(row.category), socials };
    })
  };
}
export function filterOfficials(items: OfficialEntity[], query: string, category: string): OfficialEntity[] {
  const search = normalizeArabic(query);
  return items.filter(item => (!category || item.category === category) && normalizeArabic([item.name, item.nameAr, item.description, item.descriptionAr].join(' ')).includes(search));
}
// PORT STATUS: source resources/js/Pages/SyOfficial/Index.tsx; confidence high; todos 0.
