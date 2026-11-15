import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, openSync, closeSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { studioPreservationMode } from './studio-runner-policy.mjs';
import { alignmentPreservationMode } from '../native-tests/alignment/alignment-runner-policy.mjs';
import { prayerPreservationMode } from '../native-tests/prayer-sync/prayer-runner-policy.mjs';
import { assertPrayerJournalProtocol } from '../native-tests/prayer-sync/prayer-journal-protocol.mjs';
import { assertSelectedTestsPassed } from './native-test-results.mjs';
import { isAppRunning } from './smoke-ios.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
const device = value('--device');
const tag = value('--run');
const team = value('--team');
const fixture = value('--fixture') ?? 'adapters';
const publicQuran = args.includes('--public-quran');
const selections = args.flatMap((argument, index) => argument === '--only' ? [args[index + 1]] : []);
const only = selections.length ? selections : [`SyrianZoneUITests/${fixture === 'account' ? 'NativeAccountUITests' : 'NativeAdaptersUITests'}`];
if (!device || !/^[0-9A-F-]{36}$/i.test(device) || !tag || !/^[a-zA-Z0-9_-]{1,80}$/.test(tag) || !team || !/^[A-Z0-9]{10}$/.test(team) || !['adapters', 'account'].includes(fixture) || publicQuran && fixture !== 'account' || !only.every(selection => typeof selection === 'string' && /^[a-zA-Z0-9_/]+$/.test(selection))) {
  throw new Error('Pass --device UUID --team AppleTeamID --run unique-name, optional --fixture adapters|account, --public-quran for account only, and repeated --only target/class/test.');
}
const preserveStudioPending = studioPreservationMode(args, fixture, selections);
const preservePrayerState = prayerPreservationMode(args, fixture, selections);
const preserveAlignmentDocument = alignmentPreservationMode(args, fixture, selections);
const inputTrace = args.includes('--input-trace');
const inputTraceMethods = ['SyrianZoneUITests/NativePollsUITests/testOwnNativePollGroupsCandidatesBallotAndLeaderboard',
  'SyrianZoneUITests/NativeTransitStudioUITests/testTwoSegmentsStopsUndoAndSameProcessDraftReopen'];
if (inputTrace && (args.filter(argument => argument === '--input-trace').length !== 1 || fixture !== 'account' || selections.length !== 1
  || !inputTraceMethods.includes(selections[0]) || publicQuran || preservePrayerState)) throw new Error('Input trace requires one exact account Poll or preserved Studio method.');
