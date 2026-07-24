import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  requiredDevice,
  verifyReleaseToolchain,
} from './verify-release-toolchain.mjs';

function releaseArguments(platform, device) {
  if (platform === 'ios') {
    return [
      'run:ios',
      '--configuration',
      'Release',
      '--no-bundler',
      '--device',
      device,
    ];
  }
  if (platform === 'android') {
    return [
      'run:android',
      '--variant',
      'release',
      '--no-bundler',
      '--device',
      device,
    ];
  }
  throw new Error('Platform must be ios or android.');
}

function androidAdb(environment) {
  const configuredRoot =
    environment.ANDROID_HOME?.trim() || environment.ANDROID_SDK_ROOT?.trim();
  const defaultRoots = {
    darwin: [join(homedir(), 'Library', 'Android', 'sdk')],
    linux: [
      join(homedir(), 'Android', 'Sdk'),
      join(homedir(), 'Android', 'sdk'),
    ],
    win32: [join(homedir(), 'AppData', 'Local', 'Android', 'Sdk')],
  };
  const root =
    configuredRoot ??
    defaultRoots[process.platform]?.find((candidate) => existsSync(candidate));
  const executable = process.platform === 'win32' ? 'adb.exe' : 'adb';
  return {
    executable: root ? join(root, 'platform-tools', executable) : executable,
    root,
  };
}

function adbOutput(adb, arguments_, environment, spawn) {
  const result = spawn(adb, arguments_, {
    encoding: 'utf8',
    env: environment,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const detail = result.stderr?.trim();
    throw new Error(detail || `adb ${arguments_.join(' ')} failed.`);
  }
  return result.stdout ?? '';
}

function attachedAndroidDevices(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('List of devices attached'))
    .map((line) => {
      const [identifier, state] = line.split(/\s+/);
      return { identifier, line, state };
    });
}

function androidDeviceName(device, adb, environment, spawn) {
  if (device.identifier.startsWith('emulator-')) {
    const output = adbOutput(
      adb,
      ['-s', device.identifier, 'emu', 'avd', 'name'],
      environment,
      spawn,
    );
    const name = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && line !== 'OK');
    if (!name) {
      throw new Error(`Could not resolve AVD name for ${device.identifier}.`);
    }
    return name;
  }

  const model = /(?:^|\s)model:([^\s]+)/.exec(device.line)?.[1];
  return model || `Device ${device.identifier}`;
}

function resolveAndroidDevice(identifier, environment, spawn) {
  const sdk = androidAdb(environment);
  const androidEnvironment = sdk.root
    ? {
        ...environment,
        ANDROID_HOME: sdk.root,
        ANDROID_SDK_ROOT: sdk.root,
      }
    : environment;
  const adb = sdk.executable;
  const devices = attachedAndroidDevices(
    adbOutput(adb, ['devices', '-l'], androidEnvironment, spawn),
  );
  const selected = devices.filter(
    (device) => device.identifier === identifier,
  );
  if (selected.length !== 1 || selected[0].state !== 'device') {
    throw new Error(
      `MAESTRO_ANDROID_DEVICE_ID must identify one connected, authorized device or emulator: ${identifier}.`,
    );
  }

  const connected = devices.filter((device) => device.state === 'device');
  const named = connected.map((device) => ({
    ...device,
    name: androidDeviceName(device, adb, androidEnvironment, spawn),
  }));
  const selectedName = named.find(
    (device) => device.identifier === identifier,
  ).name;
  if (named.filter((device) => device.name === selectedName).length !== 1) {
    throw new Error(
      `Expo device name ${selectedName} does not uniquely identify ${identifier}.`,
    );
  }

  return {
    environment: { ...androidEnvironment, ANDROID_SERIAL: identifier },
    name: selectedName,
  };
}

export function runRelease(
  platform,
  {
    environment = process.env,
    nodeVersion = process.versions.node,
    spawn = spawnSync,
  } = {},
) {
  const device = requiredDevice(platform, environment);
  const verifiedEnvironment = verifyReleaseToolchain(platform, {
    environment,
    nodeVersion,
    spawn,
  });
  const selected =
    platform === 'android'
      ? resolveAndroidDevice(device, verifiedEnvironment, spawn)
      : { environment: verifiedEnvironment, name: device };
  const result = spawn('expo', releaseArguments(platform, selected.name), {
    env: selected.environment,
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

function main() {
  try {
    process.exitCode = runRelease(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
