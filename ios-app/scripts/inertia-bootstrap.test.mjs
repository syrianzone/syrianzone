import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Compile the actual iOS helper with the Mac CI job's Swift toolchain.
test.skipIf(process.platform !== 'darwin')('the native observer reads the actual Home version and rejects malformed or ambiguous bootstraps', () => {
  const modern = value => `<script type="application/json" data-page="app">${JSON.stringify(value)}</script><div id="app"></div>`;
  const legacy = value => `<div data-page="${JSON.stringify(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#039;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}"></div>`;
  const good = { component: 'Home', version: 'actual-asset-v12', props: { copy: '<safe> & "text"' } };
  const successes = [[modern(good), 'actual-asset-v12'], [legacy(good), 'actual-asset-v12'],
    [modern({ component: 'Home', version: null }), '']];
  const failures = [modern({ component: 'Home' }), modern({ component: 'Home', version: 3 }),
    modern({ component: 'Account', version: 'wrong-page' }), modern({ component: 'Home', version: 'injected\r\nHeader: x' }),
    modern({ component: 'Home', version: 'x'.repeat(257) }), modern(good) + modern(good), modern(good) + legacy(good),
    '<script data-page="app">not JSON</script>', '<script>window.version="ignored"</script>', modern([])];
  const checks = successes.map(([html, version], index) => `try check(try NativeInertiaBootstrap.version(in: ${JSON.stringify(html)}) == ${JSON.stringify(version)}, "Valid bootstrap ${index} failed")`).join('\n');
  const negatives = failures.map((html, index) => `do { _ = try NativeInertiaBootstrap.version(in: ${JSON.stringify(html)}); check(false, "Invalid bootstrap ${index} was accepted") } catch {}` ).join('\n');
  const source = readFileSync(fileURLToPath(new URL('../native-tests/NativeInertiaBootstrap.swift', import.meta.url)), 'utf8');
  const directory = mkdtempSync(path.join(os.tmpdir(), 'syrianzone-inertia-bootstrap-'));
  try {
    const file = path.join(directory, 'bootstrap.swift');
    writeFileSync(file, `${source}
func check(_ value: @autoclosure () throws -> Bool, _ message: String) rethrows { if try !value() { FileHandle.standardError.write(Data((message + "\\n").utf8)); exit(1) } }
${checks}
${negatives}
do { _ = try NativeInertiaBootstrap.version(in: String(repeating: "x", count: 2_000_001)); check(false, "Oversized HTML was accepted") } catch {}
check(NativeInertiaBootstrap.headers(version: "actual-asset-v12") == ["X-Inertia":"true", "X-Inertia-Version":"actual-asset-v12", "X-Requested-With":"XMLHttpRequest"], "The observer must send the exact current version header")
check(NativeInertiaBootstrap.headers(version: "")["X-Inertia-Version"] == "", "A legacy null version must remain an explicit empty version")
print("16 Inertia bootstrap cases passed")
`, { mode: 0o600 });
    const result = Bun.spawnSync({ cmd: ['swift', '-swift-version', '6', '-strict-concurrency=complete', '-warnings-as-errors', file], stdout: 'pipe', stderr: 'pipe', timeout: 20000 });
    const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
    expect(result.exitCode, output).toBe(0);
    expect(output).toContain('16 Inertia bootstrap cases passed');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
