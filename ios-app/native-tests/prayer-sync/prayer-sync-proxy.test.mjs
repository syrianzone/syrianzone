import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createPrayerSyncHandler, parsePrayerCommand } from './prayer-sync-proxy.mjs';

const nonce = 'ABCDEF00-0000-4000-8000-000000000099', day = '2026-11-15';
const gate = 'synthetic-fixture-key-0001';
const command = { nonce, day, action: 'arm' };
let calls = 0, checks = 0;
const handler = createPrayerSyncHandler('/unread-test-runtime', {
  readAccess: () => ({ key: gate }),
  runCommand: input => { calls++; assert.deepEqual(input, command); return { journalVersion: 2, status: 200, ok: true, nonce, day, phase: 0, pending: null, restored: false, closed: false, private: gate }; },
});
async function send(overrides = {}, body = JSON.stringify(command)) {
  const input = Readable.from([Buffer.from(body)]);
  Object.assign(input, { method: 'POST', url: '/__native_fixture/prayer-sync', socket: { remoteAddress: '127.0.0.1' },
    headers: { host: '127.0.0.1:9443', 'content-type': 'application/json', 'x-native-fixture-key': gate }, ...overrides });
  let status = 0, output = '';
  const outgoing = { setHeader() {}, writeHead(value) { status = value; }, end(value) { output = value; } };
  const handled = await handler(input, outgoing);
  checks++;
  return { status, output, handled };
}
const accepted = await send();
assert.equal(accepted.status, 200); assert.equal(calls, 1); assert.ok(!accepted.output.includes(gate));
for (const patch of [{ method: 'GET' }, { socket: { remoteAddress: '::1' } },
  { headers: { host: 'foreign.invalid', 'content-type': 'application/json', 'x-native-fixture-key': gate } },
  ...[{ origin: 'https://127.0.0.1:9443' }, { origin: 'null' }, { cookie: 'private' }, { authorization: 'private' }, { 'x-native-fixture-key': 'wrong' }]
    .map(headers => ({ headers: { host: '127.0.0.1:9443', 'content-type': 'application/json', 'x-native-fixture-key': gate, ...headers } }))]) {
  assert.equal((await send(patch)).status, 403);
}
assert.equal((await send({}, 'x'.repeat(2049))).status, 413);
for (const patch of [{ user: 103 }, { action: 'reset' }, { nonce: nonce.toLowerCase() }, { day: '2026-02-30' }, { index: 1 }, { settings: {} }]) {
  assert.equal((await send({}, JSON.stringify({ ...command, ...patch }))).status, 409);
}
for (const [url, expected] of [['/__native_fixture/prayer-sync?x=1', false], ['/api/v1/user', false]]) {
  assert.equal((await send({ url })).handled, expected);
}
assert.equal(calls, 1);
assert.deepEqual(parsePrayerCommand({ ...command, action: 'intent', index: 1 }), { ...command, action: 'intent', index: 1 });
assert.deepEqual(parsePrayerCommand({ ...command, action: 'context' }), { ...command, action: 'context' });
assert.throws(() => parsePrayerCommand({ ...command, action: 'context', settings: {} }));
const contextValue = { version: 2, home101: 'a'.repeat(64), home102: 'b'.repeat(64), appearance101: 'dark', appearance102: 'light', seed102: false };
let context = contextValue;
const contextHandler = createPrayerSyncHandler('/unread-test-runtime', {
  readAccess: () => ({ key: gate }),
  runCommand: input => {
    assert.equal(input.action, 'context');
    return { journalVersion: 2, status: 200, ok: true, nonce, day, phase: 2, pending: 3, restored: false, closed: false, context, private: gate };
  },
});
async function contextRequest() {
  checks++;
  const input = Readable.from([Buffer.from(JSON.stringify({ ...command, action: 'context' }))]);
  Object.assign(input, { method: 'POST', url: '/__native_fixture/prayer-sync', socket: { remoteAddress: '127.0.0.1' },
    headers: { host: '127.0.0.1:9443', 'content-type': 'application/json', 'x-native-fixture-key': gate } });
  let status = 0, output = '';
  await contextHandler(input, { setHeader() {}, writeHead(value) { status = value; }, end(value) { output = value; } });
  return { status, value: JSON.parse(output) };
}
const validContext = await contextRequest();
assert.equal(validContext.status, 200); assert.deepEqual(validContext.value.context, contextValue); assert.ok(!JSON.stringify(validContext).includes(gate));
for (const patch of [{ version: 1 }, { settings: {} }, { home101: 'wrong' }, { appearance102: 'unknown' }, { seed102: 1 }]) {
  context = { ...contextValue, ...patch };
  assert.equal((await contextRequest()).status, 409);
}
console.log(`Prayer proxy: ${checks} request checks passed.`);
