import assert from 'node:assert/strict';
import test from 'node:test';
import { studioPreservationMode } from './studio-runner-policy.mjs';

const flag = '--preserve-studio-pending';
const selectedClass = 'SyrianZoneUITests/NativeTransitStudioUITests';
const selectedMethod = `${selectedClass}/testTwoSegmentsStopsUndoAndSameProcessDraftReopen`;
test('default cohorts preserve their existing cleanup mode', () => {
  assert.equal(studioPreservationMode([], 'account', ['SyrianZoneUITests/NativeAccountUITests']), false);
  assert.equal(studioPreservationMode([], 'adapters', ['SyrianZoneUITests/NativeAdaptersUITests']), false);
});
test('only one explicit Studio selection can enable pending preservation', () => {
  assert.equal(studioPreservationMode([flag], 'account', [selectedClass]), true);
  assert.equal(studioPreservationMode([flag], 'account', [selectedMethod]), true);
  for (const [args, fixture, selections] of [
    [[flag, flag], 'account', [selectedMethod]], [[flag], 'adapters', [selectedMethod]],
    [[flag], 'account', []], [[flag], 'account', [selectedMethod, selectedMethod]],
    [[flag], 'account', [selectedMethod, 'SyrianZoneUITests/NativeAccountUITests']],
    ...['SyrianZoneUITests', 'SyrianZoneUITests/NativeAccountUITests', `${selectedClass}/unknown`, `${selectedClass}Extra`]
      .map(selection => [[flag], 'account', [selection]])
  ]) assert.throws(() => studioPreservationMode(args, fixture, selections), /requires the account fixture/);
});
test('an omitted flag refuses Studio and broad target selections before the runner can enter default cleanup', () => {
  for (const selection of [selectedClass, selectedMethod, `${selectedClass}/unknown`, 'SyrianZoneUITests', 'SyrianZoneUITests/'])
    assert.throws(() => studioPreservationMode([], 'account', [selection]), /Studio selections require/);
  assert.throws(() => studioPreservationMode([], 'account', ['SyrianZoneUITests/NativeAccountUITests', selectedMethod]), /Studio selections require/);
});
