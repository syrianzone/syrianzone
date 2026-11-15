import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import React, { type ComponentType } from 'react';
import { act, create } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import * as accountModel from '../account-fixture-model';
import * as launchModel from './alignment-launch-model';
import * as model from './alignment-fixture-model';
import * as localStore from './alignment-local-store';
import * as sessionModel from './alignment-session-fixture';
import * as cleanupModel from '../studio-cleanup';
import { createPersistenceScopes } from '../../src/platform/persistence-scope-model';

const Product = () => React.createElement('div');
const fromApp = createRequire(import.meta.url);
const babel: { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null } = fromApp('@babel/core');
const code = babel.transformFileSync(fileURLToPath(new URL('../account-fixture.tsx', import.meta.url)), {
  babelrc: false, configFile: false, envName: 'production', presets: ['babel-preset-expo'],
  plugins: [() => ({ pre(file: { set(key: string, value: boolean): void }) { file.set('@babel/plugin-proposal-dynamic-import', true); } }), '@babel/plugin-transform-modules-commonjs'],
  caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, isNodeModule: false, supportsStaticESM: true, preserveEnvVars: true },
})?.code;
if (!code) throw new Error('The actual candidate fixture entry did not compile.');
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const origin = 'https://127.0.0.1:9443', run = '12345678-1234-4234-8234-123456789ABC';
const url = (stage: string) => `syrianzone://fixture/session?user=member&variant=alignment&run=${run}&stage=${stage}#synthetic-local-gate-12345`;

