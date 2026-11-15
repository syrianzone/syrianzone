import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

test('2048 hardware-key controller and modal/lifecycle behavior passes in an isolated React runtime', () => {
  const result = Bun.spawnSync({ cmd: [process.execPath, 'test', fileURLToPath(new URL('./keyboard.behavior.tsx', import.meta.url))],
    cwd: fileURLToPath(new URL('../../../../', import.meta.url)), stdout: 'pipe', stderr: 'pipe', timeout: 15000 });
  const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
  expect(result.exitCode, output).toBe(0);
  expect(output).toContain('20 pass');
  expect(output).toContain('0 fail');
});
