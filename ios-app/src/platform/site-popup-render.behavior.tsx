import { expect, mock, spyOn, test } from 'bun:test';
import { createElement, type ElementType } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { api, type ApiClient } from '../api';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const listeners = new Set<() => void>();
const subscription = () => {
  const listener = () => {};
  listeners.add(listener);
  return { remove: () => { listeners.delete(listener); } };
};
mock.module('react-native', () => ({
  View: 'view', ScrollView: 'scroll', Pressable: 'pressable',
  AccessibilityInfo: { announceForAccessibility: () => {} },
  AppState: { currentState: 'active', addEventListener: subscription },
  Keyboard: { addListener: subscription },
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 })
}));
mock.module('react-native-safe-area-context', () => ({ SafeAreaView: 'safearea' }));
mock.module('react-native-svg', () => ({ SvgXml: 'svg' }));
mock.module('../components', () => ({ Label: 'label', Section: 'section' }));
mock.module('../ui/native', () => ({ NativeAction: 'button', NativeIconAction: 'iconbutton' }));

const opened: string[] = [], writes: number[][] = [];
let dismissals: number[] = [], finishWrite: (() => void) | undefined;
mock.module('./links', () => ({ openExternal: async (url: string) => { opened.push(url); } }));
mock.module('./storage', () => ({
  readDocument: async (key: string, decode: (value: unknown) => unknown) => {
    if (key !== 'site-popup-dismissals.v1') throw new Error('Only campaign dismissals may be read.');
    return decode([...dismissals]);
  },
  writeDocument: async (key: string, value: number[]) => {
    if (key !== 'site-popup-dismissals.v1') throw new Error('Only campaign dismissals may be written.');
    writes.push([...value]);
    await new Promise<void>(resolve => { finishWrite = resolve; });
    dismissals = [...value];
  }
}));
const { SitePopupPublic } = await import('./SitePopupPublic');
const host = (name: string): ElementType => name as ElementType;
const popup = {
  enabled: true, version: 87, title: 'إشعار عام طويل يحافظ على كامل النص الأصلي',
  description: 'هذا نص توضيحي طويل للتنبيه، يجب أن يبقى كاملاً ومتاحاً مع زري الحملة والإغلاق. '.repeat(8).slice(0, 500),
  buttonText: 'افتح صفحة الحملة للمزيد من التفاصيل', dismissText: 'لاحقاً', link: 'https://example.invalid/campaign'
};

test('a campaign load failure leaves the app unobstructed', async () => {
  const page = spyOn(api, 'page').mockRejectedValue(new Error('Offline'));
  let mounted: ReactTestRenderer | undefined;
  try {
    await act(async () => { mounted = create(createElement(SitePopupPublic, { pageKey: 'home' })); });
    expect(mounted!.toJSON()).toBeNull();
  } finally {
    if (mounted) await act(async () => { mounted?.unmount(); });
    page.mockRestore();
  }
});

test('a touch before the campaign loads quiets it until the next page', async () => {
  let resolvePage: (() => void) | undefined;
  const page = spyOn(api, 'page').mockImplementation((_path, _component, decode) =>
    new Promise(resolve => { resolvePage = () => resolve(decode({ sitePopup: { ...popup, version: 88 } })); })
  );
  const schedule = spyOn(globalThis, 'setTimeout');
  let mounted: ReactTestRenderer | undefined;
  try {
    await act(async () => { mounted = create(createElement(SitePopupPublic, { pageKey: 'home' })); });
    await act(async () => { mounted!.update(createElement(SitePopupPublic, { pageKey: 'home', interactionVersion: 1 })); });
    await act(async () => { resolvePage!(); });
    expect(schedule.mock.calls.filter(([, delay]) => delay === 2000)).toHaveLength(0);
    await act(async () => { mounted!.update(createElement(SitePopupPublic, { pageKey: 'places', interactionVersion: 1 })); });
    expect(schedule.mock.calls.filter(([, delay]) => delay === 2000)).toHaveLength(1);
  } finally {
    if (mounted) await act(async () => { mounted?.unmount(); });
    schedule.mockRestore();
    page.mockRestore();
  }
});

