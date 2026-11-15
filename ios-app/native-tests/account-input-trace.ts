import { createElement, useEffect, useLayoutEffect, type ComponentType } from 'react';

type Props = Record<string, unknown>;
type Slot = 'poll-group' | 'studio-stop';
interface Scope { origin: string; user: string; id: number }
interface Event { sequence: number; at: number; kind: string; label: string; text?: string; redacted?: true; length?: number; eventCount?: number }
interface Snapshot { version: 1; nonce: string; slot: Slot; capped: boolean; events: Event[] }
export interface InputTraceController { arm(command: string): void; read(command: string): Snapshot; dispose(): void }
export type InputTraceReply = ({ phase: 'armed' } & Pick<Snapshot, 'version' | 'nonce' | 'slot'>) | ({ phase: 'captured' } & Snapshot);
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const installed = new WeakSet<object>();
const wrapped = Symbol.for('zone.syrian.fixture.input-trace');
const refuse = (): never => { throw new Error('Input trace boundary rejected.'); };

// Test entry only. Nothing is installed or recorded without the verified fixture and explicit arm command.
export function installInputTrace(namespace: object, scope: Scope, now: () => number = () => performance.now()): InputTraceController {
  if (scope.origin !== 'https://127.0.0.1:9443' || !((scope.user === 'admin' && scope.id === 103) || (scope.user === 'member' && scope.id === 101))
    || installed.has(namespace) || Object.isFrozen(namespace)) return refuse();
  const descriptor = Object.getOwnPropertyDescriptor(namespace, 'TextInput');
  if (!descriptor?.configurable || typeof descriptor.get !== 'function' || descriptor.set || 'value' in descriptor) return refuse();
  const original: unknown = descriptor.get.call(namespace);
  if (typeof original !== 'function' || Object.hasOwn(original, wrapped) || !('displayName' in original) || original.displayName !== 'TextInput' || !Object.hasOwn(original, 'State')) return refuse();
  const state: unknown = Reflect.get(original, 'State');
  if (!state || typeof state !== 'object' || !('currentlyFocusedInput' in state) || typeof state.currentlyFocusedInput !== 'function') return refuse();
  let active: { slot: Slot; nonce: string; label: string; expected: string[] } | null = null, disposed = false, capped = false;
  const events: Event[] = [];
  const subsequence = (text: string, full: string): boolean => {
    let index = 0;
    for (const character of full) if (character === text[index]) index++;
    return index === text.length;
  };
  const record = (kind: string, label: string, text?: unknown, eventCount?: unknown): void => {
    try {
      if (!active || disposed || label !== active.label) return;
      if (events.length >= 192) { capped = true; return; }
      const value: Event = { sequence: events.length + 1, at: now(), kind, label };
      if (typeof text === 'string') {
        if (text.length <= 96 && active.expected.some(full => subsequence(text, full))) value.text = text;
        else { value.redacted = true; value.length = Math.min(text.length, 1_000_000); }
      }
      if (Number.isSafeInteger(eventCount) && Number(eventCount) >= 0 && Number(eventCount) <= 1_000_000) value.eventCount = Number(eventCount);
      events.push(value);
    } catch { /* Observation must never alter the real callback. */ }
  };
  const wrapper = function TextInput(props: Props) {
    const label = typeof props.accessibilityLabel === 'string' ? props.accessibilityLabel : '';
    // Wrap only these two public callbacks before arming too. Recording remains gated,
    // so arming an already mounted form cannot miss its first focus/change event.
    const selected = (label === 'اسم مجموعة جديدة' || label === 'اسم الموقف') && props.secureTextEntry !== true;
    useEffect(() => {
      if (!selected) return;
      record('observer-attached', label);
      return () => record('observer-detached', label);
    }, [label, selected]);
    useLayoutEffect(() => { if (selected) record('value-commit', label, props.value); }, [label, props.value, selected]);
    if (!selected) return createElement(original as ComponentType<Props>, props);
    const forwarded = { ...props };
    for (const [key, kind] of [['onChange', 'native-change'], ['onChangeText', 'change-text'], ['onFocus', 'focus'], ['onBlur', 'blur']] as const) {
      const handler = props[key];
      forwarded[key] = function(this: unknown, ...args: unknown[]): unknown {
        try {
          if (kind === 'change-text') record(kind, label, args[0]);
          else {
            const event = args[0] as { nativeEvent?: { text?: unknown; eventCount?: unknown } } | undefined;
            record(kind, label, event?.nativeEvent?.text, event?.nativeEvent?.eventCount);
          }
        } catch { /* Even an unrecognized event must reach the original handler unchanged. */ }
        return typeof handler === 'function' ? Reflect.apply(handler, this, args) : undefined;
      };
    }
    // React19 carries ref as a prop. The original component receives that exact object/function.
    return createElement(original as ComponentType<Props>, forwarded);
  };
  for (const key of Reflect.ownKeys(original)) {
    if (['name', 'length', 'prototype', 'caller', 'arguments'].includes(String(key))) continue;
    const value = Object.getOwnPropertyDescriptor(original, key);
    if (value) Object.defineProperty(wrapper, key, value);
  }
  Object.defineProperty(wrapper, wrapped, { value: true });
  const getter = () => wrapper;
  Object.defineProperty(namespace, 'TextInput', { ...descriptor, get: getter });
  installed.add(namespace);
  return {
    arm(command) {
      if (disposed || active) return refuse();
      const match = new RegExp(`^inputtrace\\.arm\\.(poll-group|studio-stop)\\.(${uuid})$`).exec(command);
      if (!match || (match[1] === 'poll-group' ? scope.id !== 103 : scope.id !== 101)) return refuse();
      const slot = match[1] as Slot, nonce = match[2]!;
      active = { slot, nonce, label: slot === 'poll-group' ? 'اسم مجموعة جديدة' : 'اسم الموقف',
        expected: slot === 'poll-group' ? [`مجموعة أ ${nonce}`, `مجموعة ب ${nonce}`] : [`موقف ${nonce} 1`, `موقف ${nonce} 2`] };
    },
    read(command) {
      if (disposed || !active || command !== `inputtrace.read.${active.nonce}`) return refuse();
      return { version: 1, nonce: active.nonce, slot: active.slot, capped, events: events.map(event => ({ ...event })) };
    },
    dispose() {
      if (disposed) return;
      const current = Object.getOwnPropertyDescriptor(namespace, 'TextInput');
      if (current?.get !== getter || current.set !== descriptor.set || current.configurable !== descriptor.configurable || current.enumerable !== descriptor.enumerable) return refuse();
      Object.defineProperty(namespace, 'TextInput', descriptor); installed.delete(namespace); disposed = true;
    }
  };
}

export function inputTraceCommand(controller: InputTraceController, command: string): InputTraceReply {
  const match = new RegExp(`^inputtrace\\.arm\\.(poll-group|studio-stop)\\.(${uuid})$`).exec(command);
  if (match) {
    controller.arm(command);
    const { version, nonce, slot } = controller.read(`inputtrace.read.${match[2]!}`);
    return { phase: 'armed', version, nonce, slot };
  }
  if (!new RegExp(`^inputtrace\\.read\\.${uuid}$`).test(command)) return refuse();
  return { phase: 'captured', ...controller.read(command) };
}
