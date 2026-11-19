import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const minimumVersion = [27, 1];
const defaultDeviceName = 'iPhone 17';

/** @typedef {{name: string, identifier: string, minRuntimeVersionString?: string, maxRuntimeVersionString?: string}} DeviceProfile */
/** @typedef {{identifier: string, name: string, version: string, isAvailable: boolean, supportedDeviceTypes?: Array<{identifier: string}>}} Runtime */
/** @typedef {{udid: string, deviceTypeIdentifier: string, isAvailable: boolean, state: string}} SimulatorDevice */
/** @typedef {{devicetypes: DeviceProfile[], runtimes: Runtime[], devices: Record<string, SimulatorDevice[]>}} Inventory */

const versionParts = value => value.split('.').map(part => Number.parseInt(part, 10) || 0);
const compareVersions = (first, second) => {
  const a = versionParts(first);
  const b = versionParts(second);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta) return delta;
  }
  return 0;
};

/** @param {string} version @returns {void} */
export function assertSdkSupport(version) {
  if (compareVersions(version, minimumVersion.join('.')) < 0) throw new Error('iOS SDK 27.1 or later is required for native iPhone Duo geometry. Update Xcode before building.');
}

/** @param {string} output @param {(message: string) => void} warn @returns {void} */
export function reportBootStatus(output, warn = message => process.stderr.write(`${message}\n`)) {
  if (/\b(?:data migration|boot)\s+failed\b/i.test(output)) {
    warn('The simulator reported a data migration warning. Continuing to verify that the actual app starts and stays running.');
  }
}

/**
 * @param {Inventory} inventory
 * @param {string} deviceName
 * @returns {{type: DeviceProfile, runtime: Runtime, device: SimulatorDevice | undefined}}
 */
export function selectSimulator(inventory, deviceName = defaultDeviceName) {
  const type = inventory.devicetypes.find(candidate => candidate.name === deviceName);
  if (!type) throw new Error(`${deviceName} is missing from Xcode's device profiles. Open Xcode and finish installing iOS platform support.`);
  const profileMinimum = type.minRuntimeVersionString ?? '0';
  const requiredVersion = compareVersions(profileMinimum, minimumVersion.join('.')) > 0 ? profileMinimum : minimumVersion.join('.');
  const runtime = inventory.runtimes
    .filter(candidate => candidate.name.startsWith('iOS ') && candidate.isAvailable
      && compareVersions(candidate.version, requiredVersion) >= 0
      && compareVersions(candidate.version, type.maxRuntimeVersionString ?? '65535') <= 0
      && (!candidate.supportedDeviceTypes || candidate.supportedDeviceTypes.some(profile => profile.identifier === type.identifier)))
    .sort((first, second) => compareVersions(second.version, first.version))[0];
  if (!runtime) throw new Error(`An available iOS ${requiredVersion} or later compatible simulator runtime is required for ${deviceName}. Run bun run ios --download to install current iOS support.`);
  const device = (inventory.devices[runtime.identifier] ?? []).find(candidate => candidate.isAvailable && candidate.deviceTypeIdentifier === type.identifier);
  return { type, runtime, device };
}

function run(command, args, capture = false) {
  const result = spawnSync(command, args, { cwd: packageRoot, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error) throw new Error(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed.${capture ? `\n${result.stderr || result.stdout}` : ''}`);
  return result.stdout?.trim() ?? '';
}

function main() {
  if (process.platform !== 'darwin') throw new Error('The iOS simulator requires a Mac with Xcode installed.');
  const args = process.argv.slice(2).filter(arg => arg !== '--');
  let deviceName = defaultDeviceName;
  let prepare = false;
  let download = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--prepare') prepare = true;
    else if (argument === '--download') download = true;
    else if (argument === '--device' && args[index + 1]) deviceName = args[++index];
    else throw new Error(`Unknown or incomplete option: ${argument}. Use --prepare, --download, or --device "exact device profile name".`);
  }
  const setup = spawnSync('xcodebuild', ['-checkFirstLaunchStatus'], { encoding: 'utf8' });
  if (setup.error || setup.status !== 0) {
    throw new Error('Xcode setup is incomplete. Open Xcode, review and accept its license, and install its required components. This command never accepts terms for you.');
  }
  assertSdkSupport(run('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-version'], true));
  if (download) run('xcodebuild', ['-downloadPlatform', 'iOS']);
  run('bunx', ['--no-install', 'expo', 'prebuild', '--platform', 'ios', '--no-install']);
  if (prepare) return;
  const inventory = JSON.parse(run('xcrun', ['simctl', 'list', '--json'], true));
  const { type, runtime, device } = selectSimulator(inventory, deviceName);
  const udid = device?.udid ?? run('xcrun', ['simctl', 'create', `Syrian Zone ${deviceName}`, type.identifier, runtime.identifier], true);
  if (device?.state !== 'Booted') run('xcrun', ['simctl', 'boot', udid]);
  process.stdout.write(`Waiting for ${deviceName} to finish startup.\n`);
  const bootOutput = run('xcrun', ['simctl', 'bootstatus', udid, '-b'], true);
  process.stdout.write(`${bootOutput}\n`);
  reportBootStatus(bootOutput);
  const developerDirectory = run('xcode-select', ['-p'], true);
  const deviceHub = join(developerDirectory, '..', 'Applications', 'DeviceHub.app');
  const simulator = join(developerDirectory, 'Applications', 'Simulator.app');
  if (existsSync(deviceHub)) run('open', [deviceHub]);
  else if (existsSync(simulator)) run('open', [simulator, '--args', '-CurrentDeviceUDID', udid]);
  run('bunx', ['--no-install', 'expo', 'run:ios', '--configuration', 'Release', '--no-bundler', '--device', udid]);
  run('node', [join(packageRoot, 'scripts', 'smoke-ios.mjs'), '--device', udid, '--installed', '--bundle', 'zone.syrian.ios']);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
