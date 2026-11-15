import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

// Keep native host/animation mocks out of other features' Bun module registry.
test('2048 native render and transition behavior passes in an isolated React runtime', () => {
  const result = Bun.spawnSync({ cmd: [process.execPath, 'test', fileURLToPath(new URL('./render.behavior.tsx', import.meta.url))],
    cwd: fileURLToPath(new URL('../../../../', import.meta.url)), stdout: 'pipe', stderr: 'pipe', timeout: 15000 });
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  expect(result.exitCode, output).toBe(0);
  expect(output).toContain('10 pass');
  expect(output).toContain('0 fail');
});