test('long campaign copy retains a wrapping action group with separate link and persistent-dismissal bindings', async () => {
  const timers = new Map<number, () => void>(), ownedTimers = new Set<number>();
  let nextTimer = 1, mounted: ReactTestRenderer | undefined;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout as (handle: unknown) => void;
  const schedule = spyOn(globalThis, 'setTimeout').mockImplementation(((task: () => void, delay?: number, ...args: unknown[]) => {
    if (delay !== 2000) return originalSetTimeout(task, delay, ...args);
    const id = nextTimer++; ownedTimers.add(id); timers.set(id, task); return id;
  }) as unknown as typeof setTimeout);
  const cancel = spyOn(globalThis, 'clearTimeout').mockImplementation(handle => {
    if (ownedTimers.has(Number(handle))) timers.delete(Number(handle));
    else originalClearTimeout(handle);
  });
  const read: ApiClient['page'] = async (path, component, decode, options) => {
    expect(path).toBe('/'); expect(component).toBe('Home'); expect(options?.signal).toBeInstanceOf(AbortSignal);
    return decode({ sitePopup: popup });
  };
  const page = spyOn(api, 'page').mockImplementation(read), warning = spyOn(console, 'error').mockImplementation(() => {});
  try {
    await act(async () => { mounted = create(createElement(SitePopupPublic, { pageKey: 'home' })); });
    expect(timers.size).toBe(1);
    await act(async () => {
      for (const [id, callback] of timers) { timers.delete(id); callback(); }
    });
    const root = mounted!.root;
    const labels = root.findAllByType(host('label')).map(label => label.props.children);
    expect(labels).toContain(popup.title); expect(labels).toContain(popup.description);
    expect(popup.description).toHaveLength(500);
    const body = root.findByType(host('pressable'));
    expect(body.props.accessibilityLabel).toBe(`${popup.description}، إخفاء التنبيه لهذه الزيارة`);
    expect(body.props.testID).toBe('إخفاء التنبيه لهذه الزيارة');
    const buttons = root.findAllByType(host('button'));
    const primary = buttons.find(button => button.props.title === popup.buttonText)!;
    const dismiss = buttons.find(button => button.props.title === popup.dismissText)!;
    expect(buttons).toHaveLength(2);
    expect(primary.parent).toBe(dismiss.parent);
    const group = primary.parent as ReactTestInstance;
    expect(group.type).toBe('view');
    expect(group.props.style).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    expect(group.findAllByType(host('button'))).toEqual([primary, dismiss]);
    expect(primary.props.style).toMatchObject({ flexGrow: 1, flexBasis: 140 });
    expect(dismiss.props.style).toMatchObject({ flexGrow: 1, flexBasis: 140 });
    expect(primary.props.prominent).toBe(true);
    expect(primary.props.disabled).toBe(false); expect(dismiss.props.disabled).toBe(false);
    expect(root.findByType(host('scroll')).props.style.maxHeight).toBe(320);
    expect(root.findByType(host('safearea')).props.style.maxHeight).toBe(320);
    await act(async () => { primary.props.onPress(); });
    expect(opened).toEqual([popup.link]); expect(writes).toEqual([]);
    await act(async () => { dismiss.props.onPress(); });
    expect(writes).toEqual([[popup.version]]);
    expect(mounted!.root.findAllByType(host('button')).every(button => button.props.disabled === true)).toBe(true);
    expect(mounted!.root.findByType(host('iconbutton')).props.disabled).toBe(true);
    await act(async () => { mounted!.root.findAllByType(host('button')).find(button => button.props.title === popup.dismissText)!.props.onPress(); });
    expect(writes).toHaveLength(1);
    await act(async () => { finishWrite!(); });
    expect(dismissals).toEqual([popup.version]); expect(opened).toEqual([popup.link]);
    expect(mounted!.toJSON()).toBeNull();
  } finally {
    if (mounted) await act(async () => { mounted?.unmount(); });
    page.mockRestore(); schedule.mockRestore(); cancel.mockRestore();
    const messages = warning.mock.calls.map(call => call[0]); warning.mockRestore();
    expect(messages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
    expect(listeners.size).toBe(0); expect(timers.size).toBe(0);
  }
});
