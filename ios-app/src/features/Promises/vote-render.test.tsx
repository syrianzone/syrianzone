import { expect, spyOn, test } from 'bun:test';
import React, { createElement, type ComponentType } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { createDocumentStore } from '../../platform/document-store';
import { record } from '../../platform/validation';
import * as model from './model';
import * as state from './vote-state';

const requireFromApp = createRequire(import.meta.url);
const babel: { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null } = requireFromApp('@babel/core');
const code = babel.transformFileSync(fileURLToPath(new URL('./Primitives.tsx', import.meta.url)), {
  babelrc: false, configFile: false, envName: 'production', presets: ['babel-preset-expo'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
  caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, isNodeModule: false, supportsStaticESM: true, supportsReactCompiler: true }
})?.code;
if (!code) throw new Error('Promise production compilation returned no code.');
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('production-compiled votes update selection and tallies after an async choice and changed choice without replacing card props', async () => {
  const account = { ready: true, busy: false, user: { id: 99007 }, sessionGeneration: 1 };
  const card = model.decodePromiseCard({ id: '11111111-1111-4111-8111-111111111111', number: 731719,
    title: 'وعد اختباري محلي', speaker: { id: null, name: 'مسؤول اختباري', title: null, image: null }, coSpeakers: [],
    institution: null, sector: null, isNational: true, governorates: [], tags: [], statementDate: '2026-01-01',
    deadlineDate: '2026-12-01', deadlineWording: null, status: 'pending', state: 'pending', daysLeft: 1, daysSince: 1,
    counter: { mode: 'left', value: 1 }, keptLate: false, resolvedAt: null, target: null, votingOpen: true, votes: { yes: 0, no: 0 } });
  const values = new Map<string, string>(), documents = createDocumentStore({
    getItemAsync: async key => values.get(key) ?? null, setItemAsync: async (key, value) => { values.set(key, value); }
  });
  const calls: boolean[] = [];
  let acknowledge: ((votes: model.PromiseVotes) => void) | undefined;
  const api = { request(path: string, decode: (raw: unknown) => unknown, options: { body: { believes: boolean }; method: string }) {
    expect(path).toBe(`promises/${card.number}/vote`); expect(options.method).toBe('POST'); calls.push(options.body.believes);
    return new Promise(resolve => { acknowledge = votes => resolve(decode({ votes })); });
  } };
  const module = { exports: {} as { PromiseVote?: ComponentType<{ card: model.PromiseCardData }> } };
  const colors = { danger: '#c00' };
  runInNewContext(code!, { module, exports: module.exports, Symbol, console,
    require(name: string): unknown {
      if (name.startsWith('@babel/runtime/') || name === 'react/compiler-runtime' || name === 'react/jsx-runtime') return requireFromApp(name);
      if (name === 'react') return React;
      if (name === 'react-native') return { View: 'view' };
      if (name === 'expo-image') return { Image: 'image' };
      if (name === '../../api') return { api, ApiError: class extends Error {} };
      if (name === '../../components') return { Label: 'label', Section: 'section' };
      if (name === '../../ui/native') return { NativeAction: 'action', NativeSymbol: 'symbol' };
      if (name === '../../ui/theme') return { useTheme: () => ({ colors }) };
      if (name === '../../platform/account') return { useAccount: () => account };
      if (name === '../../platform/device') return { getDeviceId: async () => 'synthetic-native-device' };
      if (name === '../../platform/clock' || name === './rules') return {};
      if (name === '../../platform/storage') return { readDocument: documents.read, writeDocument: documents.write };
      if (name === '../../platform/validation') return { record };
      if (name === './model') return model;
      if (name === './vote-state') return state;
      throw new Error('Unexpected vote dependency: ' + name);
    }
  });
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => { renderer = create(createElement(module.exports.PromiseVote!, { card })); });
    const actions = () => renderer!.root.findAll(node => String(node.type) === 'action');
    const action = (title: string) => actions().find(node => node.props.title === title)!;
    const labels = () => renderer!.root.findAll(node => String(node.type) === 'label').map(node => [node.props.children].flat().join(''));
    expect(labels()).toContain('0 نعم، 0 لا، 0% يرجّحون تحققه');
    await act(async () => { action('نعم، أعتقد أنه سيتحقق').props.onPress(); });
    expect(calls).toEqual([true]); expect(actions().every(node => node.props.disabled === true)).toBe(true);
    await act(async () => { acknowledge!({ yes: 1, no: 0 }); });
    const key = state.promiseVoteKey(account.user.id, card.number);
    expect(state.readVote(key).choice).toBe(true);
    expect(action('✓ نعم، أعتقد أنه سيتحقق').props.disabled).toBe(true);
    expect(labels()).toContain('1 نعم، 0 لا، 100% يرجّحون تحققه');
    await act(async () => { action('لا، لا أعتقد أنه سيتحقق').props.onPress(); });
    expect(calls).toEqual([true, false]);
    await act(async () => { acknowledge!({ yes: 0, no: 1 }); });
    expect(state.readVote(key).choice).toBe(false);
    expect(action('✓ لا، لا أعتقد أنه سيتحقق').props.disabled).toBe(true);
    expect(action('نعم، أعتقد أنه سيتحقق').props.disabled).toBe(false);
    expect(labels()).toContain('0 نعم، 1 لا، 0% يرجّحون تحققه');
    expect(await documents.read(key, value => value, null)).toBe(false);
    expect(card.votes).toEqual({ yes: 0, no: 0 });
  } finally {
    if (renderer) await act(async () => { renderer?.unmount(); });
    const messages = warning.mock.calls.map(call => call[0]); warning.mockRestore();
    expect(messages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  }
});
