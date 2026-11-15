import { array, assetUrl, integer, record, text } from '../validation';

export interface AdminField {
  key: string; label: string; kind?: 'id' | 'url' | 'toggle' | 'multiline' | 'category' | 'attributes'; required?: boolean; max?: number; immutable?: boolean;
}
export type AdminValues = Record<string, string | boolean>;
export interface AdminRow {
  id: string; title: string; active: boolean; order: number; categoryId: string; image: string | null; values: AdminValues; original: Record<string, unknown>;
}
export interface AdminCategory extends AdminRow { labelEn: string; icon: string }
export interface AdminData { categories: AdminRow[]; items: AdminRow[] }
export type AdminKind = 'categories' | 'items';
export interface AdminDefinition {
  key: 'phonebook' | 'govapps' | 'syofficial' | 'guesswho'; title: string; component: string;
  itemPath: string; categories: boolean; itemFields: readonly AdminField[]; categoryFields: readonly AdminField[];
  image?: { field: string; required: boolean }; reorder: boolean; toggle: boolean; decode(value: unknown): AdminData;
}
export const categoryFields: readonly AdminField[] = [
  { key: 'id', label: 'معرّف الفئة', kind: 'id', max: 64, required: true, immutable: true },
  { key: 'label_ar', label: 'الاسم بالعربية', required: true, max: 255 }, { key: 'label_en', label: 'الاسم بالإنجليزية', required: true, max: 255 },
  { key: 'is_active', label: 'مفعّلة وتظهر في الدليل', kind: 'toggle' }
];
export function adminPermission(definition: AdminDefinition, action: 'create' | 'edit' | 'delete' | 'reorder' | 'toggle'): string { return definition.key === 'guesswho' ? 'guesswho.manage' : `${definition.key}.${action}`; }

