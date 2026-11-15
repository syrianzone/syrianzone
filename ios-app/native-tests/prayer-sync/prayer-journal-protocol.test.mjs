import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { transformSync } from '@babel/core';
import { assertPrayerJournalProtocol } from './prayer-journal-protocol.mjs';
import { studioPreservationMode } from '../../scripts/studio-runner-policy.mjs';
import { alignmentPreservationMode } from '../alignment/alignment-runner-policy.mjs';
import { prayerPreservationMode } from './prayer-runner-policy.mjs';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const syntheticCA = Buffer.from('synthetic test CA, never used for HTTP');
test('only an unauthenticated refusal advertising exact version 2 is accepted', async () => {
  let calls = 0;
  const readCA = file => { assert.equal(file, join(root, '.expo/local-fixture/tls/ca.pem')); return syntheticCA; };
  const transport = async ca => { assert.equal(ca, syntheticCA); calls++; return { status: 403, version: '2' }; };
  await assertPrayerJournalProtocol(root, { readCA, transport }); assert.equal(calls, 1);
  for (const value of [{ status: 403, version: '1' }, { status: 403 }, { status: 302, version: '2' }, { status: 200, version: '2' }, { status: 403, version: ['2'] }, { status: 403, version: '2, 2' }]) {
    await assert.rejects(assertPrayerJournalProtocol(root, { readCA, transport: async () => value }), /version 2/);
  }
  await assert.rejects(assertPrayerJournalProtocol(root, { readCA: () => { throw new Error('synthetic read refusal'); }, transport }), /version 2/);
  await assert.rejects(assertPrayerJournalProtocol(root, { readCA, transport: async () => { throw new Error('synthetic transport refusal'); } }), /version 2/);
  assert.equal(calls, 1);
});

const source = readFileSync(new URL('../../scripts/verify-native-adapters.mjs', import.meta.url), 'utf8');
const sourceURL = pathToFileURL(join(root, 'scripts/verify-native-adapters.mjs')).href;
const compiled = transformSync(source, {
  babelrc: false, configFile: false,
  plugins: [({ types }) => ({ visitor: { MetaProperty(path) {
    assert.equal(path.node.meta.name, 'import'); assert.equal(path.node.property.name, 'meta');
    path.replaceWith(types.objectExpression([types.objectProperty(types.identifier('url'), types.stringLiteral(sourceURL))]));
  } } }), '@babel/plugin-transform-modules-commonjs'],
})?.code;
assert.ok(compiled);
const requireFromHere = createRequire(import.meta.url);
async function runDraft(prayer, protocolAccepted) {
  const events = [], stop = new Error('first synthetic mkdir');
  const args = ['--device', '00000000-0000-4000-8000-000000000000', '--team', 'SYNTHETIC1', '--run', 'synthetic-schema-only'];
  if (prayer) args.push('--fixture', 'account', '--preserve-prayer-state', '--only', 'SyrianZoneUITests/NativePrayerAccountUITests');
  const filesystem = {
    existsSync: () => { events.push('exists'); return false; },
    mkdirSync: () => { events.push('mkdir'); throw stop; },
  };
  for (const name of ['copyFileSync', 'openSync', 'closeSync', 'readFileSync', 'readdirSync', 'unlinkSync', 'writeFileSync']) filesystem[name] = () => { throw new Error('Unexpected filesystem action.'); };
  const scope = { argv: ['node', 'synthetic-runner.mjs', ...args], env: {} };
  const require = name => {
    if (name === 'node:fs') return filesystem;
    if (name === 'node:child_process') return { spawnSync: () => { throw new Error('A native process must never run in the host test.'); } };
    if (name === 'node:path' || name === 'node:url') return requireFromHere(name);
    if (name === '../native-tests/alignment/alignment-runner-policy.mjs') return { alignmentPreservationMode };
    if (name === './studio-runner-policy.mjs') return { studioPreservationMode };
    if (name === '../native-tests/prayer-sync/prayer-runner-policy.mjs') return { prayerPreservationMode };
    if (name === './smoke-ios.mjs') return { isAppRunning: () => { throw new Error('Unexpected restoration verification before the first directory action.'); } };
    if (name === './native-test-results.mjs') return { assertSelectedTestsPassed: () => { throw new Error('Unexpected result read.'); } };
    if (name === '../native-tests/prayer-sync/prayer-journal-protocol.mjs') return { assertPrayerJournalProtocol: async observedRoot => {
      assert.equal(observedRoot, root); events.push('protocol');
      await assertPrayerJournalProtocol(observedRoot, { readCA: () => syntheticCA, transport: async () => ({ status: 403, version: protocolAccepted ? '2' : '1' }) });
    } };
    throw new Error('Unexpected compiled runner import.');
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await assert.rejects(new AsyncFunction('require', 'process', 'exports', compiled)(require, scope, {}), error => protocolAccepted || !prayer ? error === stop : /version 2/.test(error.message));
  return events;
}
test('the actual compiled runner rejects a stale Prayer protocol before filesystem or native side effects', async () => {
  assert.deepEqual(await runDraft(true, false), ['protocol']);
});
test('accepted Prayer and unchanged ordinary modes reach only the first mocked directory action', async () => {
  assert.deepEqual(await runDraft(true, true), ['protocol', 'exists', 'mkdir']);
  assert.deepEqual(await runDraft(false, false), ['exists', 'mkdir']);
  assert.match(source, /default-test-execution-time-allowance', '900'/);
  assert.match(source, /maximum-test-execution-time-allowance', '1200'/);
  assert.equal((source.match(/\.\.\.testTimeouts/g) ?? []).length, 2);
});
