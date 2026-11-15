import { AXES } from '../../../../resources/js/Domain/compass/axes';
import type { AlignBloc, AnswerMap, AxisId, CompassResult, CompassStatsPayload, Figure, QuizVersion, Spectrum } from '../../../../resources/js/Domain/compass/types';
import { array, assetUrl, finiteNumber, integer, record, text } from '../../platform/validation';
import { engine } from './engine';
export { AXES, type AnswerMap, type CompassResult, type CompassStatsPayload, type Figure, type QuizVersion, type Spectrum };
export interface CompassConfig { figures: Figure[]; personas: Spectrum[] }
export type IdentifiedResult = CompassResult & { id: string | number };
export interface Progress { version: QuizVersion; answers: AnswerMap; index: number; updatedAt: string }
export function quizCommand(key: string): { kind: 'answer'; value: number } | { kind: 'previous' | 'next' } | null {
  if (/^[1-5]$/.test(key)) return { kind: 'answer', value: Number(key) - 3 };
  return key === 'ArrowRight' ? { kind: 'previous' } : key === 'ArrowLeft' ? { kind: 'next' } : null;
}
const axes = AXES.map(axis => axis.id);
const blocs: AlignBloc[] = ['west', 'gulf', 'turkish', 'east', 'neutral'];
const categories = ['founder', 'baath', 'islam', 'civ', 'kurd', 'minority', 'current'];
const invalid = (): never => { throw new Error('بيانات البوصلة غير صالحة'); };
const dictionary = (value: unknown): Record<string, unknown> => Array.isArray(value) && value.length === 0 ? {} : record(value);
export function quizVersion(value: unknown): QuizVersion { return value === 'short' || value === 'standard' || value === 'full' ? value : invalid(); }
const score = (value: unknown): number => { const result = finiteNumber(value); return Math.abs(result) <= 1 ? result : invalid(); };
const count = (value: unknown): number => { const result = integer(value); return result >= 0 ? result : invalid(); };
const nullableText = (value: unknown): string | null => value == null ? null : text(value);
function vector(input: unknown): Partial<Record<AxisId, number | null>> {
  return Object.fromEntries(Object.entries(dictionary(input)).map(([key, value]) => { if (!axes.includes(key as AxisId)) return invalid(); return [key, value == null ? null : score(value)]; }));
}
export function decodeCompassPage(payload: unknown): CompassConfig {
  const page = record(payload);
  const figures = array(page.figures).map((value): Figure => {
    const row = record(value); const category = text(row.category); if (!categories.includes(category)) return invalid();
    const image = assetUrl(row.image);
    return { name: text(row.name), category: category as Figure['category'], align: text(row.align), positions: vector(row.positions), ...(image ? { image } : {}) };
  });
  const personas = array(page.personas).map((personaValue): Spectrum => {
    const row = record(personaValue); const center: Partial<Record<AxisId, number>> = {};
    for (const [key, value] of Object.entries(vector(row.center))) { if (value !== null) center[key as AxisId] = value; }
    const ranges: NonNullable<Spectrum['ranges']> = {};
    for (const [key, value] of Object.entries(dictionary(row.ranges ?? {}))) {
      if (!axes.includes(key as AxisId)) return invalid(); const bounds = record(value); const min = score(bounds.min); const max = score(bounds.max); if (min > max) return invalid(); ranges[key as AxisId] = { min, max };
    }
    return { id: text(row.id), name: text(row.name), icon: text(row.icon), short: text(row.short), factoid: text(row.factoid), stances: array(row.stances).map(value => text(value)), center, ranges };
  });
  return { figures, personas };
}
export function questionList(version: QuizVersion): { key: string; text: string; section: string }[] {
  return [...AXES.flatMap(axis => engine.activeQuestions(axis.id, version).map(({ q, i }) => ({ key: engine.axisKey(axis.id, i), text: q.text, section: axis.name }))), ...engine.activeAlignQuestions(version).map(({ q, i }) => ({ key: engine.alignKey(i), text: q.text, section: 'التوجّه الخارجي' }))];
}
export function decodeAnswers(value: unknown, version: QuizVersion): AnswerMap {
  const valid = new Set(questionList(version).map(question => question.key));
  return Object.fromEntries(Object.entries(dictionary(value)).map(([key, answer]) => { if (!valid.has(key) || typeof answer !== 'number' || !Number.isInteger(answer) || answer < -2 || answer > 2) return invalid(); return [key, answer]; }));
}
export function decodeProgress(value: unknown): Progress | null {
  if (value == null) return null;
  const row = record(value); const version = quizVersion(row.version); const index = count(row.index); if (index >= questionList(version).length) return invalid();
  const updatedAt = text(row.updatedAt); if (!Number.isFinite(Date.parse(updatedAt))) return invalid();
  return { version, answers: decodeAnswers(row.answers, version), index, updatedAt };
}
export function buildResult(answers: AnswerMap, version: QuizVersion, config: CompassConfig, id: string | number = `local:${Date.now()}:${Math.random().toString(36).slice(2)}`): IdentifiedResult {
  const scores = engine.computeScores(answers, version); const match = engine.matchFigures(scores.axes, scores.align, config.figures).matches[0];
  const spectrum = engine.matchSpectrum(scores.axes, config.personas).spectrum;
  return { id, version, answers, scores: scores.axes, align: scores.align, topFigure: match?.figure.name ?? null, topScore: match?.score ?? null, spectrum: spectrum?.id ?? null, consistency: engine.computeConsistency(answers, version), answered: Object.keys(answers).length, createdAt: new Date().toISOString(), savedToAccount: false, statsConsent: false };
}
export function strongestAxis(scores: CompassResult['scores']): { id: AxisId; name: string; value: number; pole: string } | null {
  let strongest: ReturnType<typeof strongestAxis> = null;
  for (const axis of AXES) {
    const value = scores[axis.id];
    if (value != null && (!strongest || Math.abs(value) > Math.abs(strongest.value))) strongest = { id: axis.id, name: axis.name, value, pole: value > 0 ? axis.right : axis.left };
  }
  return strongest;
}
export function decodeResult(value: unknown): IdentifiedResult {
  const row = record(value); const version = quizVersion(row.version); const alignment = dictionary(row.align);
  const id = row.id; if (typeof id !== 'string' && (typeof id !== 'number' || !Number.isSafeInteger(id))) return invalid();
  const createdAt = text(row.createdAt); if (!Number.isFinite(Date.parse(createdAt))) return invalid();
  const consistency = score(row.consistency); if (consistency < 0) return invalid();
  const topScore = row.topScore == null ? null : score(row.topScore); if (topScore !== null && topScore < 0) return invalid();
  return { id, version, answers: decodeAnswers(row.answers, version), scores: vector(row.scores), align: Object.fromEntries(blocs.map(bloc => [bloc, finiteNumber(alignment[bloc] ?? 0)])) as Record<AlignBloc, number>, topFigure: nullableText(row.topFigure), topScore, spectrum: nullableText(row.spectrum), consistency, answered: count(row.answered), createdAt, savedToAccount: row.savedToAccount === true, statsConsent: row.statsConsent === true };
}
export function decodeHistory(value: unknown): IdentifiedResult[] { return array(value).map(decodeResult).slice(0, 50); }
export function updateHistory<T extends CompassResult>(history: T[], result: T): T[] { return [result, ...history.filter(item => String(item.id) !== String(result.id))].slice(0, 50); }
export function decodeStatsPage(payload: unknown): { stats: CompassStatsPayload; personas: { id: string; name: string }[] } {
  const page = record(payload); const raw = record(page.stats);
  const stats: CompassStatsPayload = { total: count(raw.total), byVersion: Object.fromEntries(Object.entries(dictionary(raw.byVersion)).map(([key, value]) => [key, count(value)])),
    bySpectrum: Object.fromEntries(Object.entries(dictionary(raw.bySpectrum)).map(([key, value]) => [key, array(value).map(item => { const row = record(item); return { id: text(row.id), count: count(row.count) }; })])),
    axisAverages: Object.fromEntries(Object.entries(dictionary(raw.axisAverages)).map(([key, value]) => [key, vector(value)])),
    questions: Object.fromEntries(Object.entries(dictionary(raw.questions)).map(([key, value]) => [key, Object.fromEntries(Object.entries(dictionary(value)).map(([scope, distribution]) => { const row = record(distribution); const counts = array(row.counts).map(count); const n = count(row.n); if (counts.length !== 5 || counts.reduce((sum, countValue) => sum + countValue, 0) !== n) return invalid(); return [scope, { n, counts }]; }))])) };
  return { stats, personas: array(page.personas).map(value => { const row = record(value); return { id: text(row.id), name: text(row.name) }; }) };
}
// PORT STATUS: source resources/js/Pages/Compass/CompassApp.tsx and lib/storage.ts; confidence high; todos 0.
