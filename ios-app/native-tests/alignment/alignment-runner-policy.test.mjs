import assert from 'node:assert/strict';
import test from 'node:test';
import { alignmentPreservationMode } from './alignment-runner-policy.mjs';
const flag = '--preserve-alignment-document', selectedClass = 'SyrianZoneUITests/NativeAlignmentUITests';
const selectedMethod = `${selectedClass}/testNativeDrawingDragRenameCoordinatesColdResumeColorCancelAndOwnedCleanup`;

test('ordinary unrelated classes keep their current cleanup behavior', () => {
  assert.equal(alignmentPreservationMode([], 'account', ['SyrianZoneUITests/NativeAccountUITests']), false);
  assert.equal(alignmentPreservationMode([], 'adapters', ['SyrianZoneUITests/NativeAdaptersUITests']), false);
});
test('missing flags and broad selections refuse before the runner can touch any state', () => {
  for (const selected of [selectedClass, selectedMethod, selectedClass + '/unknown', 'SyrianZoneUITests', 'SyrianZoneUITests/'])
    assert.throws(() => alignmentPreservationMode([], 'account', [selected]), /require --preserve/);
});
test('only one explicit account Alignment selection accepts its mandatory flag', () => {
  assert.equal(alignmentPreservationMode([flag], 'account', [selectedClass]), true);
  assert.equal(alignmentPreservationMode([flag], 'account', [selectedMethod]), true);
  for (const [args, fixture, selected] of [
    [[flag, flag], 'account', [selectedClass]], [[flag], 'adapters', [selectedClass]], [[flag], 'account', []],
    [[flag], 'account', [selectedClass, selectedMethod]], [[flag], 'account', [selectedClass + '/unknown']],
    ...['--preserve-studio-pending', '--preserve-prayer-state', '--public-quran', '--input-trace'].map(other => [[flag, other], 'account', [selectedMethod]]),
  ]) assert.throws(() => alignmentPreservationMode(args, fixture, selected), /requires only/);
});
