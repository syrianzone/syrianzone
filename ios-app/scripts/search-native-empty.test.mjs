import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Compile the actual iOS helper with the Mac CI job's Swift toolchain.
test.skipIf(process.platform !== 'darwin')('the native clear policy accepts observed empty renderings and rejects visible text or remaining clear controls', () => {
  const source = readFileSync(new URL('../native-tests/NativeSearchFieldDrawingUITests.swift', import.meta.url), 'utf8');
  const policy = source.match(/private enum NativeSearchEmptyPolicy \{[\s\S]*?\n\}/)?.[0];
  expect(policy).toBeDefined();
  const directory = mkdtempSync(path.join(os.tmpdir(), 'syrianzone-search-empty-'));
  try {
    const file = path.join(directory, 'empty.swift');
    writeFileSync(file, `import Foundation
${policy}
func check(_ value: Bool, _ message: String) { if !value { FileHandle.standardError.write(Data((message + "\\n").utf8)); exit(1) } }
let placeholder = "ابحث بالاسم أو البريد الإلكتروني"
check(NativeSearchEmptyPolicy.matches(value: nil, placeholder: placeholder, clearButtonPresent: false), "Observed missing native value must permit the separate JS empty proof")
check(NativeSearchEmptyPolicy.matches(value: "", placeholder: placeholder, clearButtonPresent: false), "The empty native string must remain accepted")
check(NativeSearchEmptyPolicy.matches(value: placeholder, placeholder: placeholder, clearButtonPresent: false), "The exact nonempty native placeholder must permit the separate JS empty proof")
check(!NativeSearchEmptyPolicy.matches(value: "different text", placeholder: placeholder, clearButtonPresent: false), "Other text must not be empty")
check(!NativeSearchEmptyPolicy.matches(value: " ", placeholder: placeholder, clearButtonPresent: false), "Whitespace must not be trimmed")
check(!NativeSearchEmptyPolicy.matches(value: "missing", placeholder: nil, clearButtonPresent: false), "Missing placeholder must not adopt nonempty text")
check(!NativeSearchEmptyPolicy.matches(value: 0, placeholder: placeholder, clearButtonPresent: false), "Non-string values must not become empty")
check(!NativeSearchEmptyPolicy.matches(value: NSNull(), placeholder: placeholder, clearButtonPresent: false), "An explicit non-string null must fail closed")
for value: Any? in [nil, "", placeholder] {
  check(!NativeSearchEmptyPolicy.matches(value: value, placeholder: placeholder, clearButtonPresent: true), "A remaining native clear control must refuse every empty rendering")
}
print("11 native empty policy cases passed")
`, { mode: 0o600 });
    const result = Bun.spawnSync({ cmd: ['swift', '-swift-version', '6', '-strict-concurrency=complete', '-warnings-as-errors', file], stdout: 'pipe', stderr: 'pipe', timeout: 20000 });
    const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
    expect(result.exitCode, output).toBe(0);
    expect(output).toContain('11 native empty policy cases passed');
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 30_000);
