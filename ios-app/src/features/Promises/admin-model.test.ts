import { expect, test } from 'bun:test';
import { adoptEditor, createEditor, editorDirty, editorPayload, initialForm, reorderSectors, sectorPayload, speakerPayload, toPayload, undoableStatusId, validateEditor } from './admin-model';
import type { AdminPromiseDetail } from './admin-types';
const detail: AdminPromiseDetail = { id: '11111111-1111-4111-8111-111111111111', number: 55, title: 'افتتاح محطة التوليد الجديدة', summary: null, quote: 'سنفتتح المحطة', quoteIsVerbatim: true, speaker: { ref: 'speaker:11111111-1111-4111-8111-111111111112', name: 'س', title: null, image: null, source: 'speaker', pending: false }, speakerTitle: null, coSpeakers: [], institutionId: null, sectorId: null, isNational: false, governorates: ['damascus'], tags: ['كهرباء'], statementDate: '2025-01-15', statementVenue: 'press_conference', deadlineWording: null, deadlineDate: '2025-07-31', deadlineReasoning: null, targetValue: 500, targetUnit: 'ميغاواط', baselineValue: 0, baselineNote: null, restatesPromiseId: null, restates: null, relatedPromiseIds: ['11111111-1111-4111-8111-111111111113'], status: 'in_progress', state: 'in_progress', resolvedAt: null, reviewStatus: 'pending', publishedAt: null, origin: 'editor', submitterName: null, submitterNote: null, rejectionReason: null, sources: [], updates: [], version: 1, originalDeadlineDate: null, originalDeadlineWording: null, postponedCount: 0 };

test('native Promise editor retains source related links, zero baseline, primary sources and wire fields', () => {
  const form = initialForm(detail), payload = toPayload(form);
  expect(form.relatedPromiseIds).toEqual(detail.relatedPromiseIds); expect(initialForm(null).relatedPromiseIds).toEqual([]);
  expect(payload.related_promise_ids).toEqual(detail.relatedPromiseIds); expect(payload.baseline_value).toBe(0); expect(payload.sources[0]?.is_primary).toBe(true); expect('key' in payload.sources[0]!).toBe(false);
  form.isNational = true; expect(toPayload(form).governorates).toEqual([]);
});

test('status, timeline and unpublish responses never advance a dirty form version', () => {
  const state = createEditor(detail); state.form.title = 'تعديل غير محفوظ';
  expect(editorDirty(state)).toBe(true);
  const next = adoptEditor(state, { ...detail, version: 2, status: 'fulfilled' }, 'status');
  expect(next.promise?.version).toBe(2); expect(next.formVersion).toBe(1); expect(next.form.title).toBe('تعديل غير محفوظ'); expect(editorPayload(next).version).toBe(1);
  const saved = adoptEditor(next, { ...detail, version: 3 }, 'save'); expect(editorDirty(saved)).toBe(false); expect(saved.formVersion).toBe(3);
});

test('only the latest unpublished status entry is undoable and sector order remains a permutation', () => {
  const update = (id: number) => ({ id, type: 'status_change' as const, happenedOn: '2025-02-01', body: null, statusFrom: 'pending' as const, statusTo: 'in_progress' as const, value: null, sourceUrl: 'https://example.org/', archiveUrl: null });
  expect(undoableStatusId({ ...detail, updates: [update(1), update(2)] })).toBe(2); expect(undoableStatusId({ ...detail, publishedAt: '2025-02-02', updates: [update(1)] })).toBeNull();
  expect(reorderSectors(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']); expect(reorderSectors(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
});

test('editor rejects nonfinite measurements, unsafe evidence, missing targets and impossible dates', () => {
  const form = initialForm(detail); form.sources[0]!.url = 'https://example.org';
  expect(validateEditor(form, '2024-12-08', '2026-11-14')).toEqual({});
  form.targetValue = 'Infinity'; form.sources[0]!.url = 'file:///private/file'; form.statementDate = '2025-02-30';
  const errors = validateEditor(form, '2024-12-08', '2026-11-14'); expect(errors.target_value).toBeDefined(); expect(errors['sources.0.url']).toBeDefined(); expect(errors.statement_date).toBeDefined();
});

test('new sectors send the backend-required slug and speaker profiles validate their public links', () => {
  expect(sectorPayload({ id: 'clean-water', label: 'المياه', icon: 'droplets' }, true)).toEqual({ id: 'clean-water', label: 'المياه', icon: 'droplets' });
  expect(sectorPayload({ id: 'clean-water', label: 'المياه', icon: 'droplets' }, false)).toEqual({ label: 'المياه', icon: 'droplets' });
  expect(() => sectorPayload({ id: '../admin', label: 'المياه', icon: '' }, true)).toThrow();
  expect(() => speakerPayload({ name: 'س', title: '', institutionId: '', imageUrl: 'file:///private/photo', xHandle: '' })).toThrow();
  expect(() => speakerPayload({ name: 'س', title: '', institutionId: '', imageUrl: '', xHandle: 'https://example.org' })).toThrow();
});
