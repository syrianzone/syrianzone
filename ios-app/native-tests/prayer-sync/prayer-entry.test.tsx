import { Database } from 'bun:sqlite';
import * as atomicModel from './prayer-local-store';
import { memoryPrayerStore } from './memory-store.test-support';
import { expect, spyOn, test } from 'bun:test';
import React, { createElement, type ComponentType } from 'react';
import { act, create } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import * as accountModel from '../account-fixture-model';
import * as inputTraceModel from '../account-input-trace';
import * as inputTraceSession from '../account-input-trace-session';
import * as launchModel from './prayer-launch-model';
import * as localModel from './prayer-local-journal';
import * as restoreModel from './prayer-restore-fixture';
import * as timesModel from '../prayer-sync/prayer-times-fixture';
import * as sessionModel from './prayer-session-fixture';
import * as cleanupModel from '../studio-cleanup';
import { createPersistenceScopes } from '../../src/platform/persistence-scope-model';

const origin = 'https://127.0.0.1:9443', run = 'ABCDEF00-0000-4000-8000-000000000099', day = '2026-11-15', gate = 'synthetic-fixture-key-0001';
const homePreferences = { showWeather: true, showPrayerTimes: true, showEvents: true, eventsGovernorate: 'all', customLinks: [] };
const homeSettings = { ...homePreferences, theme: 'dark' };
async function homeContext() { const hash = createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(homePreferences).sort(([a], [b]) => a < b ? -1 : 1)))).digest('hex');
  return { version: 2 as const, home101: hash, home102: hash, appearance101: 'dark' as const, appearance102: 'dark' as const, seed102: true }; }
