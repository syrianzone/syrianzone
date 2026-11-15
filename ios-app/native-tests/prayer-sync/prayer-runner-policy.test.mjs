import assert from 'node:assert/strict';
import { prayerPreservationMode } from './prayer-runner-policy.mjs';
const prayer = 'SyrianZoneUITests/NativePrayerAccountUITests';
const method = prayer + '/testPrayerNativeMarkColdReopenActiveAccountWritesAndExactRestore';
assert.equal(prayerPreservationMode(['--preserve-prayer-state'], 'account', [prayer]), true);
assert.equal(prayerPreservationMode(['--preserve-prayer-state'], 'account', [method]), true);
assert.equal(prayerPreservationMode([], 'account', ['SyrianZoneUITests/NativeAccountUITests']), false);
for (const [args, fixture, selections] of [[[], 'account', [prayer]], [[], 'account', ['SyrianZoneUITests']],
  [['--preserve-prayer-state'], 'adapters', [prayer]], [['--preserve-prayer-state'], 'account', [prayer, 'Other']],
  [['--preserve-prayer-state'], 'account', []], [['--preserve-prayer-state'], 'account', [prayer + '/OtherMethod']],
  [['--preserve-prayer-state', '--preserve-prayer-state'], 'account', [prayer]],
  [['--preserve-prayer-state', '--preserve-studio-pending'], 'account', [prayer]], [['--preserve-prayer-state', '--public-quran'], 'account', [prayer]]]) {
  assert.throws(() => prayerPreservationMode(args, fixture, selections));
}
console.log('Prayer runner: 12 checks passed.');
