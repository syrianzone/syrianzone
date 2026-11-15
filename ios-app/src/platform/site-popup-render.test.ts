import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

test('public popup long-copy action binding passes in an isolated React runtime', () => {
  const result = Bun.spawnSync({
    cmd: [process.execPath, 'test', fileURLToPath(new URL('./site-popup-render.behavior.tsx', import.meta.url))],
    cwd: fileURLToPath(new URL('../../', import.meta.url)), stdout: 'pipe', stderr: 'pipe', timeout: 15_000
  });
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  expect(result.exitCode, output).toBe(0);
  expect(output).toContain('1 pass');
  expect(output).toContain('0 fail');
});
