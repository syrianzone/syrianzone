import { expect, spyOn, test } from 'bun:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useTransitEditors } from './editor-state';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
test('moderation and route forms survive pane replacement and remain attached to their own records', async () => {
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  let owner!: ReturnType<typeof useTransitEditors>, renderer!: ReactTestRenderer;
  function Screen({ wide }: { wide: boolean }) {
    owner = useTransitEditors();
    return createElement(wide ? 'aside' : 'main', { key: wide ? 'wide-pane' : 'compact-pane' });
  }
  const route = { id: 'route-a', cityId: 'damascus', name: 'خط أ', nameEn: null, price: 5000, color: 3 };
  try {
    await act(async () => {
      renderer = create(createElement(Screen, { wide: false }));
    });
    await act(async () => {
      owner.draft({ id: 1, color: 2 }).update({ reason: 'سبب محفوظ', rejecting: true, color: 4 });
      owner.route(route).update({ panel: 'edit', form: { nameAr: 'تعديل غير محفوظ', nameEn: '', color: 3, price: '' }, splitAt: 'stop-interior' });
    });
    await act(async () => {
      renderer.update(createElement(Screen, { wide: true }));
    });
    expect(owner.draft({ id: 1, color: 2 }).state).toEqual({ reason: 'سبب محفوظ', rejecting: true, color: 4 });
    expect(owner.route(route).state.form).toEqual({ nameAr: 'تعديل غير محفوظ', nameEn: '', color: 3, price: '' });
    expect(owner.route({ ...route, id: 'route-b' }).state.form.nameAr).toBe('خط أ');
    expect(owner.draft({ id: 2, color: 7 }).state.reason).toBe('');
  } finally {
    if (renderer)
      await act(async () => {
        renderer.unmount();
      });
    const messages = warning.mock.calls.map((call) => call[0]);
    warning.mockRestore();
    expect(messages.every((message) => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(
      true
    );
  }
});
