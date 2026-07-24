import { spawnSync } from 'node:child_process';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function nodeMajor(version) {
  const match = /^(\d+)\./.exec(version);
  return match ? Number(match[1]) : null;
}

export function javaMajor(output) {
  const match = /version "(?:1\.)?(\d+)(?:[._]|\")/.exec(output);
  return match ? Number(match[1]) : null;
}

export function requiredDeviceEnvironment(platform) {
  if (platform === 'ios') {
    return 'MAESTRO_IOS_DEVICE_ID';
  }
  if (platform === 'android') {
    return 'MAESTRO_ANDROID_DEVICE_ID';
  }
  throw new Error('Platform must be ios or android.');
}

export function requiredDevice(platform, environment = process.env) {
  const name = requiredDeviceEnvironment(platform);
  const device = environment[name]?.trim();
  if (!device) {
    throw new Error(`${name} must identify the simulator or emulator under test.`);
  }
  return device;
}

export function javaEnvironment(environment = process.env) {
  const javaHome = environment.JAVA_HOME?.trim();
  if (!javaHome) {
    throw new Error('JAVA_HOME must identify a JDK 17 installation.');
  }
  const javaBin = join(javaHome, 'bin');
  const currentPath = environment.PATH?.trim();
  return {
    ...environment,
    JAVA_HOME: javaHome,
    PATH: currentPath ? `${javaBin}${delimiter}${currentPath}` : javaBin,
  };
}

function verifyNode(nodeVersion) {
  if (nodeMajor(nodeVersion) !== 24) {
    throw new Error(`Release builds require Node 24, found ${nodeVersion}.`);
  }
}

function verifyJava(environment, spawn) {
  const prepared = javaEnvironment(environment);
  const java = spawn('java', ['-version'], {
    encoding: 'utf8',
    env: prepared,
  });
  const output = `${java.stdout ?? ''}\n${java.stderr ?? ''}`;
  if (java.status !== 0 || javaMajor(output) !== 17) {
    throw new Error('Native release smoke requires JDK 17.');
  }
  return prepared;
}

export function verifyReleaseToolchain(
  platform,
  {
    environment = process.env,
    nodeVersion = process.versions.node,
    spawn = spawnSync,
  } = {},
) {
  requiredDeviceEnvironment(platform);
  verifyNode(nodeVersion);
  if (platform === 'android') {
    return verifyJava(environment, spawn);
  }
  return environment;
}

export function verifyMaestroToolchain(
  platform,
  {
    environment = process.env,
    nodeVersion = process.versions.node,
    spawn = spawnSync,
  } = {},
) {
  requiredDeviceEnvironment(platform);
  verifyNode(nodeVersion);
  return verifyJava(environment, spawn);
}

function main() {
  try {
    verifyReleaseToolchain(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
