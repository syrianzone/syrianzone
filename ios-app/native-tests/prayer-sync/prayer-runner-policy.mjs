const prayerClass = 'SyrianZoneUITests/NativePrayerAccountUITests';
const prayerMethod = `${prayerClass}/testPrayerNativeMarkColdReopenActiveAccountWritesAndExactRestore`;

export function prayerPreservationMode(args, fixture, selections) {
  const count = args.filter(value => value === '--preserve-prayer-state').length;
  const includesPrayer = selections.some(selection => selection === 'SyrianZoneUITests' || selection === 'SyrianZoneUITests/'
    || selection === prayerClass || selection.startsWith(`${prayerClass}/`));
  if (count === 0 && includesPrayer) throw new Error('Prayer selections require --preserve-prayer-state before running any cohort.');
  if (count === 0) return false;
  if (count !== 1 || fixture !== 'account' || selections.length !== 1 || ![prayerClass, prayerMethod].includes(selections[0])
    || args.includes('--preserve-studio-pending') || args.includes('--public-quran')) {
    throw new Error('--preserve-prayer-state requires the account fixture and only the exact Prayer class or method.');
  }
  return true;
}
