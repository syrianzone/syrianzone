import { expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { canonicalHttpsOrigin } from '../../platform/site-origin';
import * as lifecycle from './realtime-model';

const requireFromApp = createRequire(import.meta.url);
const babel: { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null } = requireFromApp('@babel/core');
const directory = new URL('../../../', import.meta.url);
function compiled(path: string): string {
  const output = babel.transformFileSync(fileURLToPath(new URL(path, directory)), {
    babelrc: false, configFile: false, presets: ['babel-preset-expo'], plugins: ['@babel/plugin-transform-modules-commonjs'],
  })?.code;
  if (!output) throw new Error('Realtime boundary compilation returned no code.');
  return output;
}
interface OriginOptions { apiKey: string; origin?: string }

for (const entry of ['src/index.tsx', 'lib/commonjs/index.js', 'lib/module/index.js']) {
  test(`pinned Pusher ${entry} forwards only the explicit Origin option and preserves an omitted default`, async () => {
    const forwarded: Record<string, unknown>[] = [];
    const module = { exports: {} as { Pusher: { getInstance(): { init(options: OriginOptions): Promise<void> } } } };
    class Emitter { addListener() { return { remove() {} }; } removeAllListeners() {} }
    runInNewContext(compiled(`node_modules/@pusher/pusher-websocket-react-native/${entry}`), {
      module, exports: module.exports, console,
      require(name: string): unknown {
        if (name === 'react-native') return { NativeModules: { PusherWebsocketReactNative: { initialize: async (options: Record<string, unknown>) => { forwarded.push(options); } } }, NativeEventEmitter: Emitter, Platform: { select: () => '' } };
        if (name.startsWith('@babel/runtime/')) return requireFromApp(name);
        throw new Error('Unexpected Pusher dependency: ' + name);
      },
    });
    const client = module.exports.Pusher.getInstance();
    await client.init({ apiKey: 'public-test-key' });
    expect(Object.hasOwn(forwarded[0]!, 'origin')).toBe(false);
    await client.init({ apiKey: 'public-test-key', origin: 'https://127.0.0.1:9443' });
    expect(forwarded[1]!.origin).toBe('https://127.0.0.1:9443');
    expect(Object.hasOwn(forwarded[1]!, 'headers')).toBe(false);
  });
}

test('the actual room controller sends the canonical API origin rather than the socket host or account credentials', async () => {
  const initialized: Record<string, unknown>[] = [];
  let connected!: () => void;
  const ready = new Promise<void>(resolve => { connected = resolve; });
  const client = { init: async (options: Record<string, unknown>) => { initialized.push(options); }, subscribe: async () => {},
    connect: async () => { connected(); }, unsubscribe: async () => {}, disconnect: async () => {}, getChannel: () => undefined };
  const origin = canonicalHttpsOrigin('HTTPS://127.0.0.1:9443/');
  const module = { exports: {} as { connectRoom(code: string, identity: string, signal: AbortSignal, handlers: Record<string, (...args: unknown[]) => void>): () => void } };
  runInNewContext(compiled('src/features/GuessWho/realtime.ts'), {
    module, exports: module.exports, Symbol, console,
    require(name: string): unknown {
      if (name === '@pusher/pusher-websocket-react-native') return { Pusher: { getInstance: () => client } };
      if (name === '../../api') return { api: { realtimeConfig: async () => ({ key: 'public-test-key', host: 'socket.example.test', port: 443, scheme: 'https' }) } };
      if (name === '../../platform/site-origin') return { configuredSiteOrigin: origin };
      if (name === './api') return { guessWhoApi: { authorize: async () => ({ auth: 'test-signature', channel_data: '{}' }) } };
      if (name === './model') return { decodeBroadcast: () => { throw new Error('Unexpected room event.'); } };
      if (name === './realtime-model') return lifecycle;
      if (name.startsWith('@babel/runtime/')) return requireFromApp(name);
      throw new Error('Unexpected room dependency: ' + name);
    },
  });
  const errors: string[] = [], controller = new AbortController();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const stop = module.exports.connectRoom('owned-test-room', 'owned-test-identity', controller.signal, {
    state() {}, peer() {}, connection() {}, subscribed() {}, error: message => errors.push(String(message)),
  });
  try {
    await Promise.race([ready, new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('Room setup did not reach the stub socket. ' + errors.join(' '))), 1000); })]);
    expect(initialized).toHaveLength(1);
    expect(initialized[0]!.origin).toBe(origin);
    expect(initialized[0]!.host).toBe('socket.example.test');
    expect(initialized[0]!.useTLS).toBe(true);
    expect(Object.hasOwn(initialized[0]!, 'headers')).toBe(false);
    expect(Object.hasOwn(initialized[0]!, 'Authorization')).toBe(false);
  } finally { if (deadline) clearTimeout(deadline); controller.abort(); stop(); }
});

// The JavaScript and patch-contract cases remain platform independent.
test.skipIf(process.platform !== 'darwin')('the native Origin validator executes against canonical origins and refuses header injection or URL components', () => {
  const path = new URL('node_modules/@pusher/pusher-websocket-react-native/ios/PusherWebsocketReactNative.swift', directory);
  const source = readFileSync(path, 'utf8');
  const validator = source.indexOf('enum PusherOrigin {');
  expect(validator).toBeGreaterThan(0);
  const checks = String.raw`
let accepted = ["https://syrian.zone", "https://127.0.0.1:9443", "https://example.test:8443", "https://[::1]:9443"]
for origin in accepted { precondition(PusherOrigin.validated(origin) == origin, "Canonical HTTPS origin rejected") }
let rejected: [Any] = [NSNull(), 1, true, "", "http://syrian.zone", "HTTPS://syrian.zone", "https://Syrian.Zone", "https://syrian.zone/", "https://syrian.zone/path", "https://syrian.zone?", "https://syrian.zone#", "https://user@syrian.zone", "https://user:password@syrian.zone", "https://syrian.zone:443", "https://syrian.zone:0", "https://syrian.zone:65536", "https://syrian.zone\r\nAuthorization: bad", " https://syrian.zone", "https://syrian.zone ", "https://syrian.zone\t", "https://syrian%2ezone", "https://"]
for origin in rejected { precondition(PusherOrigin.validated(origin) == nil, "Noncanonical or unsafe origin accepted") }
print("Native Origin validator: \(accepted.count) accepted, \(rejected.count) rejected")
`;
  const result = Bun.spawnSync({ cmd: ['swift', '-'], stdin: new TextEncoder().encode('import Foundation\n' + source.slice(validator) + checks), stdout: 'pipe', stderr: 'pipe', timeout: 10000 });
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  expect(result.exitCode, output).toBe(0);
  expect(output).toContain('4 accepted, 22 rejected');
}, 20_000);

test('the maintained native patch adds only the Origin header before connection and keeps the public socket delegate', () => {
  const source = readFileSync(new URL('node_modules/@pusher/pusher-websocket-react-native/ios/PusherWebsocketReactNative.swift', directory), 'utf8');
  expect(source).toContain('PusherOrigin.validated(value)');
  expect(source).toContain('webSocketOptions.setAdditionalHeaders([("Origin", origin)])');
  expect(source).toContain('socket.delegate = connection');
  expect(source).toContain('connection.socket = socket');
  expect(source.indexOf('PusherOrigin.validated(value)')).toBeLessThan(source.indexOf('pusher.unsubscribeAll()'));
  expect(source).not.toContain('disableSSLCertValidation');
  expect(source).not.toContain('allowSelfSigned');
});
