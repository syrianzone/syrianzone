// eslint-disable-next-line @typescript-eslint/no-require-imports -- Run the unchanged web search algorithm across the native boundary.
const { normalizeArabic } = require('../../../../resources/js/Lib/arabic') as { normalizeArabic(value: string): string };
import { array, record, text } from '../../platform/validation';

export interface PhoneCategory { id: string; labelAr: string; labelEn: string }
export interface PhoneEntry {
  id: string; categoryId: string; categoryAr: string; categoryEn: string;
  nameAr: string; nameEn: string; number: string; whatsapp: boolean; source: string | null;
}
export interface PhonebookPage { categories: PhoneCategory[]; entries: PhoneEntry[] }

function sourceUrl(value: unknown): string | null {
  if (value == null || value === '') return null;
  const url = new URL(text(value));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('رابط المصدر غير صالح.');
  return url.toString();
}

export function decodePhonebook(value: unknown): PhonebookPage {
  const page = record(value);
  const categories = array(page.categories ?? []).map(item => { const c = record(item); return { id: text(c.id), labelAr: text(c.label_ar), labelEn: text(c.label_en, '') }; });
  const entries = array(page.initialData).map(item => {
      const row = record(item);
      if (typeof row.is_whatsapp !== 'boolean') throw new Error('بيانات رقم الهاتف غير صالحة.');
      const categoryEn = text(row.category_en, '');
      const categoryKey = categoryEn.toLowerCase().replace(/\s+/g, '_');
      return { id: text(row.id), categoryId: categories.length ? text(row.category_id, categoryKey) : categoryKey,
        categoryAr: text(row.category_ar, ''), categoryEn, nameAr: text(row.name_ar), nameEn: text(row.name_en, ''),
        number: text(row.number), whatsapp: row.is_whatsapp, source: sourceUrl(row.source_url) };
    });
  if (!categories.length) {
    const derived = new Map<string, PhoneCategory>();
    for (const item of entries) if (item.categoryEn) derived.set(item.categoryId, { id: item.categoryId, labelAr: item.categoryAr || item.categoryEn, labelEn: item.categoryEn });
    categories.push(...derived.values());
  }
  return { categories, entries };
}

const stripNumber = (value: string): string => value.replace(/[\s\-()+]/g, '');
export function filterPhonebook(entries: PhoneEntry[], query: string, category: string): PhoneEntry[] {
  const search = normalizeArabic(query);
  const digits = stripNumber(query);
  const isShortCode = (number: string): boolean => /^\d{3}$/.test(stripNumber(number));
  return entries.filter(item => (!category || item.categoryId === category) &&
    (normalizeArabic([item.nameAr, item.nameEn, item.categoryAr, item.categoryEn].join(' ')).includes(search) ||
      (digits !== '' && stripNumber(item.number).includes(digits)))).sort((a, b) => Number(isShortCode(b.number)) - Number(isShortCode(a.number)));
}
export function callNumber(value: string): string {
  const number = value.replace(/[\s\-()]/g, '');
  if (!/^\+?[0-9*#]+$/.test(number)) throw new Error('رقم الهاتف غير صالح.');
  return number;
}
export function whatsappUrl(value: string): string {
  let number = callNumber(value);
  if (number.startsWith('00')) number = number.slice(2);
  else if (number.startsWith('+')) number = number.slice(1);
  if (number.startsWith('09') && number.length === 10) number = `963${number.slice(1)}`;
  if (!/^\d+$/.test(number)) throw new Error('رقم واتساب غير صالح.');
  return `https://wa.me/${number}`;
}
// PORT STATUS: source resources/js/Pages/Phonebook/Index.tsx; confidence high; todos 0.
