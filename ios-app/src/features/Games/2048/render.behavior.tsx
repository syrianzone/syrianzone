import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import { createElement, type ElementType, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { PanResponderCallbacks, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import type { Tile } from '../engines';
import { advanceRound } from './motion';

let allocations = 0;
let panConfiguration: PanResponderCallbacks | null = null;
class Value {
  constructor(public value: number) { allocations++; }
  setValue(value: number): void { this.value = value; }
  stopAnimation(): void {}
}
class ValueXY {
  x: Value; y: Value;
  constructor(value = { x: 0, y: 0 }) { this.x = new Value(value.x); this.y = new Value(value.y); }
  setValue(value: { x: number; y: number }): void { this.x.setValue(value.x); this.y.setValue(value.y); }
  stopAnimation(): void {}
}
interface Composite { start(callback?: (value: { finished: boolean }) => void): void; stop(): void }
interface Timing { node: Value | ValueXY; toValue: number | { x: number; y: number }; duration: number; useNativeDriver: boolean }
const timings: Timing[] = [], delays: number[] = [], listeners = new Set<(value: boolean) => void>();
let width = 393, motionRead: Promise<boolean> = Promise.resolve(false);
const composite = (action: () => void): Composite => ({ start: callback => { action(); callback?.({ finished: true }); }, stop() {} });
mock.module('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable',
  useWindowDimensions: () => ({ width, height: 852, scale: 3, fontScale: 1 }),
  PanResponder: { create: (configuration: PanResponderCallbacks) => { panConfiguration = configuration; return { panHandlers: {} }; } },
  AccessibilityInfo: { isReduceMotionEnabled: () => motionRead, addEventListener: (_event: string, listener: (value: boolean) => void) => { listeners.add(listener); return { remove: () => listeners.delete(listener) }; } },
  Easing: { bezier: () => (value: number) => value, in: (value: unknown) => value, ease: (value: number) => value },
  Animated: { View: 'Animated.View', Value, ValueXY,
    multiply: (value: Value, factor: number) => ({ value, factor }),
    timing: (node: Value | ValueXY, options: Omit<Timing, 'node'>) => { timings.push({ node, ...options }); return composite(() => {
      if (node instanceof Value && typeof options.toValue === 'number') node.setValue(options.toValue);
      if (node instanceof ValueXY && typeof options.toValue !== 'number') node.setValue(options.toValue);
    }); },
    delay: (duration: number) => { delays.push(duration); return composite(() => {}); },
    parallel: (items: Composite[]) => composite(() => { for (const item of items) item.start(); }),
    sequence: (items: Composite[]) => composite(() => { for (const item of items) item.start(); }) }
}));
interface Content { children?: ReactNode; [key: string]: unknown }
mock.module('../../../components', () => ({ Label: ({ children, ...props }: Content) => createElement('Text', props, children), Section: ({ children }: Content) => createElement('Section', null, children) }));
mock.module('../../../ui/native', () => ({ NativeAction: (props: Content) => createElement('NativeAction', props) }));
mock.module('../../../ui/theme', () => ({ useTheme: () => ({ colors: { surface: '#fff', text: '#111', separator: '#ccc', danger: '#900' } }) }));
mock.module('../GameShell', () => ({ GameShell: ({ children, actions }: Content) => createElement('Shell', null, actions as ReactNode, children) }));
mock.module('../records', () => ({ useGameRecords: () => ({ best: () => {}, records: { best2048: 0 }, error: null }) }));
const { Game2048Screen } = await import('./Index');
const { Game2048Board } = await import('./Board');
const textHost = 'Text' as ElementType, actionHost = 'NativeAction' as ElementType;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Timer = ReturnType<typeof setTimeout>;
const timers = new Map<Timer, () => void>();
let mounted: ReactTestRenderer | undefined, restore: (() => void)[] = [], nextTimer = 9000;
beforeEach(() => {
  panConfiguration = null;
  width = 393; motionRead = Promise.resolve(false); timings.length = 0; delays.length = 0; nextTimer = 9000; timers.clear(); allocations = 0;
  const random = spyOn(Math, 'random').mockReturnValue(0);
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  const set = spyOn(globalThis, 'setTimeout').mockImplementation(((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (delay !== 320 || typeof callback !== 'function') return originalSet(callback, delay, ...args);
    const id = nextTimer++ as unknown as Timer; timers.set(id, () => { callback(...args); }); return id;
  }) as typeof setTimeout);
  const clear = spyOn(globalThis, 'clearTimeout').mockImplementation(handle => { if (!timers.delete(handle as Timer)) originalClear(handle as unknown as number | undefined); });
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  restore = [() => random.mockRestore(), () => set.mockRestore(), () => clear.mockRestore(), () => {
    const messages = warning.mock.calls.map(call => call[0]); warning.mockRestore();
    expect(messages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  }];
});
afterEach(async () => {
  if (mounted) await act(async () => { mounted?.unmount(); });
  mounted = undefined;
  for (const item of restore) item(); restore = [];
  expect(listeners.size).toBe(0); expect(timers.size).toBe(0);
});
async function mount(): Promise<void> { await act(async () => { mounted = create(createElement(Game2048Screen)); }); }
const tile = (id: number) => mounted!.root.findByProps({ testID: `2048.tile.${id}` });
const ghosts = () => mounted!.root.findAll(node => typeof node.props.testID === 'string' && node.props.testID.startsWith('2048.ghost.'));
const direction = (label: string) => mounted!.root.findByProps({ accessibilityLabel: `تحريك ${label}` }).props.onPress as () => void;
const numbers = () => mounted!.root.findAllByType(textHost).filter(node => node.props.accessible !== false && /^\d+$/.test(node.props.accessibilityLabel ?? '')).map(node => node.props.accessibilityLabel);

test('the rendered board keeps engine IDs across two batched legal moves and hides absorbed values from accessibility', async () => {
  await mount();
  const survivor = tile(1);
  await act(async () => { direction('يسار')(); direction('يمين')(); });
  expect(tile(1)).toBe(survivor);
  expect(tile(1).findByType(textHost).props.children).toBe(4);
  expect(numbers().sort()).toEqual(['2', '2', '4']);
  expect(ghosts()).toHaveLength(1);
  expect(ghosts()[0]!.props.accessibilityElementsHidden).toBe(true);
  expect(ghosts()[0]!.props.importantForAccessibility).toBe('no-hide-descendants');
  const move = timings.find(row => row.node instanceof ValueXY && typeof row.toValue !== 'number' && row.toValue.x === 2 && row.toValue.y === 0);
  expect(move).toMatchObject({ duration: 140, useNativeDriver: true });
  expect(timings.some(row => row.duration === 160 && row.toValue === 1)).toBe(true);
  expect(delays).toContain(140);
  expect(timers.size).toBe(1);
  await act(async () => { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } });
  expect(ghosts()).toHaveLength(0);
  expect(numbers().sort()).toEqual(['2', '2', '4']);
});

