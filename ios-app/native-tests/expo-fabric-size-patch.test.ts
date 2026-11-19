import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const patchPath = fileURLToPath(new URL('../patches/expo-modules-core@58.1.0.patch', import.meta.url));
const target = 'ios/Fabric/ExpoFabricViewObjC.mm';
const immediate = 'constexpr NSUInteger kImmediateSizeUpdateBudgetPerTurn = 2;';
const deferred = 'constexpr NSUInteger kImmediateSizeUpdateBudgetPerTurn = 0;';

test('the versioned Expo patch defers the first size update while preserving all official guard and recycle code', () => {
  expect(JSON.parse(readFileSync(join(root, 'node_modules/expo-modules-core/package.json'), 'utf8')).version).toBe('58.1.0');
  const installed = readFileSync(join(root, 'node_modules/expo-modules-core', target), 'utf8');
  const original = installed.replace(deferred, immediate);
  // This hash was verified against the official npm tarball and the Bun lock integrity.
  expect(createHash('sha256').update(original).digest('hex')).toBe('f3ee2744f8e14acec62bba604d1dd4e7ba0bd34ec7b409b159fb9c3d46d32005');
  const directory = mkdtempSync(join(tmpdir(), 'syrian-expo-size-patch-'));
  try {
    const file = join(directory, target);
    mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, original);
    const result = Bun.spawnSync({ cmd: ['patch', '--batch', '--forward', '-p1', '-i', patchPath], cwd: directory, stdout: 'pipe', stderr: 'pipe' });
    expect(result.exitCode, new TextDecoder().decode(result.stderr)).toBe(0);
    // Whole-file equality preserves coalescing, both size channels, generation checks,
    // real-size changes, recycling and invalidation. Native41 is the runtime RED.
    expect(readFileSync(file, 'utf8')).toBe(original.replace(immediate, deferred));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('the installed autolinker opts exactly Core and its Worklets ABI companion into source builds on Apple platforms', async () => {
  const require = createRequire(import.meta.url);
  const { createAutolinkingOptionsLoader } = require(join(root, 'node_modules/expo-modules-autolinking/build/commands/autolinkingOptions.js')) as {
    createAutolinkingOptionsLoader(options: { projectRoot: string }): {
      getPlatformOptions(platform: string): Promise<{ buildFromSource?: string[] }>;
    };
  };
  const loader = createAutolinkingOptionsLoader({ projectRoot: root });
  expect((await loader.getPlatformOptions('ios')).buildFromSource).toEqual(['ExpoModulesCore', 'ExpoModulesWorklets']);
  expect((await loader.getPlatformOptions('apple')).buildFromSource).toEqual(['ExpoModulesCore', 'ExpoModulesWorklets']);
  expect((await loader.getPlatformOptions('android')).buildFromSource).toBeUndefined();
});