async function entry(input: string, rows: Map<string, string>, inspect: (renderer: ReturnType<typeof create>, events: string[]) => void, verifiedID = 101) {
  const events: string[] = [], db = new Database(':memory:'); db.exec('CREATE TABLE storage(key TEXT PRIMARY KEY NOT NULL,value TEXT)');
  for (const [key, value] of rows) db.query('INSERT INTO storage(key,value) VALUES(?,?)').run(key, value);
  const scope = await createPersistenceScopes(async value => createHash('sha256').update(value).digest('hex'))(origin);
  const parameters = (args: unknown[]) => (Array.isArray(args[0]) ? args[0] : args) as (string | null)[];
  const transaction = {
    getAllAsync: async (sql: string, ...args: unknown[]) => db.query(sql).all(...parameters(args)),
    runAsync: async (sql: string, ...args: unknown[]) => { events.push(sql.startsWith('DELETE') ? 'remove-owned-key' : 'write-owner-proof'); return db.query(sql).run(...parameters(args)); },
  };
  const database = { databasePath: '/fixture/Documents/SQLite/' + scope.databaseName, closeAsync: async () => { events.push('close'); },
    withExclusiveTransactionAsync: async (task: (tx: typeof transaction) => Promise<void>) => {
      db.exec('BEGIN'); try { await task(transaction); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  const storage = {
    getItemAsync: async (key: string) => (db.query('SELECT value FROM storage WHERE key=?').get(key) as { value: string } | null)?.value ?? null,
    getAllKeysAsync: async () => (db.query('SELECT key FROM storage').all() as { key: string }[]).map(row => row.key),
    removeItemAsync: async (key: string) => { events.push('cleanup-other'); db.query('DELETE FROM storage WHERE key=?').run(key); },
    clearAsync: async () => { throw new Error('Broad clear is forbidden in this test.'); }, closeAsync: async () => { events.push('close'); },
  };
  const response = (value: unknown, address: string) => {
    const result = new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
    Object.defineProperty(result, 'url', { value: address }); return result;
  };
  const transport = async (requestInput: RequestInfo | URL) => {
    const address = String(requestInput);
    if (address === origin + '/__native_fixture/session?user=member') return response({ origin, token: '1|synthetic-local-token-12345' }, address);
    if (address === origin + '/api/v1/user') return response({ id: verifiedID }, address);
    if (address === origin + '/api/v1/auth/logout') { events.push('revoke-fresh'); return response({ ok: true }, address); }
    throw new Error('Unexpected transport path.');
  };
  let Entry: ComponentType | undefined;
  const module = { exports: {} };
  runInNewContext(code!, { module, exports: module.exports, Symbol, URL, URLSearchParams, Headers, Request, Response, AbortController, setTimeout, clearTimeout,
    fetch: transport, process: { env: { EXPO_PUBLIC_NATIVE_PRESERVE_ALIGNMENT_DOCUMENT: '1' } }, console,
    require(name: string): unknown {
      if (name.startsWith('@babel/runtime/') || ['react/compiler-runtime', 'react/jsx-runtime'].includes(name)) return fromApp(name);
      if (name === 'react') return React;
      if (name === 'react-native') return { Text: 'text', TextInput: 'input', View: 'view' };
      if (name === 'expo') return { registerRootComponent(component: ComponentType) { Entry = component; } };
      if (name === 'expo-linking') return { addEventListener: () => ({ remove() {} }), getInitialURL: async () => input };
      if (name === 'expo-secure-store') return { setItemAsync: async () => { events.push('adopt-token'); }, deleteItemAsync: async () => { events.push('delete-scoped-credential'); }, WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1 };
      if (name === 'expo-crypto') return {};
      if (name === 'expo-sqlite') return { openDatabaseAsync: async () => database };
      if (name.endsWith('/platform/persistence')) return { getPersonalStorage: async () => storage, getPersistenceScope: async () => scope };
      if (name.endsWith('/platform/site-origin')) return { configuredSiteOrigin: origin };
      if (name.endsWith('/account-fixture-model')) return accountModel;
      if (name === './alignment-launch-model' || name === './alignment/alignment-launch-model') return launchModel;
      if (name === './alignment-fixture-model' || name === './alignment/alignment-fixture-model') return model;
      if (name === './alignment-local-store' || name === './alignment/alignment-local-store') return localStore;
      if (name === './alignment-session-fixture' || name === './alignment/alignment-session-fixture') return sessionModel;
      if (name === './studio-cleanup') return cleanupModel;
      if (name.endsWith('/account-input-trace') || name.endsWith('/account-input-trace-session')) return {};
      if (name.endsWith('/prayer-launch-model')) return { parsePrayerFixtureLaunch: () => null };
      if (name.endsWith('/quran-audio-observer')) return { QuranAudioObserver: () => null };
      if (name.includes('/prayer-sync/') || name.endsWith('/studio-fixture-model')) return {};
      if (name.endsWith('/src/App')) { events.push('App-import'); return { __esModule: true, default: Product }; }
      throw new Error('Unexpected candidate fixture dependency.');
    },
  });
  let renderer!: ReturnType<typeof create>;
  try {
    await act(async () => { renderer = create(React.createElement(Entry!)); await new Promise<void>(resolve => setImmediate(resolve)); });
    inspect(renderer, events);
    rows.clear(); for (const row of db.query('SELECT key,value FROM storage').all() as { key: string; value: string }[]) rows.set(row.key, row.value);
  } finally { if (renderer) await act(async () => renderer.unmount()); db.close(); }
}

test('compiled entry refuses existing drawing before App/token adoption, revokes only fresh token, and cleanup preserves raw pair', async () => {
  const rows = new Map([[model.alignmentDocumentKey, '{private unknown original'], ['unrelated', 'ordinary']]);
  await entry(url('fresh'), rows, (renderer, events) => {
    expect(renderer.root.findByProps({ testID: 'account.fixture.status' }).props.children).toBe('LOCAL FIXTURE SETUP FAILED');
    expect(events).toEqual(['close', 'revoke-fresh']); expect(renderer.root.findAllByType(Product).length).toBe(0);
  });
  expect(rows.get(model.alignmentDocumentKey)).toBe('{private unknown original'); expect(rows.has(model.alignmentOwnerKey)).toBe(false);
  await entry('syrianzone://fixture/cleanup', rows, (renderer, events) => {
    expect(renderer.root.findByProps({ testID: 'account.fixture.status' }).props.children).toBe('FIXTURE CLEANED, ORIGINAL DATA UNTOUCHED');
    expect(events.filter(value => value === 'delete-scoped-credential').length).toBe(3); expect(events).not.toContain('App-import');
  });
  expect([...rows]).toEqual([[model.alignmentDocumentKey, '{private unknown original']]);
});

test('compiled fresh entry arms proof before App/adoption and refuses wrong identity before any owner write', async () => {
  await entry(url('fresh'), new Map(), (renderer, events) => {
    expect(events.indexOf('write-owner-proof')).toBeLessThan(events.indexOf('adopt-token'));
    expect(events.indexOf('adopt-token')).toBeLessThan(events.indexOf('App-import'));
    expect(renderer.root.findAllByType(Product).length).toBe(1);
  });
  const rows = new Map<string, string>();
  await entry(url('fresh'), rows, (renderer, events) => {
    expect(renderer.root.findAllByType(Product).length).toBe(0); expect(events).toEqual(['revoke-fresh']);
  }, 103);
  expect(rows.size).toBe(0);
});

test('compiled cold close removes only exact acknowledged defaults, revokes fresh token, and never imports App or installs credentials', async () => {
  const defaults = { version: 1, axes: { left: 'اقتصادي', right: 'ليبرالي', top: 'محافظ', bottom: 'تقدمي' },
    colors: { topLeft: '#4CAF50', topRight: '#2196F3', bottomLeft: '#FF9800', bottomRight: '#9C27B0' }, dots: [] };
  const rows = new Map([[model.alignmentDocumentKey, JSON.stringify(defaults)], [model.alignmentOwnerKey,
    JSON.stringify({ version: 1, run, initial: 'absent', phase: 'empty-saved', pointID: 1234 })], ['unrelated', 'unchanged']]);
  await entry(url('close'), rows, (renderer, events) => {
    expect(renderer.root.findByProps({ testID: 'account.fixture.status' }).props.children).toBe('LOCAL ALIGNMENT CLOSED');
    expect(events).toEqual(['remove-owned-key', 'remove-owned-key', 'close', 'revoke-fresh']);
    expect(renderer.root.findAllByType(Product).length).toBe(0);
    const status = JSON.parse(renderer.root.findByProps({ testID: 'account.fixture.status' }).props.accessibilityValue.text);
    expect(status.alignment).toMatchObject({ run, phase: 'closed', documentAbsent: true, ownerAbsent: true });
  });
  expect([...rows]).toEqual([['unrelated', 'unchanged']]);
});
