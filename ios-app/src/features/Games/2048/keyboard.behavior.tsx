import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import { createElement, type ElementType, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { engine2048, type Direction, type Tile } from '../engines';
import * as motion from './motion';

type Content = { children?: ReactNode; [key: string]: unknown };
let focused = true, appState = 'active', textInput: object | null = null;
const listeners = new Set<() => void>(), navigation = { setOptions() {} };
mock.module('expo', () => ({ requireNativeView: () => 'NativeKeys' }));
mock.module('@react-navigation/native', () => ({ useIsFocused: () => focused, useNavigation: () => navigation }));
mock.module('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeArea' }));
mock.module('react-native', () => ({
  View: 'View', ScrollView: 'ScrollView', Pressable: 'Pressable',
  Modal: ({ children, visible, ...props }: Content) => createElement('Modal', { visible, ...props }, visible ? children : null),
  TextInput: { State: { currentlyFocusedInput: () => textInput } },
  useWindowDimensions: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
  PanResponder: { create: () => ({ panHandlers: {} }) },
  AppState: { get currentState() { return appState; }, addEventListener: (_event: string, listener: () => void) => { listeners.add(listener); return { remove: () => listeners.delete(listener) }; } },
}));
mock.module('../../../components', () => ({ contentStyle: {}, Heading: 'Heading', Label: 'Label', Section: 'Section' }));
mock.module('../../../ui/native', () => ({ NativeAction: 'NativeAction' }));
mock.module('../../../ui/theme', () => ({ useTheme: () => ({ colors: { background: '#fff', surface: '#fff', danger: '#900' } }) }));
mock.module('../records', () => ({ useGameRecords: () => ({ best() {}, records: { best2048: 0 }, error: null }) }));
mock.module('./Board', () => ({ Game2048Board: (props: Content) => createElement('Board', props), use2048ReducedMotion: () => true }));
const { Game2048Screen } = await import('./Index');
const { NativeKeyCommands } = await import('../../../platform/NativeKeyCommands');
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let mounted: ReactTestRenderer | undefined, phase: motion.Round2048['phase'] = 'playing', restore: (() => void)[] = [];
const realNewRound = motion.newRound;
beforeEach(() => {
  focused = true; appState = 'active'; textInput = null; phase = 'playing';
  // Start in two central cells so every physical direction is a legal move.
  const random = spyOn(Math, 'random').mockReturnValue(0).mockReturnValueOnce(5.1 / 16).mockReturnValueOnce(0).mockReturnValueOnce(9.1 / 15).mockReturnValueOnce(0);
  const initial = spyOn(motion, 'newRound').mockImplementation((...args) => ({ ...realNewRound(...args), phase }));
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  restore = [() => random.mockRestore(), () => initial.mockRestore(), () => {
    const messages = warning.mock.calls.map(call => call[0]); warning.mockRestore();
    expect(messages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  }];
});
afterEach(async () => {
  await act(async () => { mounted?.unmount(); }); mounted = undefined;
  for (const reset of restore) reset(); restore = [];
  expect(listeners.size).toBe(0);
});
async function mount(): Promise<void> { await act(async () => { mounted = create(createElement(Game2048Screen)); }); }
const host = (name: string) => mounted!.root.findByType(name as ElementType);
const board = (): Tile[] => host('Board').props.board;
const keys = () => host('NativeKeys');
const send = (key: string): void => keys().props.onKeyCommand({ nativeEvent: { key } });
const action = (title: string) => mounted!.root.findAllByType('NativeAction' as ElementType).find(node => node.props.title === title)!;
const state = (value: string): void => { appState = value; for (const notify of listeners) notify(); };
function expectedMove(before: Tile[], direction: Direction, id: number): Tile[] {
  return engine2048.spawn(engine2048.move(before, direction).tiles, () => id, () => 0);
}

for (const [key, direction] of [
  ['ArrowUp', 'up'], ['ArrowDown', 'down'], ['ArrowLeft', 'left'], ['ArrowRight', 'right'],
  ['w', 'up'], ['s', 'down'], ['a', 'left'], ['d', 'right'],
  ['W', 'up'], ['S', 'down'], ['A', 'left'], ['D', 'right'],
] as const) test(`source key ${key} makes the physical ${direction} move through the real game controller`, async () => {
  await mount(); const before = board();
  expect(keys().props.commands).toContain(key);
  expect(keys().props.physicalDirections).toBe(true);
  await act(async () => { send(key); });
  expect(board()).toEqual(expectedMove(before, direction, 3));
});

test('two queued keys use the newest board and allocate exactly one engine ID per legal input', async () => {
  await mount(); const before = board();
  await act(async () => { send('ArrowLeft'); send('ArrowRight'); });
  expect(board()).toEqual(expectedMove(expectedMove(before, 'left', 3), 'right', 4));
});

test('rules block keys immediately, throughout the native dismissal animation, then restore them', async () => {
  await mount(); const before = board(), queued = keys().props.onKeyCommand;
  await act(async () => { action('القوانين').props.onPress(); queued({ nativeEvent: { key: 'ArrowLeft' } }); });
  expect(keys().props.active).toBe(false); expect(board()).toEqual(before);
  await act(async () => { send('a'); action('تم').props.onPress(); });
  expect(host('Modal').props.visible).toBe(false);
  expect(keys().props.active).toBe(false);
  await act(async () => { send('a'); }); expect(board()).toEqual(before);
  await act(async () => { host('Modal').props.onDismiss(); });
  expect(keys().props.active).toBe(true);
  await act(async () => { send('a'); }); expect(board()).toEqual(expectedMove(before, 'left', 3));
});

test('route blur and inactive/background state suppress game keys without changing the board', async () => {
  await mount(); const before = board();
  focused = false;
  await act(async () => { mounted!.update(createElement(Game2048Screen)); });
  expect(keys().props.active).toBe(false);
  await act(async () => { send('a'); }); expect(board()).toEqual(before);
  focused = true;
  await act(async () => { mounted!.update(createElement(Game2048Screen)); });
  for (const value of ['inactive', 'background']) {
    await act(async () => { state(value); }); expect(keys().props.active).toBe(false);
    await act(async () => { send('a'); }); expect(board()).toEqual(before);
  }
  await act(async () => { state('active'); }); expect(keys().props.active).toBe(true);
  await act(async () => { send('a'); }); expect(board()).toEqual(expectedMove(before, 'left', 3));
});

test('text-entry focus leaves arrow and letter input to the field', async () => {
  await mount(); const before = board(); textInput = {};
  await act(async () => { send('ArrowLeft'); send('a'); }); expect(board()).toEqual(before);
  textInput = null;
  await act(async () => { send('a'); }); expect(board()).toEqual(expectedMove(before, 'left', 3));
});

for (const current of ['won', 'lost'] as const) test(`${current} phase does not register or dispatch game movement`, async () => {
  phase = current; await mount(); const before = board();
  expect(keys().props.active).toBe(false);
  await act(async () => { send('a'); }); expect(board()).toEqual(before);
  if (current === 'won') {
    await act(async () => { action('متابعة اللعب').props.onPress(); }); expect(keys().props.active).toBe(true);
    await act(async () => { send('a'); }); expect(board()).toEqual(expectedMove(before, 'left', 3));
  }
});

test('reader and Compass shortcuts keep the original default and reject keys outside their requested set', async () => {
  const commands = ['ArrowLeft', 'ArrowRight', 'h', 'l', '[', ']', '1', '2', '3', '4', '5'] as const;
  const received: string[] = [];
  await act(async () => { mounted = create(createElement(NativeKeyCommands, { commands, onKey: key => received.push(key) })); });
  expect(keys().props.commands).toEqual(commands);
  expect(keys().props.physicalDirections).toBe(false);
  await act(async () => { for (const key of [...commands, 'ArrowUp', 'w']) send(key); });
  expect(received).toEqual([...commands]);
});

test('the native bridge exposes the rendered keys and opt-in physical mirroring while guarding text entry', async () => {
  await mount();
  const source = readFileSync(new URL('../../../../modules/syrian-zone-layout/ios/SyrianZoneLayoutView.swift', import.meta.url), 'utf8');
  const module = readFileSync(new URL('../../../../modules/syrian-zone-layout/ios/SyrianZoneLayoutModule.swift', import.meta.url), 'utf8');
  const whitelist = JSON.parse(source.match(/private let supported = Set\((\[[^\n]+\])\)/)![1]!) as string[];
  for (const key of keys().props.commands as string[]) expect(whitelist).toContain(key);
  expect(module).toContain('Prop("physicalDirections") { (view: SyrianKeyCommandsView, value: Bool) in view.physicalDirections = value }');
  expect(source).toContain('command.allowsAutomaticMirroring = !physicalDirections');
  expect(source).toContain('case "ArrowUp": input = UIKeyCommand.inputUpArrow');
  expect(source).toContain('case "ArrowDown": input = UIKeyCommand.inputDownArrow');
  expect(source).toContain('override var canBecomeFirstResponder: Bool { active && !hasTextEntryFocus }');
  expect(source).toContain('guard active, isFirstResponder, !hasTextEntryFocus');
});