test('a moving merge delays its native pop until landing and retains the consumed tile for slide and fade', async () => {
  const board: Tile[] = [1, 2].map((id, index) => ({ id, value: 2, row: 0, col: index + 2, fresh: false, merged: false, moved: false, merges: 0 }));
  await act(async () => { mounted = create(createElement(Game2048Board, { board, ghosts: [], size: 357, reducedMotion: false, panHandlers: {} })); });
  const survivor = tile(1);
  const next = advanceRound({ board, score: 0, phase: 'playing', continuing: false, ghosts: [], ghostRevision: 0 }, 'left', () => 3, () => 0);
  await act(async () => { mounted!.update(createElement(Game2048Board, { board: next.board, ghosts: next.ghosts, size: 357, reducedMotion: false, panHandlers: {} })); });
  expect(tile(1)).toBe(survivor);
  expect(delays.filter(value => value === 140)).toHaveLength(2);
  expect(timings.some(row => row.duration === 80 && row.toValue === 1.22)).toBe(true);
  expect(timings.some(row => row.duration === 120 && row.toValue === 1)).toBe(true);
  expect(timings.some(row => row.duration === 160 && row.toValue === 0.35)).toBe(true);
  expect(ghosts().map(node => node.props.testID)).toEqual(['2048.ghost.2']);
  expect(numbers().sort()).toEqual(['2', '4']);
  expect(mounted!.root.findByProps({ accessibilityLabel: 'لوحة 2048' }).props.style.overflow).toBe('visible');
});

test('resizing preserves tile instances and scales cell-coordinate translations to the new pitch', async () => {
  await mount();
  await act(async () => { direction('يسار')(); direction('يمين')(); });
  const survivor = tile(1);
  const allocated = allocations;
  width = 600;
  await act(async () => { mounted!.update(createElement(Game2048Screen)); });
  expect(tile(1)).toBe(survivor);
  const style = Object.assign({}, ...tile(1).props.style);
  expect(style.left).toBe(4);
  expect(style.transform[0].translateX.factor).toBe(109);
  expect(style.transform[0].translateX.value.value).toBe(2);
  expect(allocations).toBe(allocated);
});

