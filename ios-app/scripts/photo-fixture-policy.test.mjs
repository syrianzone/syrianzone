import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Compile the actual iOS helper with the Mac CI job's Swift toolchain.
test.skipIf(process.platform !== 'darwin')('the real Swift photo deletion policy approves only the recorded runner object confirmation', () => {
  const album = 'Syrian Zone Native QA B6999A80-1677-438F-BE5A-C20ECFF2DC0A';
  const albumTitle = `Allow “SyrianZoneUITests-Runner” to delete the album “${album}”?`;
  const photoTitle = 'Allow “SyrianZoneUITests-Runner” to delete 1 photo?';
  const buttons = ["Don't Allow", 'Delete'];
  const cases = [
    ['album', album, [albumTitle, 'The photos will not be deleted.'], buttons, true],
    ['photo', album, [photoTitle], buttons, true],
    ['photo', album, [photoTitle.replace('1 photo', 'this photo'), 'This photo will also be deleted from an album.'], buttons, true],
    ['album', album, [albumTitle.replace('B6999A80', 'C6999A80')], buttons, false],
    ['album', album, [albumTitle.replace('SyrianZoneUITests-Runner', 'Another app')], buttons, false],
    ['photo', album, [photoTitle.replace('1 photo', '2 photos')], buttons, false],
    ['photo', album, ['Allow “SyrianZoneUITests-Runner” to access your photo library?'], buttons, false],
    ['photo', album, [photoTitle], [...buttons, 'Delete All'], false],
    ['photo', album, [photoTitle], ['Allow', 'Delete'], false],
    ['photo', 'Unrecorded album', [photoTitle], buttons, false],
    ['album', album, [photoTitle], buttons, false],
    ['photo', album, [albumTitle], buttons, false],
  ];
  // Execute Foundation-only Swift. UIKit, PhotoKit, simulator tools, and Photos never load.
  const source = readFileSync(fileURLToPath(new URL('../native-tests/NativePhotoFixtureDeletionPolicy.swift', import.meta.url)), 'utf8');
  const checks = cases.map(([kind, title, labels, actions, expected], index) =>
    `check(NativePhotoFixtureDeletionPolicy.allows(kind: .${kind}, albumTitle: ${JSON.stringify(title)}, alertLabels: ${JSON.stringify(labels)}, buttonLabels: ${JSON.stringify(actions)}) == ${expected}, "Deletion policy case ${index + 1} failed")`).join('\n');
  const recoveryCases = [
    [['album'], true, true, false],
    [['album'], false, true, true],
    [['photo'], true, false, true],
    [['album'], true, false, false],
    [[], false, false, false],
    [['album', 'photo'], false, false, true],
  ];
  const recovery = recoveryCases.map(([accepted, albumPresent, photoPresent, expected], index) =>
    `check(NativePhotoFixtureDeletionPolicy.recoveryFinished(accepted: Set([${accepted.map(kind => `NativePhotoFixtureDeletionPolicy.Kind.${kind}`).join(',')}]), albumPresent: ${albumPresent}, photoPresent: ${photoPresent}) == ${expected}, "Recovery case ${index + 1} failed")`).join('\n');
  const duplicates = ['album', 'photo'].flatMap(kind => [true, false].map(present =>
    `check(NativePhotoFixtureDeletionPolicy.action(kind: .${kind}, objectPresent: ${present}, albumTitle: ${JSON.stringify(album)}, alertLabels: ${JSON.stringify([kind === 'album' ? albumTitle : photoTitle])}, buttonLabels: ${JSON.stringify(buttons)}) == .${present ? 'approve' : 'decline'}, "Duplicate action ${kind} ${present} failed")`)).join('\n');
  const foreign = `check(NativePhotoFixtureDeletionPolicy.action(kind: .photo, objectPresent: false, albumTitle: ${JSON.stringify(album)}, alertLabels: ${JSON.stringify([photoTitle.replace('SyrianZoneUITests-Runner', 'Another app')])}, buttonLabels: ${JSON.stringify(buttons)}) == nil, "Foreign absent-object prompt must remain untouched")`;
  const total = cases.length + recoveryCases.length + 5;
  const directory = mkdtempSync(path.join(os.tmpdir(), 'syrianzone-photo-policy-'));
  try {
    const file = path.join(directory, 'policy.swift');
    const check = 'func check(_ value: Bool, _ message: String) { if !value { FileHandle.standardError.write(Data((message + "\\n").utf8)); exit(1) } }';
    writeFileSync(file, `${source}\n${check}\n${checks}\n${recovery}\n${duplicates}\n${foreign}\nprint("${total} deletion-policy cases passed")\n`, { mode: 0o600 });
    const result = Bun.spawnSync({ cmd: ['swift', file], stdout: 'pipe', stderr: 'pipe', timeout: 20000 });
    const output = new TextDecoder().decode(result.stdout) + new TextDecoder().decode(result.stderr);
    expect(result.exitCode, output).toBe(0);
    expect(output).toContain(`${total} deletion-policy cases passed`);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 30_000);