const boolean = (value: unknown): boolean => { if (typeof value !== 'boolean') throw new Error('حالة الظهور غير صالحة.'); return value; };
export function adminId(value: unknown): string {
  if (typeof value === 'number' && integer(value) < 1) throw new Error('المعرّف غير صالح.');
  const id = typeof value === 'number' ? String(integer(value)) : text(value);
  if (!id || id.length > 255 || !/^[\p{L}\p{M}\p{N}_-]+$/u.test(id)) throw new Error('المعرّف غير صالح.');
  return id;
}
export function decodeAdminCategory(value: unknown): AdminCategory {
  const row = record(value), id = adminId(row.id), active = boolean(row.is_active), labelAr = text(row.label_ar), labelEn = text(row.label_en);
  return { id, title: labelAr, labelEn, icon: text(row.icon, ''), active, order: row.order_column == null ? 0 : integer(row.order_column), categoryId: '', image: null, original: row,
    values: { id, label_ar: labelAr, label_en: labelEn, icon: text(row.icon, ''), is_active: active } };
}
function dictionary(value: unknown, allowList = false): Record<string, unknown> {
  if (value == null || Array.isArray(value) && !value.length) return {};
  if (allowList && Array.isArray(value)) return Object.fromEntries(value.map((item, index) => [String(index), item]));
  return record(value);
}
export function attributesText(value: unknown): string { return Object.entries(dictionary(value, true)).map(([key, item]) => `${key}: ${String(item)}`).join('\n'); }
export function parseAttributes(value: string): Record<string, string> | [] {
  const result: Record<string, string> = {};
  for (const line of value.split('\n')) {
    const separator = line.indexOf(':'); if (separator < 0) continue;
    const key = line.slice(0, separator).trim(); if (!key) continue;
    if (/[\[\]\u0000-\u001f]/.test(key)) throw new Error('اسم السمة لا يحتوي أقواساً أو محارف تحكم.');
    Object.defineProperty(result, key, { configurable: true, enumerable: true, writable: true, value: line.slice(separator + 1).trim() });
  }
  return Object.keys(result).length ? result : [];
}
export function decodeAdminRows(value: unknown, fields: readonly AdminField[], { imageKey, storageImage = false }: { imageKey?: string; storageImage?: boolean } = {}): AdminRow[] {
  const seen = new Set<string>();
  return array(value).map(item => {
    const row = record(item), id = adminId(row.id); if (seen.has(id)) throw new Error('معرّف مكرر في القائمة.'); seen.add(id);
    const values: AdminValues = {};
    for (const field of fields) {
      const [group, key] = field.key.split('.');
      const raw = key ? dictionary(row[group!], group === 'links')[key] : row[field.key];
      values[field.key] = field.kind === 'toggle' ? boolean(raw) : field.kind === 'attributes' ? attributesText(raw) : field.key === 'id' ? id : field.kind === 'category' && typeof raw === 'number' ? adminId(raw) : text(raw, '');
    }
    for (const group of ['socials', 'links']) for (const [key, raw] of Object.entries(dictionary(row[group], group === 'links'))) {
      if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw new Error('اسم منصة غير صالح.'); values[`${group}.${key}`] = text(raw, '');
    }
    const path = imageKey ? text(row[imageKey], '') : '';
    const image = path ? assetUrl(storageImage ? `/storage/${path}` : path) : null;
    return { id, title: text(row.name_ar ?? row.label_ar ?? row.name), active: boolean(row.is_active), order: row.order_column == null ? 0 : integer(row.order_column),
      categoryId: row.category_id == null ? '' : adminId(row.category_id), image, values, original: row };
  });
}
export function fieldErrors(fields: readonly AdminField[], values: AdminValues, creating: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.immutable && !creating || field.kind === 'toggle') continue;
    const value = String(values[field.key] ?? '').trim();
    if (field.required && !value) { errors[field.key] = 'هذا الحقل مطلوب.'; continue; }
    if (field.max && [...value].length > field.max) { errors[field.key] = `الحد الأقصى ${field.max} حرفاً.`; continue; }
    if (field.kind === 'id' && value && !/^[\p{L}\p{M}\p{N}_-]+$/u.test(value)) errors[field.key] = 'المعرّف يحتوي حروفاً وأرقاماً وشرطة فقط.';
    if (field.kind === 'url' && value) try { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(); } catch { errors[field.key] = 'أدخل رابط HTTP أو HTTPS صحيحاً.'; }
    if (field.kind === 'attributes') try { parseAttributes(value); } catch (reason) { errors[field.key] = reason instanceof Error ? reason.message : 'تحقق من السمات.'; }
  }
  return errors;
}
export function formPayload(fields: readonly AdminField[], values: AdminValues, creating: boolean, original: Record<string, unknown> = {}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.immutable && !creating) continue;
    const value = values[field.key] ?? (field.kind === 'toggle' ? false : '');
    if (field.key.includes('.')) continue;
    if (field.kind === 'attributes') payload[field.key] = String(value) === attributesText(original[field.key]) ? original[field.key] ?? [] : parseAttributes(String(value));
    else if (field.key !== 'id' || String(value).trim()) payload[field.key] = typeof value === 'string' ? value.trim() : value;
  }
  for (const group of ['socials', 'links']) {
    const entries = Object.entries(values).filter(([key]) => key.startsWith(`${group}.`));
    if (entries.length) payload[group] = Object.fromEntries(entries.map(([key, value]) => [key.slice(group.length + 1), String(value).trim()]));
  }
  return payload;
}
export function appendAdminFields(form: { append(key: string, value: string): void }, payload: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'attributes') { form.append('attributes_json', JSON.stringify(value)); continue; }
    if (value !== null && typeof value === 'object') for (const [child, entry] of Object.entries(value)) form.append(`${key}[${child}]`, entry == null ? '' : String(entry));
    else form.append(key, typeof value === 'boolean' ? value ? '1' : '0' : value == null ? '' : String(value));
  }
}
export function orderedMove(ids: readonly string[], index: number, delta: -1 | 1): { id: string; order_column: number }[] {
  const next = [...ids], target = index + delta;
  if (new Set(ids).size !== ids.length || !Number.isInteger(index) || index < 0 || index >= ids.length || target < 0 || target >= ids.length) throw new Error('ترتيب غير صالح.');
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next.map((id, order_column) => ({ id, order_column }));
}
export function adminAck(value: unknown): void { if (record(value).success !== true) throw new Error('لم يؤكد الخادم حفظ التغيير.'); }
