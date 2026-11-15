import facts from '../../../../resources/data/promises.json';
import { PROMISE_SOURCE_TYPE_KEYS, PROMISE_STATE_KEYS, PROMISE_STATUS_KEYS, PROMISE_VENUE_KEYS, type Option, type PromiseCardData, type PromiseCounter, type PromiseDetailData, type PromiseStats, type PromiseState, type PromiseStatus, type PromiseVotes, type SectorOption, type SpeakerOption } from '../../../../resources/js/Domain/promises/types';
import { array, assetUrl, finiteNumber, integer, record, text } from '../../platform/validation';
export type { Option, PromiseCardData, PromiseCounter, PromiseDetailData, PromiseStats, PromiseState, PromiseVotes, SectorOption, SpeakerOption };
export type PromiseStateFilter = 'overdue' | 'due_soon' | 'open' | 'fulfilled' | 'partial' | 'broken' | 'other';
export interface FilterValue { search: string; sort: string; filters: Record<string, string[]> }
export interface FilterOptions { sectors: SectorOption[]; governorates: Option[]; institutions: { id: string; name: string }[]; speakers: { id: string; name: string }[]; tags: string[] }
export interface PromiseIndex { promises: PromiseCardData[]; stats: PromiseStats; filters: FilterOptions; dueSoonDays: number }
const invalid = (): never => { throw new Error('بيانات الوعود غير صالحة'); };
const name = (value: unknown) => { const result = text(value); return result.trim() ? result : invalid(); };
const id = (value: unknown) => { const result = name(value); return result.length <= 128 && /^[a-zA-Z0-9:_-]+$/.test(result) ? result : invalid(); };
const optionalText = (value: unknown): string | null => value == null ? null : text(value);
const optionalNumber = (value: unknown): number | null => value == null ? null : finiteNumber(value);
const count = (value: unknown): number => { const result = integer(value); return result >= 0 ? result : invalid(); };
export function promiseNumber(value: unknown): number { const result = integer(value); return result > 0 && result < 1_000_000_000 ? result : invalid(); }
export function dateOnly(value: unknown): string {
  const result = text(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) return invalid();
  const parsed = new Date(`${result}T12:00:00Z`); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === result ? result : invalid();
}
const optionalDate = (value: unknown) => value == null ? null : dateOnly(value);
export function safeSourceUrl(value: unknown): string { const result = text(value); try { const url = new URL(result); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : invalid(); } catch { return invalid(); } }
const optionalUrl = (value: unknown) => value == null || value === '' ? null : safeSourceUrl(value);
const boolean = (value: unknown): boolean => typeof value === 'boolean' ? value : invalid();
const state = (value: unknown): PromiseState => PROMISE_STATE_KEYS.includes(value as PromiseState) ? value as PromiseState : invalid();
const status = (value: unknown): PromiseStatus => PROMISE_STATUS_KEYS.includes(value as PromiseStatus) ? value as PromiseStatus : invalid();
function speaker(value: unknown): PromiseCardData['speaker'] { const raw = record(value); return { id: raw.id == null ? null : id(raw.id), name: optionalText(raw.name), title: optionalText(raw.title), image: assetUrl(raw.image) }; }
function sector(value: unknown): SectorOption { const raw = record(value); return { id: id(raw.id), label: name(raw.label), icon: optionalText(raw.icon) }; }
export function decodeVotes(value: unknown): PromiseVotes { const raw = record(value); return { yes: count(raw.yes), no: count(raw.no) }; }
export function decodePromiseCard(payload: unknown): PromiseCardData {
  const raw = record(payload); const counter = record(raw.counter); const modes = ['left', 'today', 'overdue', 'since', 'early', 'ontime', 'late', 'took', 'closed']; if (!modes.includes(text(counter.mode))) return invalid();
  const institution = raw.institution == null ? null : record(raw.institution); const target = raw.target == null ? null : record(raw.target);
  return { id: id(raw.id), number: promiseNumber(raw.number), title: name(raw.title), speaker: speaker(raw.speaker), coSpeakers: array(raw.coSpeakers ?? []).map(speaker), institution: institution ? { id: id(institution.id), name: name(institution.name) } : null, sector: raw.sector == null ? null : sector(raw.sector), isNational: boolean(raw.isNational), governorates: array(raw.governorates).map(id), tags: array(raw.tags).map(value => name(value)),
    statementDate: dateOnly(raw.statementDate), deadlineDate: optionalDate(raw.deadlineDate), deadlineWording: optionalText(raw.deadlineWording), status: status(raw.status), state: state(raw.state), daysLeft: raw.daysLeft == null ? null : integer(raw.daysLeft), daysSince: count(raw.daysSince), counter: { mode: counter.mode as PromiseCounter['mode'], value: counter.value == null ? null : count(counter.value) }, keptLate: boolean(raw.keptLate), resolvedAt: optionalDate(raw.resolvedAt),
    target: target ? { value: finiteNumber(target.value), unit: optionalText(target.unit), baseline: optionalNumber(target.baseline), baselineNote: optionalText(target.baselineNote), current: optionalNumber(target.current), currentOn: optionalDate(target.currentOn), percent: optionalNumber(target.percent) } : null,
    votingOpen: boolean(raw.votingOpen), votes: raw.votes == null ? { yes: 0, no: 0 } : decodeVotes(raw.votes), originalDeadlineDate: optionalDate(raw.originalDeadlineDate), originalDeadlineWording: optionalText(raw.originalDeadlineWording), postponedCount: count(raw.postponedCount ?? 0) };
}
function related(value: unknown): NonNullable<PromiseDetailData['restates']> { const raw = record(value); return { number: promiseNumber(raw.number), title: name(raw.title), state: state(raw.state), speakerName: optionalText(raw.speakerName), statementDate: optionalDate(raw.statementDate), deadlineDate: optionalDate(raw.deadlineDate) }; }
export function decodePromiseDetailPage(payload: unknown): PromiseDetailData {
  const raw = record(record(payload).promise);
  return { ...decodePromiseCard(raw), summary: optionalText(raw.summary), quote: text(raw.quote), quoteIsVerbatim: boolean(raw.quoteIsVerbatim), statementVenue: text(raw.statementVenue), deadlineReasoning: optionalText(raw.deadlineReasoning), governorateNames: array(raw.governorateNames).map(value => name(value)), speakerXHandle: optionalText(raw.speakerXHandle),
    sources: array(raw.sources).map(decodePromiseSource), updates: array(raw.updates).map(decodePromiseUpdate),
    restates: raw.restates == null ? null : related(raw.restates), restatedBy: raw.restatedBy == null ? null : related(raw.restatedBy), relatedPromises: array(raw.relatedPromises ?? []).map(related), votes: decodeVotes(raw.votes), publishedAt: optionalText(raw.publishedAt), updatedAt: optionalText(raw.updatedAt) };
}
export function decodePromiseSource(payload: unknown): PromiseDetailData['sources'][number] {
  const source = record(payload); const type = text(source.type); if (!PROMISE_SOURCE_TYPE_KEYS.includes(type as typeof PROMISE_SOURCE_TYPE_KEYS[number])) return invalid();
  return { id: count(source.id), url: safeSourceUrl(source.url), outlet: optionalText(source.outlet), type, publishedDate: optionalDate(source.publishedDate), language: optionalText(source.language), archiveUrl: optionalUrl(source.archiveUrl), screenshotUrl: assetUrl(source.screenshotUrl), videoTimestamp: optionalText(source.videoTimestamp), isPrimary: boolean(source.isPrimary) };
}
export function decodePromiseUpdate(payload: unknown): PromiseDetailData['updates'][number] {
  const update = record(payload); const type = text(update.type); if (!['progress', 'status_change', 'official_response', 'note', 'deadline_change'].includes(type)) return invalid();
  return { id: count(update.id), type: type as PromiseDetailData['updates'][number]['type'], happenedOn: dateOnly(update.happenedOn), body: optionalText(update.body), statusFrom: update.statusFrom == null ? null : status(update.statusFrom), statusTo: update.statusTo == null ? null : status(update.statusTo), value: optionalNumber(update.value), sourceUrl: optionalUrl(update.sourceUrl), archiveUrl: optionalUrl(update.archiveUrl) };
}
export function decodePromiseIndex(payload: unknown): PromiseIndex {
  const page = record(payload); const filters = record(page.filters); const stats = record(page.stats);
  const options = (value: unknown): Option[] => array(value).map(entry => { const row = record(entry); return { id: id(row.id), label: name(row.label) }; });
  const names = (value: unknown) => array(value).map(entry => { const row = record(entry); return { id: id(row.id), name: name(row.name) }; });
  const keys = ['total', 'fulfilled', 'keptLate', 'partiallyFulfilled', 'broken', 'overdue', 'open', 'postponed', 'retracted'] as const;
  const promises = array(page.promises).map(decodePromiseCard); if (new Set(promises.map(item => item.number)).size !== promises.length) return invalid();
  return { promises, stats: Object.fromEntries(keys.map(key => [key, count(stats[key])])) as unknown as PromiseStats, dueSoonDays: count(page.dueSoonDays), filters: { sectors: array(filters.sectors).map(sector), governorates: options(filters.governorates), institutions: names(filters.institutions), speakers: names(filters.speakers), tags: array(filters.tags).map(value => name(value)) } };
}
export function decodeSpeakers(payload: unknown): SpeakerOption[] { return array(record(payload).speakers).map(value => { const row = record(value); const source = text(row.source); if (!['speaker', 'candidate', 'official', 'house'].includes(source)) return invalid(); return { ref: id(row.ref), name: name(row.name), title: optionalText(row.title), image: assetUrl(row.image), source: source as SpeakerOption['source'], pending: boolean(row.pending) }; }); }
export function decodeSuggestPage(payload: unknown): { venues: string[]; earliestDate: string; today: string } { const page = record(payload); return { venues: array(page.venues).map(value => { const venue = text(value); return PROMISE_VENUE_KEYS.includes(venue as typeof PROMISE_VENUE_KEYS[number]) ? venue : invalid(); }), earliestDate: dateOnly(page.earliestDate), today: dateOnly(page.today) }; }
export const STATE_LABEL = Object.fromEntries(facts.states.map(item => [item.key, item.label])) as Record<PromiseState, string>;
export const VENUE_LABEL = Object.fromEntries(facts.venues.map(item => [item.key, item.label]));
export const SOURCE_LABEL = Object.fromEntries(facts.source_types.map(item => [item.key, item.label]));
export const isOpenState = (value: PromiseState): boolean => value === 'pending' || value === 'in_progress' || value === 'overdue';
const snapshot = (votes: PromiseVotes) => `${votes.yes}:${votes.no}`;
const seen = new Map<number, { votes: PromiseVotes; replaced: Set<string> }>();
export function newestVotes(number: number, fromProps: PromiseVotes): PromiseVotes { const mine = seen.get(number); return mine?.replaced.has(snapshot(fromProps)) ? mine.votes : fromProps; }
export function rememberVotes(number: number, votes: PromiseVotes, fromProps: PromiseVotes): void { const replaced = seen.get(number)?.replaced ?? new Set<string>(); replaced.add(snapshot(fromProps)); replaced.delete(snapshot(votes)); seen.set(number, { votes, replaced }); }
export interface SuggestionInput { speaker_ref: string | null; speaker_name: string | null; speaker_title: string | null; title: string; quote: string; statement_date: string; statement_venue: string; deadline_wording: string | null; source_urls: string[]; note: string | null }
export type ReportInput = { kind: 'progress' | 'error'; body: string; source_url: string | null };
export function validateSuggestion(input: SuggestionInput, earliest: string, today: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.speaker_ref && !input.speaker_name?.trim()) errors.speaker_name = 'اختر المسؤول أو اكتب اسمه';
  for (const [key, value, maximum] of [['speaker_name', input.speaker_name, 255], ['speaker_title', input.speaker_title, 255], ['title', input.title, 200], ['quote', input.quote, 5000], ['deadline_wording', input.deadline_wording, 255], ['note', input.note, 2000]] as const) if (value && value.length > maximum) errors[key] = `${maximum} حرفاً كحد أقصى`;
  if (!input.title.trim()) errors.title = 'اكتب عنواناً مختصراً للوعد'; if (!input.quote.trim()) errors.quote = 'اكتب نص الوعد كما قاله المسؤول';
  try { dateOnly(input.statement_date); if (input.statement_date < earliest || input.statement_date > today) errors.statement_date = 'اختر تاريخاً ضمن الفترة المتاحة'; } catch { errors.statement_date = 'تاريخ التصريح غير صالح'; }
  if (!PROMISE_VENUE_KEYS.includes(input.statement_venue as typeof PROMISE_VENUE_KEYS[number])) errors.statement_venue = 'اختر مكان التصريح';
  if (!input.source_urls.length || input.source_urls.length > 5) errors.source_urls = 'أضف من مصدر واحد إلى خمسة مصادر';
  input.source_urls.forEach((url, index) => { try { if (url.length > 2048) throw new Error(); safeSourceUrl(url); } catch { errors[`source_urls.${index}`] = 'رابط المصدر غير صالح'; } });
  return errors;
}
export function validateReport(input: ReportInput): Record<string, string> { const errors: Record<string, string> = {}; if (input.body.trim().length < 10 || input.body.length > 2000) errors.body = 'اكتب من10 إلى2000 حرف'; if (input.kind === 'progress' && !input.source_url) errors.source_url = 'أرفق رابطاً يثبت التحديث'; if (input.source_url) { try { if (input.source_url.length > 2048) throw new Error(); safeSourceUrl(input.source_url); } catch { errors.source_url = 'رابط المصدر غير صالح'; } } return errors; }
// PORT STATUS: source Domain/promises/types.ts and Pages/Promises/_lib/useVote.ts; confidence high; todos 0.