test('reduced motion renders final values without slide, spawn, pop or ghost animation', async () => {
  motionRead = Promise.resolve(true);
  await mount();
  await act(async () => { direction('يسار')(); });
  expect(timings).toEqual([]);
  expect(ghosts()).toEqual([]);
  expect(timers.size).toBe(0);
  expect(numbers().sort()).toEqual(['2', '4']);
  await act(async () => { for (const listener of listeners) listener(false); });
  expect(timings).toEqual([]);
  await act(async () => { direction('يمين')(); });
  expect(timings.some(row => row.duration === 140)).toBe(true);
});

test('restart rejects an old ghost callback and keeps a new round merge visible until its own timer', async () => {
  await mount();
  await act(async () => { direction('يسار')(); });
  const old = [...timers.values()][0]!;
  await act(async () => {
    mounted!.root.findAllByType(actionHost).find(node => node.props.title === 'لعبة جديدة')!.props.onPress();
    direction('يسار')();
  });
  expect(ghosts().map(node => node.props.testID)).toEqual(['2048.ghost.5']);
  await act(async () => { old(); });
  expect(ghosts().map(node => node.props.testID)).toEqual(['2048.ghost.5']);
  expect(timers.size).toBe(1);
});

test('a newly accepted merge invalidates a queued earlier ghost callback before React effects flush', async () => {
  await mount();
  await act(async () => { direction('يسار')(); });
  const [oldID, old] = [...timers.entries()][0]!;
  timers.delete(oldID);
  await act(async () => {
    direction('يمين')(); direction('يسار')(); direction('يمين')();
    old();
  });
  expect(ghosts().map(node => node.props.testID)).toEqual(['2048.ghost.2', '2048.ghost.3']);
  expect(timers.size).toBe(1);
});

test('a late initial motion preference cannot override a newer accessibility event', async () => {
  let resolve!: (value: boolean) => void;
  motionRead = new Promise<boolean>(complete => { resolve = complete; });
  await mount();
  await act(async () => { for (const listener of listeners) listener(true); resolve(false); });
  await act(async () => { direction('يسار')(); });
  expect(timings).toEqual([]);
  expect(ghosts()).toEqual([]);
});

test('enabling reduced motion during a merge removes ghosts and cancels their pending cleanup timer', async () => {
  await mount();
  await act(async () => { direction('يسار')(); });
  expect(ghosts()).toHaveLength(1);
  expect(timers.size).toBe(1);
  await act(async () => { for (const listener of listeners) listener(true); });
  expect(ghosts()).toEqual([]);
  expect(timers.size).toBe(0);
  expect(numbers().sort()).toEqual(['2', '4']);
});

test('an unavailable OS motion preference still shows a playable board without animation', async () => {
  let reject!: (reason: Error) => void;
  motionRead = new Promise<boolean>((_complete, fail) => { reject = fail; });
  await mount();
  expect(numbers()).toEqual([]);
  await act(async () => { reject(new Error('OS preference unavailable')); });
  expect(numbers().sort()).toEqual(['2', '2']);
  await act(async () => { direction('يسار')(); });
  expect(numbers().sort()).toEqual(['2', '4']);
  expect(timings).toEqual([]);
});

test('2048 claims board touches from the start and retains the source release threshold', async () => {
  await mount();
  const configuration = panConfiguration as PanResponderCallbacks | null;
  expect(configuration).not.toBeNull();
  const event = {} as GestureResponderEvent;
  const gesture = (dx: number, dy: number) => ({ dx, dy } as PanResponderGestureState);
  expect(configuration?.onStartShouldSetPanResponder?.(event, gesture(0, 0))).toBe(true);
  expect(configuration?.onPanResponderTerminationRequest?.(event, gesture(0, 30))).toBe(false);
  const initial = numbers();
  await act(async () => { configuration?.onPanResponderRelease?.(event, gesture(23, 0)); });
  expect(numbers()).toEqual(initial);
  await act(async () => { configuration?.onPanResponderRelease?.(event, gesture(24, 0)); });
  expect(numbers().reduce((sum, value) => sum + Number(value), 0)).toBe(initial.reduce((sum, value) => sum + Number(value), 0) + 2);
  expect(tile(3).findByType(textHost).props.children).toBe(2);
});
