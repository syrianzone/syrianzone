import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  javaEnvironment,
  javaMajor,
  nodeMajor,
  requiredDevice,
  requiredDeviceEnvironment,
  verifyMaestroToolchain,
} from './verify-release-toolchain.mjs';
import { runMaestro } from './run-maestro.mjs';
import { runRelease } from './run-release.mjs';

test('reads supported Node and Java major versions', () => {
  assert.equal(nodeMajor('24.18.0'), 24);
  assert.equal(nodeMajor('invalid'), null);
  assert.equal(javaMajor('openjdk version "17.0.16" 2025-07-15'), 17);
  assert.equal(javaMajor('java version "1.8.0_402"'), 8);
  assert.equal(javaMajor('missing'), null);
});

test('selects the required Maestro device environment', () => {
  assert.equal(requiredDeviceEnvironment('ios'), 'MAESTRO_IOS_DEVICE_ID');
  assert.equal(requiredDeviceEnvironment('android'), 'MAESTRO_ANDROID_DEVICE_ID');
  assert.throws(() => requiredDeviceEnvironment('web'), /ios or android/);
});

test('requires an exact platform device identifier', () => {
  assert.equal(
    requiredDevice('ios', { MAESTRO_IOS_DEVICE_ID: '  ios-device  ' }),
    'ios-device',
  );
  assert.throws(
    () => requiredDevice('android', { MAESTRO_ANDROID_DEVICE_ID: ' ' }),
    /MAESTRO_ANDROID_DEVICE_ID/,
  );
});

test('puts JAVA_HOME first on PATH', () => {
  assert.deepEqual(
    javaEnvironment({ JAVA_HOME: '/jdk-17', PATH: '/usr/bin' }),
    {
      JAVA_HOME: '/jdk-17',
      PATH: `/jdk-17/bin${process.platform === 'win32' ? ';' : ':'}/usr/bin`,
    },
  );
  assert.throws(() => javaEnvironment({ PATH: '/usr/bin' }), /JAVA_HOME/);
});

for (const platform of ['ios', 'android']) {
  test(`requires JDK 17 before Maestro runs on ${platform}`, () => {
    assert.throws(
      () =>
        verifyMaestroToolchain(platform, {
          environment: { JAVA_HOME: '/jdk', PATH: '/usr/bin' },
          nodeVersion: '24.18.0',
          spawn: () => ({
            status: 0,
            stderr: 'openjdk version "21.0.8"',
            stdout: '',
          }),
        }),
      /JDK 17/,
    );
  });
}

for (const [platform, device, expectedArguments] of [
  [
    'ios',
    'ios-device',
    ['run:ios', '--configuration', 'Release', '--no-bundler', '--device', 'ios-device'],
  ],
  [
    'android',
    'emulator-5554',
    ['run:android', '--variant', 'release', '--no-bundler', '--device', 'syrianzone_api36'],
  ],
]) {
  test(`installs the ${platform} Release build on the selected device`, () => {
    const calls = [];
    const environment = {
      ANDROID_HOME: '/android-sdk',
      ANDROID_SDK_ROOT: '/stale-android-sdk',
      JAVA_HOME: '/jdk-17',
      MAESTRO_ANDROID_DEVICE_ID: 'emulator-5554',
      MAESTRO_IOS_DEVICE_ID: 'ios-device',
      PATH: '/usr/bin',
    };
    const status = runRelease(platform, {
      environment,
      nodeVersion: '24.18.0',
      spawn: (command, arguments_, options) => {
        calls.push({ arguments: arguments_, command, options });
        if (command === 'java') {
          return {
            status: 0,
            stderr: 'openjdk version "17.0.19"',
            stdout: '',
          };
        }
        if (command === '/android-sdk/platform-tools/adb') {
          if (arguments_[0] === 'devices') {
            assert.deepEqual(arguments_, ['devices', '-l']);
            return {
              status: 0,
              stderr: '',
              stdout:
                'List of devices attached\n' +
                'emulator-5554 device product:sdk model:sdk_gphone64_arm64\n',
            };
          }
          assert.deepEqual(arguments_, ['-s', 'emulator-5554', 'emu', 'avd', 'name']);
          return {
            status: 0,
            stderr: '',
            stdout: 'syrianzone_api36\nOK\n',
          };
        }
        return { status: 0 };
      },
    });

    assert.equal(status, 0);
    const release = calls.at(-1);
    assert.equal(release.command, 'expo');
    assert.deepEqual(release.arguments, expectedArguments);
    if (platform === 'ios') {
      assert.equal(release.arguments.at(-1), device);
    } else {
      assert.equal(release.options.env.ANDROID_SERIAL, device);
      assert.equal(release.options.env.ANDROID_HOME, '/android-sdk');
      assert.equal(release.options.env.ANDROID_SDK_ROOT, '/android-sdk');
    }
  });
}

test('rejects an Android identifier that is not connected and authorized', () => {
  assert.throws(
    () =>
      runRelease('android', {
        environment: {
          ANDROID_HOME: '/android-sdk',
          JAVA_HOME: '/jdk-17',
          MAESTRO_ANDROID_DEVICE_ID: 'emulator-5554',
          PATH: '/usr/bin',
        },
        nodeVersion: '24.18.0',
        spawn: (command) => {
          if (command === 'java') {
            return {
              status: 0,
              stderr: 'openjdk version "17.0.19"',
              stdout: '',
            };
          }
          return {
            status: 0,
            stderr: '',
            stdout:
              'List of devices attached\n' +
              'emulator-5554 offline product:sdk model:sdk_gphone64_arm64\n',
          };
        },
      }),
    /connected, authorized device or emulator/,
  );
});

