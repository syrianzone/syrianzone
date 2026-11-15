import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

// Bun's node:test adapter requires the explicit skip API.
const testOnMac = process.platform === 'darwin' ? test : test.skip;

testOnMac('the actual Files recovery helper reuses only an empty private directory and preserves refused paths', () => {
  const source = fs.readFileSync(new URL('../native-tests/NativeLocalFilesUITests.swift', import.meta.url), 'utf8');
  const start = source.indexOf('private func localFilesFailure(');
  const end = source.indexOf('private final class LocalFilesJournal', start);
  assert.ok(start >= 0 && end > start);
  const helper = source.slice(start, end);
  assert.ok(helper.includes('preparePrivateFilesRecoveryDirectory'));
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'native-files-recovery-policy-')));
  fs.chmodSync(temporary, 0o700);
  try {
    const file = path.join(temporary, 'main.swift');
    fs.writeFileSync(file, `import Foundation
import Darwin
${helper}
let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let manager = FileManager.default
var checks = 0
@MainActor func check(_ value: Bool) throws {
  if !value { throw NSError(domain: "RecoveryPolicyRegression", code: 1) }
  checks += 1
}
@MainActor func refused(_ target: URL) throws {
  var rejected = false
  do { try preparePrivateFilesRecoveryDirectory(target) } catch { rejected = true }
  try check(rejected)
}
func metadata(_ target: URL) throws -> stat {
  var value = stat()
  guard target.path.withCString({ Darwin.lstat($0, &value) }) == 0 else { throw NSError(domain: "RecoveryPolicyRegression", code: 2) }
  return value
}
do {
  let fresh = root.appendingPathComponent("fresh", isDirectory: true)
  try preparePrivateFilesRecoveryDirectory(fresh)
  let original = try metadata(fresh)
  try check(original.st_uid == geteuid() && original.st_mode & 0o777 == 0o700)
  try preparePrivateFilesRecoveryDirectory(fresh)
  let reused = try metadata(fresh)
  try check(reused.st_ino == original.st_ino && reused.st_dev == original.st_dev)

  let record = fresh.appendingPathComponent("owned-record.json")
  let bytes = Data("synthetic retained recovery record".utf8)
  try bytes.write(to: record)
  try refused(fresh)
  try check(try Data(contentsOf: record) == bytes)
  try check(try manager.contentsOfDirectory(atPath: fresh.path) == ["owned-record.json"])

  let regular = root.appendingPathComponent("regular")
  try bytes.write(to: regular)
  try refused(regular)
  try check(try Data(contentsOf: regular) == bytes)

  let loose = root.appendingPathComponent("loose", isDirectory: true)
  try manager.createDirectory(at: loose, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o755])
  try refused(loose)
  try check(try metadata(loose).st_mode & 0o777 == 0o755)

  let target = root.appendingPathComponent("target", isDirectory: true)
  try manager.createDirectory(at: target, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
  let linked = root.appendingPathComponent("linked")
  try manager.createSymbolicLink(at: linked, withDestinationURL: target)
  let targetBefore = try metadata(target)
  try refused(linked)
  try check(try metadata(linked).st_mode & mode_t(S_IFMT) == mode_t(S_IFLNK))
  try check(try metadata(target).st_ino == targetBefore.st_ino && manager.contentsOfDirectory(atPath: target.path).isEmpty)

  let dangling = root.appendingPathComponent("dangling")
  let missing = root.appendingPathComponent("missing")
  try manager.createSymbolicLink(at: dangling, withDestinationURL: missing)
  try refused(dangling)
  try check(try metadata(dangling).st_mode & mode_t(S_IFMT) == mode_t(S_IFLNK))
  try check(!manager.fileExists(atPath: missing.path))

  let absentParent = root.appendingPathComponent("absent-parent", isDirectory: true)
  try refused(absentParent.appendingPathComponent("child", isDirectory: true))
  try check(!manager.fileExists(atPath: absentParent.path))
  print("PASS recovery-policy \\(checks)")
} catch {
  print("FAIL recovery-policy")
  exit(1)
}
`, { mode: 0o600 });
    const result = spawnSync('swift', ['-swift-version', '6', file, temporary], { encoding: 'utf8', timeout: 30_000, maxBuffer: 64_000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^PASS recovery-policy 17\s*$/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
