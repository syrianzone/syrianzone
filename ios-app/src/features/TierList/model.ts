import facts from '../../../../resources/data/polls.json';
import { TIERS, TIER_KEYS, type TierKey } from '../../../../resources/js/Domain/polls/tiers';
import { array, assetUrl, finiteNumber, integer, record, text } from '../../platform/validation';
export { TIERS, TIER_KEYS, type TierKey };
export const CORE_POLL_SLUG = facts.core_slug;
export interface Poll { id: string; slug: string; title: string; active: boolean }
export interface Group { id: string; name: string; key: string; isDefault: boolean; rankingKey: string }
export interface Candidate { id: string; name: string; title: string | null; imageUrl: string | null; originalUrl: string | null; groupId: string | null; category: string | null }
export interface TierPage { poll: Poll; groups: Group[]; candidates: Candidate[]; voteDay: string }
export interface Board { groupId: string; bank: string[]; tiers: Record<TierKey, string[]> }
export interface RankingRow { candidateId: string; name: string; title: string | null; imageUrl: string | null; rank: number; score: number; votes: number; avg: number; status: 'active' | 'archived'; termStartedAt: string | null; termEndedAt: string | null; archiveReason: string | null; successorId: string | null }
export interface HistoryPoint { date: string; votes: number; score: number }
export type History = Record<string, HistoryPoint[]>;
export interface Leaderboard { poll: Poll; groups: Group[]; rankings: Record<string, RankingRow[]>; history: History; generatedAt: string | null }
export type Timeframe = 'day' | 'week' | 'month' | 'year';
const invalid = (): never => { throw new Error('بيانات التقييم غير صالحة'); };
const id = (value: unknown): string => { const result = text(value); return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(result) ? result : invalid(); };
const nullableText = (value: unknown) => value == null ? null : text(value);
const count = (value: unknown) => { const result = integer(value); return result >= 0 ? result : invalid(); };
function poll(value: unknown): Poll { const raw = record(value); const slug = text(raw.slug); if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(slug)) return invalid(); return { id: id(raw.id), slug, title: text(raw.title), active: raw.is_active == null ? true : raw.is_active === true || raw.is_active === 1 }; }
function groups(value: unknown): Group[] {
  const seen = new Set<string>();
  return array(value).map(entry => { const raw = record(entry); const groupId = id(raw.id); if (seen.has(groupId)) return invalid(); seen.add(groupId); const key = text(raw.key, ''); const rankingKey = text(raw.rankingKey, key || groupId); if (['__proto__', 'constructor', 'prototype'].includes(rankingKey)) return invalid(); return { id: groupId, name: text(raw.name), key, rankingKey, isDefault: raw.is_default === true || raw.isDefault === true }; });
}
export function decodePollsPage(payload: unknown): Poll[] { return array(record(payload).polls).map(poll); }
export function decodeTierPage(payload: unknown): TierPage {
  const raw = record(payload); const loadedGroups = groups(raw.groups); const seen = new Set<string>();
  const candidates = array(raw.candidates).map((entry): Candidate => {
    const row = record(entry); const candidateId = id(row.id); if (seen.has(candidateId)) return invalid(); seen.add(candidateId);
    const groupId = row.candidate_group_id == null ? null : id(row.candidate_group_id);
    if (groupId && loadedGroups.length && !loadedGroups.some(group => group.id === groupId)) return invalid();
    return { id: candidateId, name: text(row.name), title: nullableText(row.title), imageUrl: assetUrl(row.imageUrl), originalUrl: assetUrl(row.originalUrl), groupId, category: nullableText(row.category) };
  });
  const voteDay = text(raw.voteDay); if (!Number.isFinite(Date.parse(voteDay))) return invalid();
  return { poll: poll(raw.poll), groups: loadedGroups, candidates, voteDay };
}
export function shuffled<T>(values: readonly T[], seed: string): T[] {
  let hash = 1779033703 ^ seed.length;
  for (let index = 0; index < seed.length; index += 1) { hash = Math.imul(hash ^ seed.charCodeAt(index), 3432918353); hash = hash << 13 | hash >>> 19; }
  hash = Math.imul(hash ^ hash >>> 16, 2246822507); hash = Math.imul(hash ^ hash >>> 13, 3266489909); let state = (hash ^ hash >>> 16) >>> 0;
  const random = () => { state |= 0; state = state + 0x6d2b79f5 | 0; let value = Math.imul(state ^ state >>> 15, 1 | state); value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value; return ((value ^ value >>> 14) >>> 0) / 4294967296; };
  const result = [...values]; for (let index = result.length - 1; index > 0; index -= 1) { const other = Math.floor(random() * (index + 1)); [result[index], result[other]] = [result[other]!, result[index]!]; } return result;
}
export function initialBoard(data: TierPage, groupId: string): Board {
  const group = data.groups.find(candidateGroup => candidateGroup.id === groupId);
  if (data.groups.length && !group) return invalid();
  const bank = shuffled(data.candidates, `${data.poll.id}|${data.voteDay}`).filter(candidate => { if (!data.groups.length) return true; return candidate.groupId ? candidate.groupId === groupId : candidate.category === group?.key; }).map(candidate => candidate.id);
  return { groupId, bank, tiers: { S: [], A: [], B: [], C: [], D: [], F: [] } };
}
export function moveCandidates(state: Board, ids: readonly string[], target: TierKey | 'bank'): Board {
  const all = [...TIER_KEYS.flatMap(tier => state.tiers[tier]), ...state.bank]; const selected = new Set(ids);
  if (ids.some(candidate => !all.includes(candidate)) || new Set(all).size !== all.length) return invalid();
  const moved = all.filter(candidate => selected.has(candidate));
  const tiers = Object.fromEntries(TIER_KEYS.map(tier => [tier, [...state.tiers[tier].filter(candidate => !selected.has(candidate)), ...(target === tier ? moved : [])]])) as Record<TierKey, string[]>;
  return { groupId: state.groupId, tiers, bank: [...state.bank.filter(candidate => !selected.has(candidate)), ...(target === 'bank' ? moved : [])] };
}
export function ballot(data: TierPage, state: Board, deviceId: string): { pollSlug: string; deviceId: string; tiers: Record<TierKey, { candidateId: string; pos: number }[]> } {
  const assigned = TIER_KEYS.flatMap(tier => state.tiers[tier]); if (assigned.length < facts.min_selections) throw new Error(`الحد الأدنى للاختيار هو ${facts.min_selections}`);
  const eligible = new Set(initialBoard(data, state.groupId).bank);
  if (deviceId.length < 8 || assigned.some(candidate => !eligible.has(candidate)) || new Set(assigned).size !== assigned.length || assigned.some(candidate => !data.candidates.some(item => item.id === candidate))) return invalid();
  return { pollSlug: data.poll.slug, deviceId, tiers: Object.fromEntries(TIER_KEYS.map(tier => [tier, state.tiers[tier].map((candidateId, pos) => ({ candidateId, pos }))])) as Record<TierKey, { candidateId: string; pos: number }[]> };
}
export function decodeLeaderboard(payload: unknown): Leaderboard {
  const raw = record(payload); const loadedGroups = groups(raw.groups); const rankings: Leaderboard['rankings'] = {};
  for (const group of loadedGroups) rankings[group.rankingKey] = array(raw[group.rankingKey] ?? []).map((value): RankingRow => { const row = record(value); if (row.status != null && row.status !== 'active' && row.status !== 'archived') return invalid(); return { candidateId: id(row.candidateId), name: text(row.name), title: nullableText(row.title), imageUrl: assetUrl(row.imageUrl), rank: count(row.rank), score: finiteNumber(row.score), votes: count(row.votes), avg: finiteNumber(row.avg), status: row.status === 'archived' ? 'archived' : 'active', termStartedAt: nullableText(row.termStartedAt), termEndedAt: nullableText(row.termEndedAt), archiveReason: nullableText(row.archiveReason), successorId: row.successorId == null ? null : id(row.successorId) }; });
  const history: History = {}; const rawHistory = Array.isArray(raw.history) && raw.history.length === 0 ? {} : record(raw.history ?? {});
  for (const [candidateId, points] of Object.entries(rawHistory)) {
    id(candidateId); const days = new Map<string, HistoryPoint>();
    for (const value of array(points)) {
      const row = record(value); const rawDate = text(row.date);
      if (!/^\d{4}-\d{2}-\d{2}(?:[ T](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?)?$/.test(rawDate)) return invalid();
      const date = rawDate.slice(0, 10); const calendar = new Date(`${date}T12:00:00Z`);
      if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== date) return invalid();
      const previous = days.get(date); days.set(date, { date, votes: count((previous?.votes ?? 0) + count(row.votes)), score: finiteNumber((previous?.score ?? 0) + finiteNumber(row.score)) });
    }
    history[candidateId] = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
  return { poll: poll(raw.poll), groups: loadedGroups, rankings, history, generatedAt: nullableText(raw.generated_at) };
}
export function seriesData(history: History, candidates: string[], metric: 'votes' | 'score', timeframe: Timeframe, mode: 'cumulative' | 'periodic'): { date: string; values: Record<string, number> }[] {
  const dates = [...new Set(Object.values(history).flatMap(points => points.map(point => point.date)))].sort(); const running = Object.fromEntries(candidates.map(candidate => [candidate, 0]));
  const buckets = new Map<string, Record<string, number>>();
  for (const date of dates) {
    const calendar = new Date(`${date}T12:00:00Z`); let key = date;
    if (timeframe === 'week') { const day = calendar.getUTCDay(); calendar.setUTCDate(calendar.getUTCDate() - (day === 0 ? 6 : day - 1)); key = calendar.toISOString().slice(0, 10); }
    else if (timeframe === 'month') key = date.slice(0, 7); else if (timeframe === 'year') key = date.slice(0, 4);
    const values = buckets.get(key) ?? Object.fromEntries(candidates.map(candidate => [candidate, 0]));
    for (const candidate of candidates) { const raw = history[candidate]?.find(point => point.date === date)?.[metric] ?? 0; running[candidate] = (running[candidate] ?? 0) + raw; values[candidate] = mode === 'cumulative' ? running[candidate] : (values[candidate] ?? 0) + raw; }
    buckets.set(key, values);
  }
  return [...buckets].map(([date, values]) => ({ date, values }));
}
// PORT NOTE: The public history API emits date-only or SQL timestamp labels. Keep their calendar date and combine same-day rows without losing votes or scores.
// Calendar-day buckets use UTC date arithmetic so the same poll date groups identically on phones in every timezone.
// PORT STATUS: source resources/js/Domain/polls/TierBoard.tsx and Pages/Polls/_components/TimeseriesChart.tsx; confidence high; todos 0.

export function pollCooldownKey(pollId: string, voteDay: string): string {
  const timestamp = Date.parse(voteDay);
  if (!Number.isFinite(timestamp)) return invalid();
  return `submitCooldown.${id(pollId)}.${timestamp}`;
}
