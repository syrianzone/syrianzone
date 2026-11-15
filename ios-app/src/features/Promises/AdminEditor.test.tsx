import { afterEach, beforeEach, expect, mock, spyOn, test, type Mock } from 'bun:test';
import { createElement } from 'react';
import { mockNativeHosts, observeFields } from '../Phonebook/test-hosts';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AdminPromiseDetail } from './admin-types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const fieldRenders: string[] = [];
mockNativeHosts();
mock.module('./AdminFields', () => ({ AdminDate: 'date', AdminSpeakerPicker: 'speaker' }));
mock.module('./AdminLog', () => ({ AdminLog: 'log', decodePromiseResponse: (value: unknown) => value }));
mock.module('./AdminSources', () => ({ AdminSources: 'sources' }));

const promise: AdminPromiseDetail = {
  id: '11111111-1111-4111-8111-111111111111', number: null, title: 'مسودة غير منشورة', summary: null, quote: 'اقتباس خاص غير منشور', quoteIsVerbatim: true,
  speaker: null, speakerTitle: null, coSpeakers: [], institutionId: null, sectorId: null, isNational: true, governorates: [], tags: [],
  statementDate: '2026-01-01', statementVenue: 'other', deadlineWording: null, deadlineDate: null, deadlineReasoning: null, targetValue: null,
  targetUnit: null, baselineValue: null, baselineNote: null, restatesPromiseId: null, restates: null, relatedPromiseIds: [], status: 'pending', state: 'pending',
  resolvedAt: null, reviewStatus: 'pending', publishedAt: null, origin: 'editor', submitterName: 'مقترح خاص', submitterNote: null, rejectionReason: null,
  sources: [], updates: [], originalDeadlineDate: null, originalDeadlineWording: null, postponedCount: 0, version: 1
};
let allowed = true;
const cachedPage = { promise, queueCount: 1, options: { today: '2026-11-14', earliestDate: '2024-12-08', sectors: [], governorates: [], institutions: [], venues: [], sourceTypes: [], statuses: [], restatable: [] } };
mock.module('./AdminShared', () => ({
  AdminHeader: 'header', AdminConfirm: 'confirm',
  useAdminPage: () => ({ data: cachedPage, loading: false, error: null, reload: () => {} }),
  usePromiseAdmin: () => ({ account: { sessionGeneration: 1, ready: true, busy: false }, any: allowed, create: allowed, edit: allowed, review: false, rule: false, remove: false, speakers: false, busy: false, error: null, fields: {}, run: () => {} })
}));
const { PromiseEditorScreen } = await import('./AdminEditor');
const { FeatureNavigationProvider } = await import('../../platform/features');
const navigation = { open: () => {}, back: () => {} };
const renderEditor = () => createElement(FeatureNavigationProvider, { value: navigation, children: createElement(PromiseEditorScreen, { id: promise.id }) });
const mounted: ReactTestRenderer[] = [];
let warning: Mock<typeof console.error>;
beforeEach(() => { allowed = true; observeFields(value => fieldRenders.push(value)); warning = spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(async () => {
  await act(async () => { for (const renderer of mounted.splice(0)) renderer.unmount(); });
  const messages = warning.mock.calls.map(call => call[0]); warning.mockRestore();
  expect(messages.length).toBeGreaterThan(0);
  expect(messages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
});
test('revoking the last Promise capability hides cached unpublished fields on the first render', async () => {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(renderEditor()); }); mounted.push(renderer);
  expect(renderer.root.findAllByType('input').some(field => field.props.value === promise.quote)).toBe(true);
  allowed = false;
  fieldRenders.length = 0;
  await act(async () => renderer.update(renderEditor()));
  expect(fieldRenders).toEqual([]);
  expect(renderer.root.findAllByType('input')).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).not.toContain(promise.quote);
  expect(JSON.stringify(renderer.toJSON())).not.toContain(promise.submitterName!);
});
