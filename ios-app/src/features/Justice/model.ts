import raw from '../../../../resources/js/Pages/Justice/_data/detainees.json';
import { array, assetUrl, integer, record, text } from '../../platform/validation';
export interface Person { name: string; role: string; photo: string | null }
export interface JusticeData { meta: { asOf: string; source: string; sourceUrl: string; totalDetainees: number; rankedTotal: number }; ranks: { ar: string; count: number }[]; individuals: Person[]; hierarchy: { root: Person; groups: { title: string; members: Person[] }[] } }
const name = (value: unknown): string => { const result = text(value); if (!result.trim()) throw new Error('اسم غير صالح'); return result; };
const count = (value: unknown): number => { const result = integer(value); if (result < 0) throw new Error('عدد غير صالح'); return result; };
function person(value: unknown): Person { const row = record(value); return { name: name(row.name), role: text(row.role, ''), photo: assetUrl(row.photo) }; }
export function decodeJustice(payload: unknown): JusticeData {
  const data = record(payload); const meta = record(data.meta); const hierarchy = record(data.hierarchy);
  const asOf = text(meta.asOf); if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf))) throw new Error('تاريخ المصدر غير صالح');
  return { meta: { asOf, source: text(meta.source), sourceUrl: assetUrl(meta.sourceUrl) ?? '', totalDetainees: count(meta.totalDetainees), rankedTotal: count(meta.rankedTotal) },
    ranks: array(data.ranks).map(value => { const row = record(value); return { ar: name(row.ar), count: count(row.count) }; }), individuals: array(data.individuals).map(person),
    hierarchy: { root: person(hierarchy.root), groups: array(hierarchy.groups).map(value => { const row = record(value); return { title: name(row.title), members: array(row.members).map(person) }; }) } };
}
export const justice = decodeJustice(raw);
// PORT STATUS: source resources/js/Pages/Justice/Index.tsx; confidence high; todos 0.
