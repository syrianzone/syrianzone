import { spawnSync } from 'node:child_process';
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
  const result = spawn('expo', releaseArguments(platform, device), {
    env: verifiedEnvironment,
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
