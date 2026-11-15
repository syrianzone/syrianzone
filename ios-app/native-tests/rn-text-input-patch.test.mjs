import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = resolve(root, 'node_modules/react-native');

// These three source hashes pin the reviewed comparison change, not UIKit input timing.
test('the exact React Native comparison patch is installed', () => {
  expect(JSON.parse(readFileSync(resolve(root, 'node_modules/react-native/package.json'), 'utf8')).version).toBe('0.88.1');
  const manifest = JSON.parse(readFileSync(resolve(root, 'native-tests/rn-text-input-source-manifest.json'), 'utf8'));
  for (const row of manifest.files) {
    const bytes = readFileSync(resolve(sourceRoot, row.path));
    expect(createHash('sha256').update(bytes).digest('hex'), row.path).toBe(row.afterSHA256);
  }
});

test.skipIf(process.platform !== 'darwin')('real RN comparisons skip equal-text echoes while retaining text and style changes', () => {
  const result = Bun.spawnSync({
    cmd: ['python3', resolve(root, 'scripts/check-rn-text-input-comparison.py'), sourceRoot],
    stdout: 'pipe', stderr: 'pipe', timeout: 20000
  });
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  expect(result.exitCode, output).toBe(0);
  expect(output).toContain('17 comparison checks, 0 failures');
});

test('the installed Expo plugin persists a source build for the patched RN core', async () => {
  const config = (await import(pathToFileURL(resolve(root, 'app.config.ts')).href)).default;
  const plugin = config.plugins.find((value) => Array.isArray(value) && value[0] === 'expo-build-properties');
  expect(plugin?.[1]?.ios?.buildReactNativeFromSource).toBe(true);
  const require = createRequire(import.meta.url);
  const { withIosBuildProperties } = require(resolve(root, 'node_modules/expo-build-properties/build/ios.js'));
  const registered = withIosBuildProperties({ name: config.name, slug: config.slug }, plugin[1]);
  const result = await registered.mods.ios.podfileProperties({
    ...registered, modResults: {},
    modRequest: { platform: 'ios', modName: 'podfileProperties', projectRoot: root, platformProjectRoot: resolve(root, 'ios'), introspect: true }
  });
  expect(result.modResults['ios.buildReactNativeFromSource']).toBe('true');
  expect(result.modResults.EXPO_USE_PRECOMPILED_MODULES).toBe('true');
});
