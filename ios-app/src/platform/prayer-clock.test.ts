import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

// Bun shares module mocks across test files. Run the actual React hooks with
// their native event adapters in a child so other screen mocks stay intact.
test('prayer clock visibility and lifecycle behavior passes in an isolated React runtime', () => {
  const result = Bun.spawnSync({
    cmd: [process.execPath, 'test', fileURLToPath(new URL('./prayer-clock.behavior.tsx', import.meta.url))],
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    stdout: 'pipe', stderr: 'pipe', timeout: 10_000
  });
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  expect(result.exitCode, output).toBe(0);
  expect(output).toContain('5 pass');
  expect(output).toContain('0 fail');
});