const requireFromApp = createRequire(import.meta.url);
const babel: { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null } = requireFromApp('@babel/core');
const code = babel.transformFileSync(fileURLToPath(new URL('../account-fixture.tsx', import.meta.url)), {
  babelrc: false, configFile: false, envName: 'production', presets: ['babel-preset-expo'],
  // Enable the installed CommonJS plugin's own dynamic-import transform for this require-only VM.
  plugins: [() => ({ pre(file: { set(key: string, value: boolean): void }) { file.set('@babel/plugin-proposal-dynamic-import', true); } }), '@babel/plugin-transform-modules-commonjs'],
  caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, isNodeModule: false, supportsStaticESM: true, preserveEnvVars: true },
})?.code;
if (!code) throw new Error('The actual fixture entry did not compile.');
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
function response(value: unknown, url: string, status = 200): Response {
  const result = new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  Object.defineProperty(result, 'url', { value: url });
  return result;
}
async function renderEntry(input: string, values: Map<string, string>, restoreStatus: number,
  inspect: (renderer: ReturnType<typeof create>, events: string[]) => void, preservePrayer = input.includes('prayer-sync')) {
  const events: string[] = [];
  let Entry: ComponentType | undefined;
  const hash = async (value: string) => createHash('sha256').update(value).digest('hex');
  const scopes = createPersistenceScopes(hash);
  const context = await homeContext();
  const db = new Database(':memory:'); db.exec('CREATE TABLE storage(key TEXT PRIMARY KEY NOT NULL,value TEXT)');
  for (const [key, value] of values) db.query('INSERT INTO storage(key,value) VALUES(?,?)').run(key, value);
  const scope = await scopes(origin);
  const parameters = (args: unknown[]) => (Array.isArray(args[0]) ? args[0] : args) as (string | null)[];
  const queries = {
    getFirstAsync: async (sql: string, ...args: unknown[]) => db.query(sql).get(...parameters(args)),
    getAllAsync: async (sql: string, ...args: unknown[]) => db.query(sql).all(...parameters(args)),
    runAsync: async (sql: string, ...args: unknown[]) => {
      const bound = parameters(args), result = db.query(sql).run(...bound);
      const key = sql.startsWith('UPDATE') ? bound[1] : bound[0];
      events.push((sql.startsWith('DELETE') ? 'remove:' : 'write:') + String(key));
      return result;
    },
  };
  const database = { ...queries, databasePath: '/fixture/Documents/SQLite/' + scope.databaseName,
    withExclusiveTransactionAsync: async (work: (transaction: typeof queries) => Promise<void>) => {
      db.exec('BEGIN'); try { await work(queries); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
    } };
  const store = { getItemAsync: async (key: string) => (db.query('SELECT value FROM storage WHERE key=?').get(key) as { value: string } | null)?.value ?? null,
    clearAsync: async () => { throw new Error('Broad clear is forbidden in this case.'); }, closeAsync: async () => { events.push('close'); } };
  const transport = async (requestInput: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(requestInput);
    if (url === origin + '/__native_fixture/session?user=member') return response({ origin, token: '1|synthetic-token-0000000001' }, url);
    if (url === origin + '/api/v1/user') return response({ id: 101, settings: homeSettings }, url);
    if (url === origin + '/api/v1/auth/logout') { events.push('revoke'); return response({ ok: true }, url); }
    if (url === origin + '/__native_fixture/prayer-sync') {
      const action = JSON.parse(String(init?.body)).action;
      if (action === 'context') { events.push('context'); return response({ journalVersion: 2, ok: true, nonce: run, day, phase: 0, pending: null, restored: false, closed: false, context }, url); }
      events.push('server restore'); return response({ journalVersion: 2, ok: true, nonce: run, day, phase: 0, pending: null, restored: true, closed: false }, url, restoreStatus);
    }
    throw new Error('Unexpected entry transport path.');
  };
  const module = { exports: {} };
  runInNewContext(code!, { module, exports: module.exports, Symbol, URL, URLSearchParams, Headers, Request, Response, AbortController, setTimeout, clearTimeout,
    fetch: transport, process: { env: preservePrayer ? { EXPO_PUBLIC_NATIVE_PRESERVE_PRAYER_STATE: '1' } : {} }, console,
    require(name: string): unknown {
      if (name.startsWith('@babel/runtime/') || name === 'react/compiler-runtime' || name === 'react/jsx-runtime') return requireFromApp(name);
      if (name === 'react') return React;
      if (name === 'react-native') return { Text: 'text', TextInput: 'input', View: 'view' };
      if (name === 'expo') return { registerRootComponent(value: ComponentType) { Entry = value; } };
      if (name === 'expo-linking') return { addEventListener: () => ({ remove() {} }), getInitialURL: async () => input };
      if (name === 'expo-secure-store') return { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'private', setItemAsync: async () => { events.push('token'); }, deleteItemAsync: async () => { events.push('delete token'); } };
      if (name === 'expo-sqlite') return { openDatabaseAsync: async (databaseName: string) => { expect(databaseName).toBe(scope.databaseName); return database; } };
      if (name === './prayer-sync/prayer-local-store') return atomicModel;
      if (name === 'expo-crypto') return { CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async (_algorithm: string, value: string) => hash(value) };
      if (name === '../src/platform/persistence') return { getPersonalStorage: async () => store, getPersistenceScope: async () => scopes(origin) };
      if (name === '../src/platform/site-origin') return { configuredSiteOrigin: origin };
      if (name === './account-fixture-model') return accountModel;
      if (name === './account-input-trace') return inputTraceModel;
      if (name === './account-input-trace-session') return inputTraceSession;
      if (name === './alignment/alignment-launch-model') return { parseAlignmentFixtureLaunch: () => null };
      if (['./alignment/alignment-fixture-model', './alignment/alignment-local-store', './alignment/alignment-session-fixture'].includes(name)) return {};
      if (name === './studio-cleanup') return cleanupModel;
      if (name === './studio-fixture-model') return { prepareStudioPending() { throw new Error('Unexpected Studio preparation.'); } };
      if (name === './quran-audio-observer') return { QuranAudioObserver: () => null };
      if (name === './prayer-sync/prayer-launch-model') return launchModel;
      if (name === './prayer-sync/prayer-local-journal') return localModel;
      if (name === './prayer-sync/prayer-restore-fixture') return restoreModel;
      if (name === './prayer-sync/prayer-times-fixture') return timesModel;
      if (name === './prayer-sync/prayer-session-fixture') return sessionModel;
      if (name === '../src/App') { events.push('App import'); return { __esModule: true, default: () => createElement('app') }; }
      throw new Error('Unexpected entry import: ' + name);
    },
  });
  expect(Entry).toBeDefined();
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  let renderer: ReturnType<typeof create> | undefined;
  try {
    await act(async () => { renderer = create(createElement(Entry!)); });
    values.clear();
    for (const row of db.query('SELECT key,value FROM storage').all() as { key: string; value: string }[]) values.set(row.key, row.value);
    inspect(renderer!, events);
    expect(warning.mock.calls.every(call => call[0] === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  } finally {
    await act(async () => { renderer?.unmount(); });
    warning.mockRestore(); db.close();
  }
}
test('the actual entry journals local state before token storage or importing App', async () => {
  const values = new Map<string, string>();
  await renderEntry(`syrianzone://fixture/session?user=member&variant=prayer-sync&run=${run}&day=${day}#${gate}`, values, 200, (renderer, events) => {
    expect(events).toEqual(['context', 'write:' + localModel.prayerJournalKey, 'token', 'App import']);
    const local = renderer.root.find(node => node.props.testID === 'account.fixture.prayer.local');
    expect(JSON.parse(local.props.accessibilityValue.text)).toEqual({ journalVersion: 2, nonce: run, day, ready: true });
    expect(renderer.root.findAll(node => String(node.type) === 'app')).toHaveLength(1);
  });
});
test('the cold restore verifies the server then restores exact local state without importing App or touching tokens', async () => {
  for (const status of [200, 403]) {
    const values = new Map<string, string>();
    const local = localModel.createPrayerLocalJournal(memoryPrayerStore(values), origin,
    async value => createHash('sha256').update(value).digest('hex'));
    await local.prepare(run, day, await homeContext(), { userId: 101, settings: homeSettings, phase: 0, pending: null });
    values.set(localModel.prayerFaithKey, JSON.stringify({ method: 3, methodChosen: false, prayerLog: { [day]: { Fajr: true } }, quranPage: 1, quranPageAt: 0 }));
    await renderEntry(`syrianzone://fixture/prayer-sync-restore?run=${run}&day=${day}#${gate}`, values, status, (renderer, events) => {
      expect(events.includes('App import')).toBe(false); expect(events.includes('token')).toBe(false);
      if (status === 200) {
        expect(events).toEqual(['server restore', 'remove:' + localModel.prayerFaithKey, 'remove:' + localModel.prayerHomeKey, 'remove:' + localModel.prayerAppearanceKey, 'remove:' + localModel.prayerJournalKey]);
        const marker = renderer.root.find(node => node.props.testID === 'account.fixture.prayer.local');
        expect(JSON.parse(marker.props.accessibilityValue.text)).toEqual({ journalVersion: 2, nonce: run, day, restored: true, serverRestored: true });
      } else { expect(events).toEqual(['server restore']); expect(values.has(localModel.prayerJournalKey)).toBe(true); }
    });
  }
});
test('the ordinary fixture session creates no Prayer journal or markers', async () => {
  await renderEntry(`syrianzone://fixture/session?user=member#${gate}`, new Map(), 200, (renderer, events) => {
    expect(events).toEqual(['token', 'App import']);
    expect(renderer.root.findAll(node => node.props.testID === 'account.fixture.prayer.local')).toHaveLength(0);
    expect(renderer.root.findAll(node => node.props.testID === 'account.fixture.prayer.times')).toHaveLength(0);
  });
});
test('a refused Prayer preflight revokes its fresh token and preserves existing bytes without App adoption', async () => {
  const values = new Map([[localModel.prayerFaithKey, '{invalid existing faith bytes']]);
  await renderEntry(`syrianzone://fixture/session?user=member&variant=prayer-sync&run=${run}&day=${day}#${gate}`, values, 200, (renderer, events) => {
    expect(events).toEqual(['context', 'revoke']);
    expect(values.get(localModel.prayerFaithKey)).toBe('{invalid existing faith bytes');
    expect(renderer.root.findAll(node => String(node.type) === 'app')).toHaveLength(0);
  });
});
test('the actual outer cleanup in Prayer mode closes storage without deleting any personal values', async () => {
  const values = new Map([[localModel.prayerFaithKey, '{existing history bytes'], [localModel.prayerJournalKey, 'retained recovery bytes'], ['unrelated', 'preserve']]);
  const before = [...values.entries()];
  await renderEntry('syrianzone://fixture/cleanup', values, 200, (_renderer, events) => {
    expect(events).toEqual(['delete token', 'delete token', 'delete token', 'close']);
    expect([...values.entries()]).toEqual(before);
  }, true);
});
