import { array, assetUrl, finiteNumber, integer, record, text } from '../../platform/validation';
import { AXES, decodeStatsPage } from './model';
import type { AxisId } from '../../../../resources/js/Domain/compass/types';

export interface AdminFigure { id: number; name: string; category: string; align: string; positions: Partial<Record<AxisId, number | null>>; imagePath: string | null; imageUrl: string | null; enabled: boolean; sortOrder: number }
export interface AdminPersona { id: number; slug: string; name: string; icon: string | null; short: string; factoid: string; stances: string[]; center: Partial<Record<AxisId, number | null>>; ranges: Partial<Record<AxisId, { min: number; max: number }>>; enabled: boolean; sortOrder: number }
export interface FigureForm { name: string; category: string; align: string; enabled: boolean; positions: Record<string, string>; imageUrl: string | null; imagePath: string | null; sortOrder: string }
export interface PersonaForm { name: string; icon: string; short: string; factoid: string; stances: string[]; enabled: boolean; center: Record<string, string>; ranges: Record<string, { min: string; max: string }>; sortOrder: string }
const dictionary = (value: unknown) => value == null || (Array.isArray(value) && value.length === 0) ? {} : record(value);
const bool = (value: unknown) => { if (typeof value !== 'boolean') throw new Error('حالة التفعيل غير صالحة'); return value; };
const id = (value: unknown) => { const number = integer(value); if (number < 1) throw new Error('معرّف غير صالح'); return number; };
const position = (value: unknown) => { const number = finiteNumber(value); if (number < -1 || number > 1) throw new Error('الموقف على المحور يجب أن يكون بين -1 و1'); return number; };
function vector(value: unknown): Partial<Record<AxisId, number | null>> { const raw = dictionary(value); return Object.fromEntries(AXES.filter(axis => Object.hasOwn(raw, axis.id)).map(axis => [axis.id, raw[axis.id] == null ? null : position(raw[axis.id])])); }
function distinct<T extends { id: number }>(rows: T[]): T[] { if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('معرّفات مكررة'); return rows; }
export function decodeAdminFigures(value: unknown): { figures: AdminFigure[]; categories: string[] } {
  const root = record(value);
  return { categories: array(root.categories).map(item => text(item)), figures: distinct(array(root.figures).map(item => { const raw = record(item); return { id: id(raw.id), name: text(raw.name), category: text(raw.category), align: text(raw.align, 'neutral'), positions: vector(raw.positions), imagePath: raw.imagePath == null ? null : text(raw.imagePath), imageUrl: assetUrl(raw.imageUrl), enabled: bool(raw.enabled), sortOrder: integer(raw.sortOrder) }; })) };
}
export function decodeAdminPersonas(value: unknown): { personas: AdminPersona[]; icons: string[] } {
  const root = record(value);
  return { icons: array(root.icons).map(item => text(item)), personas: distinct(array(root.personas).map(item => {
    const raw = record(item); const ranges = dictionary(raw.ranges);
    return { id: id(raw.id), slug: text(raw.slug), name: text(raw.name), icon: raw.icon == null ? null : text(raw.icon), short: text(raw.short, ''), factoid: text(raw.factoid, ''), stances: array(raw.stances ?? []).map(stance => text(stance)), center: vector(raw.center), ranges: Object.fromEntries(AXES.filter(axis => ranges[axis.id] != null).map(axis => { const range = record(ranges[axis.id]); const min = position(range.min), max = position(range.max); return [axis.id, { min, max }]; })), enabled: bool(raw.enabled), sortOrder: integer(raw.sortOrder) };
  })) };
}
function bounded(value: string, max: number, required = false): string { const result = value.trim(); if ((required && !result) || result.length > max) throw new Error(required && !result ? 'الاسم مطلوب' : `النص يتجاوز ${max} حرفاً`); return result; }
function sortOrder(value: string): number { const result = Number(value); if (!value.trim() || !Number.isSafeInteger(result) || result < 0 || result > 100000) throw new Error('الترتيب يجب أن يكون عدداً بين0 و100000'); return result; }
function inputPosition(value: string | undefined): number | null { return value == null || value.trim() === '' ? null : position(Number(value)); }
function inputVector(values: Record<string, string>): Record<AxisId, number | null> { return Object.fromEntries(AXES.map(axis => [axis.id, inputPosition(values[axis.id])])) as Record<AxisId, number | null>; }
export function figurePayload(form: FigureForm, categories: readonly string[]) {
  if (!categories.includes(form.category)) throw new Error('اختر فئة من القائمة');
  if (!['west', 'gulf', 'turkish', 'east', 'neutral'].includes(form.align)) throw new Error('اختر تحالفاً من القائمة');
  return { name: bounded(form.name, 255, true), category: form.category, align: form.align, enabled: form.enabled, image_url: assetUrl(form.imageUrl), image_path: form.imagePath ? bounded(form.imagePath, 1024) : null, positions: inputVector(form.positions), sort_order: sortOrder(form.sortOrder) };
}
export function personaPayload(form: PersonaForm, icons: readonly string[]) {
  if (!icons.includes(form.icon)) throw new Error('اختر رمزاً من القائمة');
  const stances = form.stances.map(stance => bounded(stance, 120)).filter(Boolean); if (stances.length > 12) throw new Error('الحد الأقصى12 موقفاً');
  const ranges: Partial<Record<AxisId, { min: number | null; max: number | null }>> = {};
  for (const axis of AXES) { const row = form.ranges[axis.id]; if (!row) continue; const min = inputPosition(row.min), max = inputPosition(row.max); if (min === null && max === null) continue; if ((min ?? -1) > (max ?? 1)) throw new Error(`الحد الأدنى أكبر من الأعلى: ${axis.name}`); ranges[axis.id] = { min, max }; }
  return { name: bounded(form.name, 255, true), icon: form.icon, short: bounded(form.short, 600), factoid: bounded(form.factoid, 4000), stances, enabled: form.enabled, center: inputVector(form.center), ranges: Object.keys(ranges).length ? ranges : null, sort_order: sortOrder(form.sortOrder) };
}
export function decodeAdminStats(value: unknown) {
  const base = decodeStatsPage(value), raw = record(record(value).stats);
  const optional = (input: unknown) => input == null ? null : finiteNumber(input);
  return { ...base, last7: integer(raw.last7), last30: integer(raw.last30), avgConsistency: optional(raw.avgConsistency), avgAnswered: optional(raw.avgAnswered), alignTotals: Object.fromEntries(Object.entries(dictionary(raw.alignTotals)).map(([key, input]) => [key, finiteNumber(input)])), daily: array(raw.daily).map(input => { const row = record(input); return { date: text(row.date), count: integer(row.count) }; }), recent: array(raw.recent).map(input => { const row = record(input); const version = text(row.version); if (!['short', 'standard', 'full'].includes(version)) throw new Error('نسخة غير صالحة'); return { id: id(row.id), createdAt: row.createdAt == null ? null : text(row.createdAt), version, spectrum: row.spectrum == null ? null : text(row.spectrum), consistency: optional(row.consistency), answered: integer(row.answered), topScore: optional(row.topScore) }; }) };
}
export const CATEGORY_LABEL: Readonly<Record<string, string>> = { founder: 'مؤسّسو الاستقلال', baath: 'قوميون/بعث', islam: 'إسلاميون', civ: 'معارضة مدنية', kurd: 'أكراد', minority: 'أقليات', current: 'معاصرون' };
export const ALIGN_LABEL: Readonly<Record<string, string>> = { west: 'غربي', gulf: 'خليجي', turkish: 'تركي', east: 'شرقي', neutral: 'حياد' };
// PORT STATUS: source Admin/Compass/{Figures,Personas,Index}.tsx and CompassAdminController.php; confidence high; todos 0.