if (preservePrayerState) await assertPrayerJournalProtocol(root);
const directory = join(root, '.expo', 'verification', tag);
if (existsSync(directory)) throw new Error('Use a new verification run name.');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const app = join(root, '.expo/full-site-native/Build/Products/Release-iphonesimulator/SyrianZone.app');
const bundle = join(app, 'main.jsbundle');
const backup = join(directory, 'product-main.jsbundle');
if (!existsSync(bundle)) throw new Error('Build and bundle the product application first.');
copyFileSync(bundle, backup);
function run(command, options, log, env = process.env) {
  const descriptor = log ? openSync(join(directory, log), 'w', 0o600) : undefined;
  try {
    const result = spawnSync(command, options, { cwd: root, env, encoding: 'utf8', stdio: descriptor === undefined ? 'inherit' : ['ignore', descriptor, descriptor] });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}; see ${log ?? 'output'}.`);
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
}
const signing = ['CODE_SIGNING_ALLOWED=YES', 'CODE_SIGN_IDENTITY=-', `DEVELOPMENT_TEAM=${team}`, 'SKIP_BUNDLING=1', 'ONLY_ACTIVE_ARCH=YES', 'ARCHS=arm64'];
const testTimeouts = ['-test-timeouts-enabled', 'YES', '-default-test-execution-time-allowance', '900', '-maximum-test-execution-time-allowance', '1200'];
const xcode = ['-quiet', '-jobs', '2', '-workspace', 'ios/SyrianZone.xcworkspace', '-scheme', 'SyrianZoneVerification', '-configuration', 'Release',
  '-sdk', 'iphonesimulator', '-destination', `id=${device}`, '-derivedDataPath', '.expo/full-site-native'];
const fixtureOrigin = 'https://127.0.0.1:9443';
const fixtureEnvironment = { ...process.env, EXPO_PUBLIC_API_ORIGIN: fixture === 'account' ? fixtureOrigin : 'https://syrian.zone' };
delete fixtureEnvironment.EXPO_PUBLIC_NATIVE_PRESERVE_ALIGNMENT_DOCUMENT;
if (preserveAlignmentDocument) fixtureEnvironment.EXPO_PUBLIC_NATIVE_PRESERVE_ALIGNMENT_DOCUMENT = '1';
delete fixtureEnvironment.EXPO_PUBLIC_NATIVE_PRESERVE_PRAYER_STATE;
if (preservePrayerState) fixtureEnvironment.EXPO_PUBLIC_NATIVE_PRESERVE_PRAYER_STATE = '1';
delete fixtureEnvironment.EXPO_PUBLIC_NATIVE_PRESERVE_STUDIO_PENDING;
if (preserveStudioPending) fixtureEnvironment.EXPO_PUBLIC_NATIVE_PRESERVE_STUDIO_PENDING = '1';
delete fixtureEnvironment.EXPO_PUBLIC_NATIVE_QURAN_READS;
if (fixture === 'account') fixtureEnvironment.EXPO_PUBLIC_NATIVE_QURAN_READS = publicQuran ? '1' : '0';
delete fixtureEnvironment.EXPO_PUBLIC_NATIVE_INPUT_TRACE;
if (inputTrace) fixtureEnvironment.EXPO_PUBLIC_NATIVE_INPUT_TRACE = '1';
let privateTestRun;
function accountTestRun() {
  const products = join(root, '.expo/full-site-native/Build/Products');
  const runs = readdirSync(products).filter(name => /^SyrianZoneVerification_iphonesimulator.*\.xctestrun$/.test(name));
  if (runs.length !== 1) throw new Error('Expected one native simulator test configuration.');
  const gate = JSON.parse(readFileSync(join(root, '.expo/local-fixture/access.json'), 'utf8')).key;
  if (typeof gate !== 'string' || gate.length < 16 || gate.length > 256) throw new Error('Local fixture access configuration is invalid.');
  const environment = { SZ_NATIVE_FIXTURE_GATE: gate, SZ_NATIVE_FIXTURE_ORIGIN: fixtureOrigin, SZ_NATIVE_FIXTURE_PUBLIC_QURAN: publicQuran ? '1' : '0', SZ_NATIVE_FIXTURE_PRESERVE_STUDIO_PENDING: preserveStudioPending ? '1' : '0', SZ_NATIVE_FIXTURE_PRESERVE_PRAYER_STATE: preservePrayerState ? '1' : '0', SZ_NATIVE_FIXTURE_PRESERVE_ALIGNMENT_DOCUMENT: preserveAlignmentDocument ? '1' : '0', SZ_NATIVE_FIXTURE_INPUT_TRACE: inputTrace ? '1' : '0' };
  const loginPath = join(root, '.expo/local-fixture/login.json');
  if (existsSync(loginPath)) {
    const login = JSON.parse(readFileSync(loginPath, 'utf8'));
    if (typeof login.email !== 'string' || !/^[^\s@]+@native-fixture\.invalid$/.test(login.email) || typeof login.password !== 'string' || !/^[\x21-\x7e]{16,256}$/.test(login.password)) throw new Error('Synthetic local fixture login configuration is invalid.');
    environment.SZ_NATIVE_FIXTURE_ADMIN_EMAIL = login.email;
    environment.SZ_NATIVE_FIXTURE_ADMIN_PASSWORD = login.password;
  }
  privateTestRun = join(products, `.native-account-${tag}.xctestrun`);
  const result = spawnSync('python3', ['-c', [
    'import json, os, plistlib, sys',
    'values = json.load(sys.stdin)',
    'with open(sys.argv[1], "rb") as source: config = plistlib.load(source)',
    'target = config["SyrianZoneUITests"]',
    'target.setdefault("EnvironmentVariables", {}).update(values)',
    'with os.fdopen(os.open(sys.argv[2], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as output: plistlib.dump(config, output)',
  ].join('\n'), join(products, runs[0]), privateTestRun], {
    input: JSON.stringify(environment), encoding: 'utf8',
  });
  if (result.error || result.status !== 0) throw new Error('Could not prepare private local-account test configuration.');
  return ['-quiet', '-jobs', '2', '-xctestrun', privateTestRun, '-destination', `id=${device}`];
}
function assertExecuted(selections, resultPath) {
  const result = spawnSync('xcrun', ['xcresulttool', 'get', 'test-results', 'tests', '--path', resultPath, '--format', 'json'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error('Could not verify the executed native test selection.');
  assertSelectedTestsPassed(selections, JSON.parse(result.stdout));
}
let failure;
let cleanupFailure;
let cleanupAttempted = false;
let restorationFailure;
let restoredProduct = false;
let backupCleanupFailure;
try {
  run('xcodebuild', [...xcode, ...signing, 'build-for-testing'], 'build.log');
  run('bunx', ['expo', 'export:embed', '--entry-file', `native-tests/${fixture === 'account' ? 'account' : 'adapter'}-fixture.tsx`, '--platform', 'ios', '--dev', 'false', '--max-workers', '2',
    '--bytecode', '--bundle-output', bundle, '--assets-dest', app], 'embed.log', fixtureEnvironment);
  run('codesign', ['--force', '--sign', '-', '--preserve-metadata=entitlements', app], 'sign.log');
  const testArguments = fixture === 'account' ? accountTestRun() : xcode;
  const resultStream = join(directory, 'result-stream.jsonl');
  writeFileSync(resultStream, '', { mode: 0o600, flag: 'wx' });
  run('xcodebuild', [...testArguments, ...testTimeouts, '-parallel-testing-enabled', 'NO', '-resultBundlePath', join(directory, 'result.xcresult'),
    '-resultStreamPath', resultStream, ...only.map(selection => `-only-testing:${selection}`), ...signing, 'test-without-building'], 'test.log');
  assertExecuted(only, join(directory, 'result.xcresult'));
} catch (error) {
  failure = error;
} finally {
  if (fixture === 'account' && privateTestRun && existsSync(privateTestRun)) {
    cleanupAttempted = true;
    const cleanup = 'SyrianZoneUITests/NativeAccountUITests/testClearLocalFixtureState';
    try {
      run('xcodebuild', ['-quiet', '-jobs', '2', '-xctestrun', privateTestRun, '-destination', `id=${device}`, ...testTimeouts, '-parallel-testing-enabled', 'NO',
        '-resultBundlePath', join(directory, 'cleanup.xcresult'), `-only-testing:${cleanup}`, 'test-without-building'], 'cleanup.log');
      assertExecuted([cleanup], join(directory, 'cleanup.xcresult'));
    } catch (error) { cleanupFailure = error; failure ??= error; }
  }
  try {
    if (privateTestRun && existsSync(privateTestRun)) unlinkSync(privateTestRun);
  } catch (error) { cleanupFailure ??= error; failure ??= error; }
  try {
    copyFileSync(backup, bundle);
    run('codesign', ['--force', '--sign', '-', '--preserve-metadata=entitlements', app], 'restore-sign.log');
    if (!readFileSync(bundle).equals(readFileSync(backup))) throw new Error('The restored product bundle does not match its backup.');
    run('xcrun', ['simctl', 'install', device, app], 'restore-install.log');
    run('xcrun', ['simctl', 'launch', '--terminate-running-process', device, 'zone.syrian.ios'], 'restore-launch.log');
    const launched = readFileSync(join(directory, 'restore-launch.log'), 'utf8');
    const pid = Number(launched.split('\n').find(line => line.startsWith('zone.syrian.ios:'))?.split(':').at(-1)?.trim());
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Could not verify the restored product launch PID.');
    run('xcrun', ['simctl', 'spawn', device, 'launchctl', 'list'], 'restore-process.log');
    if (!isAppRunning(readFileSync(join(directory, 'restore-process.log'), 'utf8'), pid, 'zone.syrian.ios')) throw new Error('The restored product process is not running.');
    restoredProduct = true;
  } catch (error) { restorationFailure = error; failure ??= error; }
  if (restoredProduct) {
    try { unlinkSync(backup); }
    catch (error) { backupCleanupFailure = error; failure ??= error; }
  }
}
writeFileSync(join(directory, 'status.json'), JSON.stringify({ passed: !failure, preservedAlignmentDocument: preserveAlignmentDocument, preservedStudioPending: preserveStudioPending, preservedPrayerState: preservePrayerState, restoredProduct, failure: failure?.message ?? null,
  restorationFailure: restorationFailure?.message ?? null, productBackupRetained: existsSync(backup), backupCleanupFailure: backupCleanupFailure?.message ?? null,
  localCleanup: fixture === 'account' ? { attempted: cleanupAttempted, passed: cleanupAttempted && !cleanupFailure, failure: cleanupFailure?.message ?? null } : null }, null, 2), { mode: 0o600 });
console.log(readFileSync(join(directory, 'status.json'), 'utf8'));
if (failure) throw failure;
