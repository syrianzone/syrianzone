import { expect, test } from 'bun:test';
import { decodePromiseCard, decodePromiseDetailPage, decodePromiseIndex, newestVotes, rememberVotes, validateReport, validateSuggestion } from './model';
export const cardFixture = (patch: Record<string, unknown> = {}) => ({ id: '00000001-0000-4000-8000-000000000000', number: 1, title: 'وعد تجريبي معزول', speaker: { id: null, name: 'اسم اختباري', title: null, image: null }, coSpeakers: [], institution: null, sector: null, isNational: true, governorates: [], tags: [], statementDate: '2026-01-01', deadlineDate: '2026-12-01', deadlineWording: null, status: 'pending', state: 'pending', daysLeft: 17, daysSince: 317, counter: { mode: 'left', value: 17 }, keptLate: false, resolvedAt: null, target: null, votingOpen: true, votes: { yes: 2, no: 1 }, ...patch });
test('Promise cards preserve exact public counters, target overachievement and current vote aggregates', () => {
  const card = decodePromiseCard(cardFixture({ target: { value: 100, unit: 'مشروع', baseline: 0, baselineNote: null, current: 120, currentOn: '2026-11-14', percent: 120 } }));
  expect(card.counter).toEqual({ mode: 'left', value: 17 }); expect(card.votes).toEqual({ yes: 2, no: 1 }); expect(card.target?.percent).toBe(120);
  expect(decodePromiseCard(cardFixture({ state: 'overdue', daysLeft: -3, counter: { mode: 'overdue', value: 3 } })).daysLeft).toBe(-3);
  for (const patch of [{ number: -1 }, { state: 'invented' }, { counter: { mode: 'left', value: -3 } }, { votes: { yes: NaN, no: 0 } }, { deadlineDate: '2026-02-31' }]) expect(() => decodePromiseCard(cardFixture(patch))).toThrow();
});
test('Promise index validates all facets and detail preserves source/evidence relationships', () => {
  const props = { promises: [cardFixture()], stats: { total: 1, fulfilled: 0, keptLate: 0, partiallyFulfilled: 0, broken: 0, overdue: 0, open: 1, postponed: 0, retracted: 0 }, filters: { sectors: [], governorates: [], institutions: [], speakers: [], tags: [] }, dueSoonDays: 30 };
  expect(decodePromiseIndex(props).promises).toHaveLength(1);
  const detail = { ...cardFixture(), summary: null, quote: 'نص تجريبي معزول', quoteIsVerbatim: true, statementVenue: 'speech', deadlineReasoning: null, governorateNames: [], speakerXHandle: null, sources: [{ id: 1, url: 'https://example.com/evidence', outlet: null, type: 'news_article', publishedDate: null, language: null, archiveUrl: null, screenshotUrl: null, videoTimestamp: null, isPrimary: true }], updates: [], restates: null, restatedBy: null, relatedPromises: [], publishedAt: null, updatedAt: null };
  expect(decodePromiseDetailPage({ promise: detail }).sources[0]?.isPrimary).toBe(true);
  expect(() => decodePromiseDetailPage({ promise: { ...detail, sources: [{ ...detail.sources[0], url: 'javascript:bad' }] } })).toThrow();
});
test('Promise newest tally overrides only stale props and lets equally-sized fresh votes win', () => {
  const before = { yes: 2, no: 1 }; const after = { yes: 3, no: 1 };
  rememberVotes(80001, after, before);
  expect(newestVotes(80001, before)).toEqual(after);
  expect(newestVotes(80001, { yes: 1, no: 3 })).toEqual({ yes: 1, no: 3 });
  rememberVotes(80001, { yes: 2, no: 2 }, after);
  expect(newestVotes(80001, before)).toEqual({ yes: 2, no: 2 });
});
test('Suggestion preserves source rules and progress reports require evidence', () => {
  const valid = { speaker_ref: 'speaker:fixture', speaker_name: null, speaker_title: null, title: 'وعد اختباري', quote: 'اقتباس معزول لا يُرسل إلى الإنتاج', statement_date: '2026-11-14', statement_venue: 'speech', deadline_wording: null, source_urls: ['https://example.com/evidence'], note: null };
  expect(validateSuggestion(valid, '2024-12-08', '2026-11-14')).toEqual({});
  expect(validateSuggestion({ ...valid, statement_date: '2026-11-15', source_urls: [], title: 'x'.repeat(201) }, '2024-12-08', '2026-11-14')).toHaveProperty('statement_date');
  expect(validateSuggestion({ ...valid, source_urls: ['javascript:bad'] }, '2024-12-08', '2026-11-14')['source_urls.0']).toBeTruthy();
  expect(validateReport({ kind: 'progress', body: 'تحديث تجريبي موثّق', source_url: null })).toHaveProperty('source_url');
  expect(validateReport({ kind: 'error', body: 'تصحيح تجريبي معزول', source_url: null })).toEqual({});
});
