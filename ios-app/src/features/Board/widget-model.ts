import { array, finiteNumber, integer, record, text } from '../../platform/validation';
import { externalUrl } from '../../platform/links-model';
export interface TodoItem { id: string; text: string; done: boolean }
export function todoItems(value: unknown): TodoItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(item => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.text === 'string').slice(0, 50)
    .map((item: Record<string, unknown>) => ({ id: String(item.id), text: String(item.text).slice(0, 200), done: item.done === true }));
}
export const bounded = (value: unknown, min: number, max: number, fallback: number): number => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Math.round(Number(value)))) : fallback;
export function decodeAnswers(value: unknown) { return array(record(value).items).map(raw => { const row = record(raw); return { id: text(row.id), title: text(row.title), url: externalUrl(text(row.url)), tags: array(row.tags).map(tag => text(tag)), count: integer(row.answer_count) }; }); }
export function decodeFeed(value: unknown) { const row = record(value); return { title: text(row.title), items: array(row.items).map(raw => { const item = record(raw); return { title: text(item.title), url: item.link == null ? null : externalUrl(text(item.link)), at: text(item.published_at, '') }; }) }; }
export function decodeRecipe(value: unknown) {
  const raw = record(value).recipe; if (raw == null) return null; const row = record(raw);
  return { name: text(row.name), url: externalUrl(text(row.url)), image: row.image_url == null ? null : externalUrl(text(row.image_url)), city: text(row.city, ''), difficulty: text(row.difficulty, ''), tags: array(row.tags).map(tag => text(tag)), time: array(row.time_needed).map(item => text(record(item).value)).join('، ') };
}
export function decodeGuides(value: unknown) { return array(record(value).guides).map(raw => { const row = record(raw); return { id: integer(row.user_id), name: text(row.name), rank: integer(row.rank), approved: integer(row.approved_count), saves: integer(row.saves_total), avatar: row.avatar_url == null ? null : externalUrl(text(row.avatar_url)) }; }); }
export function decodeNearby(value: unknown) { return array(record(value).places).map(raw => { const row = record(raw); return { id: integer(row.id), name: text(row.name), category: text(row.category), distance: finiteNumber(row.distance_m) }; }); }
