const studioClass = 'SyrianZoneUITests/NativeTransitStudioUITests';
const studioMethod = `${studioClass}/testTwoSegmentsStopsUndoAndSameProcessDraftReopen`;

export function studioPreservationMode(args, fixture, selections) {
  const count = args.filter(value => value === '--preserve-studio-pending').length;
  const includesStudio = selections.some(selection => selection === 'SyrianZoneUITests' || selection === 'SyrianZoneUITests/'
    || selection === studioClass || selection.startsWith(`${studioClass}/`));
  if (count === 0 && includesStudio) throw new Error('Studio selections require --preserve-studio-pending before running any cohort.');
  if (count === 0) return false;
  if (count !== 1 || fixture !== 'account' || selections.length !== 1 || ![studioClass, studioMethod].includes(selections[0]))
    throw new Error('--preserve-studio-pending requires the account fixture and one explicit Studio class or method selection.');
  return true;
}
