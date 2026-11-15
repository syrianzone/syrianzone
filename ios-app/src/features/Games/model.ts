import { cards, type Card } from './engines';
const { PIP_LAYOUTS } = cards;

export interface MatchStats { played: number; wins: number; losses: number; draws: number }
export interface GameRecords { version: 1; best2048: number; bestSolitaireSeconds: number; largeCards: boolean; tarneeb: MatchStats; trix: MatchStats }
const emptyStats = (): MatchStats => ({ played: 0, wins: 0, losses: 0, draws: 0 });
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function stats(value: unknown): MatchStats {
  if (!value || typeof value !== 'object') throw new Error('إحصائيات اللعبة غير صالحة.');
  const s = value as MatchStats;
  if (![s.played, s.wins, s.losses, s.draws].every(nonnegative) || s.played !== s.wins + s.losses + s.draws) throw new Error('إحصائيات اللعبة غير صالحة.');
  return { played: s.played, wins: s.wins, losses: s.losses, draws: s.draws };
}
export function decodeGameRecords(value: unknown): GameRecords {
  if (value === null) return { version: 1, best2048: 0, bestSolitaireSeconds: 0, largeCards: false, tarneeb: emptyStats(), trix: emptyStats() };
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('سجل الألعاب غير صالح.');
  const r = value as GameRecords;
  if (r.version !== 1 || !nonnegative(r.best2048) || !nonnegative(r.bestSolitaireSeconds) || typeof r.largeCards !== 'boolean') throw new Error('سجل الألعاب غير صالح.');
  return { version: 1, best2048: r.best2048, bestSolitaireSeconds: r.bestSolitaireSeconds, largeCards: r.largeCards, tarneeb: stats(r.tarneeb), trix: stats(r.trix) };
}
export function recordBest(records: GameRecords, game: '2048' | 'solitare', value: number): GameRecords {
  if (!nonnegative(value)) throw new Error('نتيجة اللعبة غير صالحة.');
  return game === '2048' ? { ...records, best2048: Math.max(records.best2048, value) }
    : { ...records, bestSolitaireSeconds: records.bestSolitaireSeconds === 0 ? value : Math.min(records.bestSolitaireSeconds, value) };
}
export function recordFinishedMatch(records: GameRecords, game: 'tarneeb' | 'trix', result: 'win' | 'loss' | 'draw'): GameRecords {
  const previous = records[game];
  return { ...records, [game]: { played: previous.played + 1, wins: previous.wins + Number(result === 'win'), losses: previous.losses + Number(result === 'loss'), draws: previous.draws + Number(result === 'draw') } };
}
export function cardPips(rank: number): { x: number; y: number; flip: boolean }[] {
  return rank === 1 ? [{ x: 50, y: 50, flip: false }] : (PIP_LAYOUTS[rank] ?? []).map(pip => ({ ...pip, flip: pip.flip ?? false }));
}
export function createGameRecordStore(read: () => Promise<GameRecords>, write: (value: GameRecords) => Promise<void>): { load(): Promise<GameRecords>; change(update: (value: GameRecords) => GameRecords): Promise<GameRecords> } {
  let value: GameRecords | null = null, reading: Promise<GameRecords> | null = null, writes = Promise.resolve();
  const current = (): Promise<GameRecords> => {
    if (value) return Promise.resolve(value);
    return reading ??= read().then(loaded => { value = loaded; return loaded; }).finally(() => { reading = null; });
  };
  return { async load() { await writes; return current(); }, change(update) {
    const next = writes.then(async () => { const changed = update(await current()); await write(changed); value = changed; return changed; });
    writes = next.then(() => {}, () => {});
    return next;
  } };
}
export function sortHand(hand: readonly Card[], game: 'tarneeb' | 'trix'): Card[] {
  const power = (card: Card): number => card.rank === 1 ? 14 : card.rank;
  return [...hand].sort((a, b) => cards.SUITS.indexOf(a.suit) - cards.SUITS.indexOf(b.suit) || (game === 'tarneeb' ? power(b) - power(a) : power(a) - power(b)));
}
// PORT STATUS: source resources/js/Pages/Games/_lib/scores.ts, Domain/games/cards.ts and Games/_components/Tarneeb.tsx,Trix.tsx; confidence high; todos 0.
