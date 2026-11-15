import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
const project = fileURLToPath(new URL('../', import.meta.url));
const candidate = fileURLToPath(new URL('./verify-native-adapters.mjs', import.meta.url));
const originalBundle = 'ORIGINAL PRODUCT BYTECODE';
function runRunner(options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'native-runner-recovery-'));
  fs.chmodSync(directory, 0o700);
  try {
    for (const name of ['scripts', 'native-tests/prayer-sync', 'native-tests/alignment', 'tools']) fs.mkdirSync(path.join(directory, name), { recursive: true });
    fs.copyFileSync(candidate, path.join(directory, 'scripts/verify-native-adapters.mjs'));
    for (const name of ['scripts/studio-runner-policy.mjs', 'scripts/native-test-results.mjs', 'scripts/smoke-ios.mjs', 'scripts/simulator.mjs',
      'native-tests/alignment/alignment-runner-policy.mjs', 'native-tests/prayer-sync/prayer-runner-policy.mjs', 'native-tests/prayer-sync/prayer-journal-protocol.mjs']) fs.copyFileSync(path.join(project, name), path.join(directory, name));
    const app = path.join(directory, '.expo/full-site-native/Build/Products/Release-iphonesimulator/SyrianZone.app');
    fs.mkdirSync(app, { recursive: true }); fs.writeFileSync(path.join(app, 'main.jsbundle'), originalBundle); fs.writeFileSync(path.join(app, 'SyrianZone'), 'synthetic executable');
    const products = path.dirname(path.dirname(app));
    fs.writeFileSync(path.join(products, 'SyrianZoneVerification_iphonesimulator27.2-arm64.xctestrun'), 'synthetic configuration');
    if (options.account) {
      fs.mkdirSync(path.join(directory, '.expo/local-fixture'), { recursive: true });
      fs.writeFileSync(path.join(directory, '.expo/local-fixture/access.json'), JSON.stringify({ key: 'synthetic-access-key-owned-host-test-only' }), { mode: 0o600 });
    }
    const tool = `#!${process.execPath}
import fs from 'node:fs'; import path from 'node:path';
const command = path.basename(process.argv[1]), args = process.argv.slice(2), root = process.env.FAKE_ROOT;
const app = path.join(root, '.expo/full-site-native/Build/Products/Release-iphonesimulator/SyrianZone.app');
function note(step) { fs.appendFileSync(path.join(root, 'calls.jsonl'), JSON.stringify({ step })+'\\n'); }
if (command === 'xcodebuild') {
 const cleanup = args.some(value => value.endsWith('/testClearLocalFixtureState'));
 const build = args.includes('build-for-testing'); note(build ? 'build' : cleanup ? 'cleanup' : 'test');
 if (build && process.env.FAIL_BUILD === '1') { if (process.env.REMOVE_EXECUTABLE === '1') fs.unlinkSync(path.join(app,'SyrianZone')); process.exit(65); }
 if (!build && !cleanup && process.env.FAIL_TEST === '1') process.exit(65);
 if (cleanup && process.env.FAIL_CLEANUP === '1') process.exit(66);
 process.exit(0);
}
if (command === 'bunx') { note('embed'); fs.writeFileSync(path.join(root,'embed-flag.json'),JSON.stringify({value:process.env.EXPO_PUBLIC_NATIVE_INPUT_TRACE??null})); fs.writeFileSync(path.join(app,'main.jsbundle'),'FIXTURE BYTECODE'); process.exit(0); }
if (command === 'codesign') { note('sign'); if (process.env.TAMPER_RESTORE === '1' && fs.readFileSync(path.join(app,'main.jsbundle'),'utf8') === ${JSON.stringify(originalBundle)}) fs.writeFileSync(path.join(app,'main.jsbundle'),'CORRUPTED'); process.exit(0); }
if (command === 'python3') { note('private-config'); const config=JSON.parse(fs.readFileSync(0,'utf8')); fs.writeFileSync(path.join(root,'private-flag.json'),JSON.stringify({value:config.SZ_NATIVE_FIXTURE_INPUT_TRACE??null})); fs.writeFileSync(args.at(-1),'synthetic private configuration',{mode:0o600}); process.exit(0); }
if (command === 'xcrun') {
 if (args[0] === 'xcresulttool') {
  const cleanup = args.includes('--path') && args[args.indexOf('--path')+1].endsWith('cleanup.xcresult');
  const name = cleanup ? 'NativeAccountUITests/testClearLocalFixtureState()' : process.env.FAKE_SELECTION ? process.env.FAKE_SELECTION.replace('SyrianZoneUITests/','')+'()' : process.env.FAKE_ACCOUNT === '1' ? 'NativeAccountUITests/testHappy()' : 'NativeAdaptersUITests/testHappy()';
  console.log(JSON.stringify({testNodes:[{nodeType:'Test Case',nodeIdentifier:name,result:'Passed'}]})); process.exit(0);
 }
 if (args[0] === 'simctl' && args[1] === 'install') { note('install'); process.exit(fs.existsSync(path.join(app,'SyrianZone')) ? 0 : 71); }
 if (args[0] === 'simctl' && args[1] === 'launch') { note('launch'); if (process.env.FAIL_LAUNCH === '1') process.exit(72); console.log('zone.syrian.ios: 4321'); process.exit(0); }
 if (args[0] === 'simctl' && args[1] === 'spawn') { note('verify-process'); if (process.env.NO_PROCESS !== '1') console.log('4321 - UIKitApplication:zone.syrian.ios[synthetic]'); process.exit(0); }
}
process.exit(99);
`;
    for (const name of ['xcodebuild', 'bunx', 'codesign', 'xcrun', 'python3']) fs.writeFileSync(path.join(directory, 'tools', name), tool, { mode: 0o700 });
    const args = [path.join(directory, 'scripts/verify-native-adapters.mjs'), '--device', '00000000-0000-4000-8000-000000000001', '--team', 'TESTTEAM01', '--run', 'owned-run',
      '--fixture', options.account ? 'account' : 'adapters', '--only', options.selection ?? `SyrianZoneUITests/${options.account ? 'NativeAccountUITests' : 'NativeAdaptersUITests'}/testHappy`];
    if (options.trace) args.push('--input-trace');
    if (options.duplicateTrace) args.push('--input-trace');
    if (options.preserveStudio) args.push('--preserve-studio-pending');
    const result = spawnSync(process.execPath, args, { cwd: directory, env: { ...process.env, PATH: path.join(directory, 'tools'), FAKE_ROOT: directory, FAKE_ACCOUNT: options.account ? '1' : '0', FAKE_SELECTION:options.selection??'', EXPO_PUBLIC_NATIVE_INPUT_TRACE: '1',
      FAIL_BUILD: options.build ? '1' : '0', REMOVE_EXECUTABLE: options.removeExecutable ? '1' : '0', FAIL_TEST: options.test ? '1' : '0', FAIL_CLEANUP: options.cleanup ? '1' : '0',
      FAIL_LAUNCH: options.launch ? '1' : '0', NO_PROCESS: options.noProcess ? '1' : '0', TAMPER_RESTORE: options.tamper ? '1' : '0' }, encoding: 'utf8', timeout: 10_000 });
    const run = path.join(directory, '.expo/verification/owned-run'), statusFile = path.join(run, 'status.json');
    return { exitCode: result.status, stderr: result.stderr, status: fs.existsSync(statusFile) ? JSON.parse(fs.readFileSync(statusFile,'utf8')) : null,
      backup: fs.existsSync(path.join(run,'product-main.jsbundle')) ? fs.readFileSync(path.join(run,'product-main.jsbundle'),'utf8') : null,
      bundle: fs.readFileSync(path.join(app,'main.jsbundle'),'utf8'), calls: fs.existsSync(path.join(directory,'calls.jsonl')) ? fs.readFileSync(path.join(directory,'calls.jsonl'),'utf8').trim().split('\n').map(line => JSON.parse(line).step) : [],
      embedFlag:fs.existsSync(path.join(directory,'embed-flag.json'))?JSON.parse(fs.readFileSync(path.join(directory,'embed-flag.json'),'utf8')).value:null,
      privateFlag:fs.existsSync(path.join(directory,'private-flag.json'))?JSON.parse(fs.readFileSync(path.join(directory,'private-flag.json'),'utf8')).value:null,
      privateFiles: fs.readdirSync(products).filter(name => name.startsWith('.native-account-')) };
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

test('actual runner preserves the original build error and backup when restoration also fails', () => {
  const value = runRunner({ build: true, removeExecutable: true });
  assert.notEqual(value.exitCode, 0); assert.ok(value.status, 'A status must survive both failures');
  assert.match(value.status.failure, /xcodebuild failed with status 65/);
  assert.match(value.status.restorationFailure, /xcrun failed with status 71/);
  assert.equal(value.status.restoredProduct, false); assert.equal(value.status.productBackupRetained, true);
  assert.equal(value.backup, originalBundle); assert.match(value.stderr, /xcodebuild failed with status 65/);
});
test('successful restoration is verified and retires only the original bundle backup', () => {
  const value = runRunner(); assert.equal(value.exitCode, 0); assert.equal(value.status.passed, true);
  assert.equal(value.status.restoredProduct, true); assert.equal(value.status.restorationFailure, null);
  assert.equal(value.status.productBackupRetained, false); assert.equal(value.backup, null); assert.equal(value.bundle, originalBundle);
  assert.ok(value.calls.includes('verify-process'));
});
test('restoration failure alone fails the run and preserves its backup', () => {
  const value = runRunner({ launch: true }); assert.notEqual(value.exitCode, 0);
  assert.equal(value.status.restoredProduct, false); assert.match(value.status.restorationFailure, /status 72/); assert.equal(value.backup, originalBundle);
});
test('zero exit from launch does not claim restoration for an absent process or changed bundle', () => {
  for (const options of [{ noProcess: true }, { tamper: true }]) {
    const value = runRunner(options); assert.notEqual(value.exitCode, 0); assert.equal(value.status.restoredProduct, false);
    assert.ok(value.status.restorationFailure); assert.equal(value.backup, originalBundle);
  }
});
test('account success still performs exact cleanup and removes its private configuration', () => {
  const value = runRunner({ account: true }); assert.equal(value.exitCode, 0);
  assert.deepEqual(value.status.localCleanup, { attempted: true, passed: true, failure: null });
  assert.equal(value.calls.filter(step => step === 'cleanup').length, 1); assert.deepEqual(value.privateFiles, []);
});
test('main and account-cleanup failures retain their order while restoration still completes', () => {
  const value = runRunner({ account: true, test: true, cleanup: true }); assert.notEqual(value.exitCode, 0);
  assert.match(value.status.failure, /xcodebuild failed with status 65/); assert.match(value.status.localCleanup.failure, /status 66/);
  assert.equal(value.status.localCleanup.attempted, true); assert.equal(value.status.localCleanup.passed, false);
  assert.equal(value.status.restoredProduct, true); assert.equal(value.backup, null); assert.deepEqual(value.privateFiles, []);
});

const pollMethod='SyrianZoneUITests/NativePollsUITests/testOwnNativePollGroupsCandidatesBallotAndLeaderboard';
const studioMethod='SyrianZoneUITests/NativeTransitStudioUITests/testTwoSegmentsStopsUndoAndSameProcessDraftReopen';
test('ambient input trace is stripped by default without altering ordinary restoration',()=>{
 const value=runRunner({account:true}); assert.equal(value.exitCode,0); assert.equal(value.embedFlag,null); assert.equal(value.privateFlag,'0'); assert.equal(value.status.restoredProduct,true);
});
test('one exact Poll or preserved Studio diagnostic sets both explicit flags and retains cleanup',()=>{
 for(const [selection,preserveStudio] of [[pollMethod,false],[studioMethod,true]]) {
  const value=runRunner({account:true,trace:true,selection,preserveStudio}); assert.equal(value.exitCode,0,value.stderr);
  assert.equal(value.embedFlag,'1'); assert.equal(value.privateFlag,'1'); assert.equal(value.status.restoredProduct,true); assert.equal(value.status.localCleanup.passed,true);
 }
});
test('wrong diagnostic fixture, selectors, duplicate flags and missing Studio preservation refuse before runner side effects',()=>{
 for(const options of [{trace:true},{account:true,trace:true},{account:true,trace:true,selection:pollMethod.replace('/testOwnNativePollGroupsCandidatesBallotAndLeaderboard','')},
  {account:true,trace:true,selection:studioMethod},{account:true,trace:true,duplicateTrace:true,selection:pollMethod}]) {
  const value=runRunner(options); assert.notEqual(value.exitCode,0); assert.equal(value.status,null); assert.deepEqual(value.calls,[]); assert.equal(value.bundle,originalBundle);
 }
});
