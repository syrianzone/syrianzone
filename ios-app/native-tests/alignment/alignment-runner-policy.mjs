const selectedClass = 'SyrianZoneUITests/NativeAlignmentUITests';
const selectedMethod = `${selectedClass}/testNativeDrawingDragRenameCoordinatesColdResumeColorCancelAndOwnedCleanup`;

export function alignmentPreservationMode(args, fixture, selections) {
  const count = args.filter(value => value === '--preserve-alignment-document').length;
  const includesAlignment = selections.some(value => value === 'SyrianZoneUITests' || value === 'SyrianZoneUITests/'
    || value === selectedClass || value.startsWith(`${selectedClass}/`));
  if (count === 0 && includesAlignment) throw new Error('Alignment selections require --preserve-alignment-document before any cohort side effects.');
  if (count === 0) return false;
  if (count !== 1 || fixture !== 'account' || selections.length !== 1 || ![selectedClass, selectedMethod].includes(selections[0])
    || args.some(value => ['--preserve-studio-pending', '--preserve-prayer-state', '--public-quran', '--input-trace'].includes(value)))
    throw new Error('Alignment preservation requires only the exact account Alignment class or method.');
  return true;
}
