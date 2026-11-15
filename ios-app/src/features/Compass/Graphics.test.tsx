import { afterEach, beforeEach, expect, mock, spyOn, test, type Mock } from 'bun:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { mockNativeHosts } from '../Phonebook/test-hosts';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
mockNativeHosts();
mock.module('react-native-svg', () => ({ default: 'svg', Circle: 'circle', G: 'g', Line: 'line', Rect: 'rect', SvgXml: 'xml', Text: 'text', TSpan: 'span' }));
const exports: { finish(): void; signal: AbortSignal | undefined }[] = [];
mock.module('../../platform/files', () => ({ shareSvgPng: (_svg: unknown, options: { signal?: AbortSignal }) => new Promise<void>(resolve => { exports.push({ finish: resolve, signal: options.signal }); }) }));
const { CompassStory } = await import('./Graphics');
const { buildResult } = await import('./model');
const result = { ...buildResult({}, 'short', { figures: [], personas: [] }, 'fixture'), createdAt: '2026-11-14T00:00:00Z' };
const mounted: ReactTestRenderer[] = [];
let warning: Mock<typeof console.error>;
beforeEach(() => { exports.length = 0; warning = spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(async () => {
  await act(async () => { for (const renderer of mounted.splice(0)) renderer.unmount(); });
  const messages = warning.mock.calls.map(call => call[0]); warning.mockRestore();
  expect(messages.length).toBeGreaterThan(0);
  expect(messages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
});
async function mount(): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = create(createElement(CompassStory, { result, spectrum: null }), { createNodeMock: () => ({}) }); });
  mounted.push(renderer); return renderer;
}
test('a replaced result can export after its previous export is cancelled', async () => {
  const renderer = await mount();
  await act(async () => renderer.root.findByType('button').props.onPress());
  expect(renderer.root.findByType('button').props.disabled).toBe(true);
  await act(async () => renderer.update(createElement(CompassStory, { result: { ...result, statsConsent: true }, spectrum: null })));
  expect(exports[0]!.signal?.aborted).toBe(true);
  await act(async () => exports[0]!.finish());
  expect(renderer.root.findByType('button').props.disabled).toBe(false);
});
test('finishing an older cancelled export cannot unlock a newer export', async () => {
  const renderer = await mount();
  await act(async () => renderer.root.findByType('button').props.onPress());
  await act(async () => renderer.update(createElement(CompassStory, { result: { ...result, statsConsent: true }, spectrum: null })));
  await act(async () => renderer.root.findByType('button').props.onPress());
  expect(exports).toHaveLength(2);
  await act(async () => exports[0]!.finish());
  expect(renderer.root.findByType('button').props.disabled).toBe(true);
  await act(async () => exports[1]!.finish());
  expect(renderer.root.findByType('button').props.disabled).toBe(false);
});