test('rejects duplicate Expo names before installing an Android build', () => {
  assert.throws(
    () =>
      runRelease('android', {
        environment: {
          ANDROID_HOME: '/android-sdk',
          JAVA_HOME: '/jdk-17',
          MAESTRO_ANDROID_DEVICE_ID: 'emulator-5554',
          PATH: '/usr/bin',
        },
        nodeVersion: '24.18.0',
        spawn: (command, arguments_) => {
          if (command === 'java') {
            return {
              status: 0,
              stderr: 'openjdk version "17.0.19"',
              stdout: '',
            };
          }
          if (arguments_[0] === 'devices') {
            return {
              status: 0,
              stderr: '',
              stdout:
                'List of devices attached\n' +
                'emulator-5554 device product:sdk model:sdk_gphone64_arm64\n' +
                'emulator-5556 device product:sdk model:sdk_gphone64_arm64\n',
            };
          }
          return {
            status: 0,
            stderr: '',
            stdout: 'syrianzone_api36\nOK\n',
          };
        },
      }),
    /does not uniquely identify emulator-5554/,
  );
});

test('runs Maestro on the same device with JAVA_HOME on PATH', () => {
  const calls = [];
  const status = runMaestro('ios', {
    environment: {
      JAVA_HOME: '/jdk-17',
      MAESTRO_IOS_DEVICE_ID: 'ios-device',
      PATH: '/usr/bin',
    },
    nodeVersion: '24.18.0',
    spawn: (command, arguments_, options) => {
      calls.push({ arguments: arguments_, command, options });
      if (command === 'java') {
        return {
          status: 0,
          stderr: 'openjdk version "17.0.19"',
          stdout: '',
        };
      }
      return { status: 0 };
    },
  });

  assert.equal(status, 0);
  assert.deepEqual(calls.at(-1).arguments, [
    '--device',
    'ios-device',
    'test',
    '.maestro/ios.yaml',
  ]);
  assert.equal(calls.at(-1).options.env.PATH, `/jdk-17/bin${process.platform === 'win32' ? ';' : ':'}/usr/bin`);
});

test('keeps release smoke coverage for native route surfaces', () => {
  const directory = resolve(import.meta.dirname, '../.maestro');
  const smoke = readFileSync(resolve(directory, 'smoke.yaml'), 'utf8');
  const flows = readdirSync(directory)
    .filter((file) => file.endsWith('.yaml'))
    .map((file) => readFileSync(resolve(directory, file), 'utf8'))
    .join('\n');
  const requiredLinks = [
    'syrianzone://account',
    'syrianzone://settings',
    'syrianzone://board',
    'syrianzone://about',
    'syrianzone://admin/govapps',
    'syrianzone://admin/phonebook',
    'syrianzone://admin/places',
    'syrianzone://admin/syofficial',
    'syrianzone://admin/users',
    'syrianzone://auth/callback?error=access_denied&state=maestro',
    'syrianzone://transit',
    'syrianzone://transit/admin',
    'syrianzone://transit/studio',
    'syrianzone://transit/city/damascus',
    'syrianzone://transit/city/damascus/map',
    'syrianzone://transit/city/damascus/route/maestro-missing-route',
  ];

  for (const link of requiredLinks) {
    assert.ok(flows.includes(`openLink: "${link}"`), `Missing Maestro link: ${link}`);
  }
  for (const flow of [
    'admin-guest.yaml',
    'auth-callback-failure.yaml',
    'transit-native.yaml',
  ]) {
    assert.ok(smoke.includes(`runFlow: ${flow}`), `Smoke does not run ${flow}`);
  }
  assert.match(
    smoke,
    /visible: "أفضل المساهمين السوريين في GitHub"/u,
    'Contributors smoke must match the rendered page title.',
  );
  assert.match(
    flows,
    /visible: "سجل الدخول للوصول إلى إدارة المسارات\."/u,
    'Transit admin smoke must match the rendered guest message.',
  );
  assert.match(
    flows,
    /platform: iOS[\s\S]*?location: never/u,
    'iOS Transit smoke must use the granular never location value.',
  );
  assert.match(
    flows,
    /platform: Android[\s\S]*?location: deny/u,
    'Android Transit smoke must deny location with its platform value.',
  );
  assert.match(
    flows,
    /platform: Android[\s\S]*?visible:\s+id: "com\.android\.permissioncontroller:id\/permission_deny\.\*button"[\s\S]*?tapOn:\s+id: "com\.android\.permissioncontroller:id\/permission_deny\.\*button"/u,
    'Android Transit smoke must dismiss the runtime location prompt by resource ID.',
  );
  assert.match(
    flows,
    /id: "transit-studio-city-damascus"/u,
    'Transit Studio smoke must select a city through a stable native ID.',
  );
  assert.doesNotMatch(
    smoke,
    /^\s*-\s+tapOn:\s+["']الرئيسية["']\s*$/mu,
    'Home has no navigation control to tap while the root route is active.',
  );
  assert.match(
    smoke,
    /- openLink: "syrianzone:\/\/"\n- runFlow: accept-deep-link\.yaml\n- extendedWaitUntil:\n    visible: "أهلا بك"/u,
    'Smoke must return to Home through the root custom-scheme deep link.',
  );
});

function findRouteTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return findRouteTests(path);
    }
    return /\.(?:test|spec)\.[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

test('keeps test and spec files outside the Expo Router route tree', () => {
  const routeDirectory = resolve(import.meta.dirname, '../src/app');
  const routeTests = findRouteTests(routeDirectory).map((path) =>
    path.slice(routeDirectory.length + 1),
  );

  assert.deepEqual(
    routeTests,
    [],
    `Move route tests outside src/app: ${routeTests.join(', ')}`,
  );
});
