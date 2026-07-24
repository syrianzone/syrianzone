import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  requiredDevice,
  verifyMaestroToolchain,
} from './verify-release-toolchain.mjs';

export function runMaestro(
  platform,
  {
    environment = process.env,
    nodeVersion = process.versions.node,
    spawn = spawnSync,
  } = {},
) {
  const device = requiredDevice(platform, environment);
  const verifiedEnvironment = verifyMaestroToolchain(platform, {
    environment,
    nodeVersion,
    spawn,
  });
  const result = spawn(
    'maestro',
    ['--device', device, 'test', `.maestro/${platform}.yaml`],
    {
      env: verifiedEnvironment,
      stdio: 'inherit',
    },
  );
  if (result.error) {
    throw result.error;
  }
  return result.status ?? 1;
}

function main() {
  try {
    process.exitCode = runMaestro(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
