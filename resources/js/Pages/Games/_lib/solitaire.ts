// Klondike solitaire rules, free of React so they can be unit-tested and
// reused. The board is a plain value: every move returns a new `Deal`, which is
// what makes undo a one-line history array in the component.

export type Suit = 'S' | 'H' | 'D' | 'C';

/** Rank 1 = Ace … 13 = King. */
export interface Card {
  id: string;
  rank: number;
  suit: Suit;
  /** Only a face-up card may be moved, and only the bottom one is ever exposed. */
  faceUp: boolean;
}

export interface Deal {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  /** Seven columns, left to right. */
  tableau: Card[][];
}

export type Source =
  | { kind: 'waste' }
  | { kind: 'foundation'; index: number }
  | { kind: 'tableau'; column: number; cardIndex: number };

export type Destination = { kind: 'foundation'; index: number } | { kind: 'tableau'; column: number };

export const RANKS = 13;
export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export const SUIT_LABEL: Record<Suit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

export const RANK_LABEL = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** Whether a card is drawn as pips, a single ace pip, or a court letter. */
export const isCourt = (rank: number): boolean => rank >= 11;

/**
 * Where the pips sit on a number card, as percentages of the card box.
 *
 * The traditional arrangement is a three-column by seven-row grid, so the rows
 * are evenly spaced and the top and bottom ones sit in from the edge. Aces and
 * court cards are not here — they get a centre treatment instead.
 *
 * A real deck mirrors everything below the middle line, so `y > 50` is drawn
 * rotated; without that the card reads as lopsided rather than as a card.
 */
export interface Pip {
  x: number;
  y: number;
  flip?: boolean;
}

const COL_L = 34;
const COL_C = 50;
const COL_R = 66;
const ROW_1 = 15;
const ROW_2 = 27;
const ROW_3 = 39;
const ROW_4 = 50;
const ROW_5 = 61;
const ROW_6 = 73;
const ROW_7 = 85;

const flip = (p: Pip): Pip => (p.y > ROW_4 ? { ...p, flip: true } : p);

const CENTRE = (y: number): Pip => ({ x: COL_C, y });
const SIDE_TOP = [{ x: COL_L, y: ROW_1 }, { x: COL_R, y: ROW_1 }];
const SIDE_MID = [{ x: COL_L, y: ROW_4 }, { x: COL_R, y: ROW_4 }];
const SIDE_BOTTOM = [{ x: COL_L, y: ROW_7 }, { x: COL_R, y: ROW_7 }];
const SIX = [...SIDE_TOP, ...SIDE_MID, ...SIDE_BOTTOM];
/* Two columns of four, evenly spread. The 9 and 10 share this outer field and
   differ only in their centre pips, the way a real deck does. */
const EIGHT = [
  { x: COL_L, y: ROW_1 },
  { x: COL_L, y: ROW_3 },
  { x: COL_L, y: ROW_5 },
  { x: COL_L, y: ROW_7 },
  { x: COL_R, y: ROW_1 },
  { x: COL_R, y: ROW_3 },
  { x: COL_R, y: ROW_5 },
  { x: COL_R, y: ROW_7 },
];

export const PIP_LAYOUTS: Record<number, Pip[]> = {
  2: [CENTRE(ROW_1), CENTRE(ROW_7)].map(flip),
  3: [CENTRE(ROW_1), CENTRE(ROW_4), CENTRE(ROW_7)].map(flip),
  4: [...SIDE_TOP, ...SIDE_BOTTOM].map(flip),
  5: [...SIDE_TOP, CENTRE(ROW_4), ...SIDE_BOTTOM].map(flip),
  6: SIX.map(flip),
  7: [...SIX, CENTRE(ROW_2)].map(flip),
  8: [...SIX, CENTRE(ROW_2), CENTRE(ROW_6)].map(flip),
  9: [...EIGHT, CENTRE(ROW_4)].map(flip),
  10: [...EIGHT, CENTRE(ROW_2), CENTRE(ROW_6)].map(flip),
};

export const isRed = (card: Card): boolean => card.suit === 'H' || card.suit === 'D';

const isFace = (card: Card): boolean => card.faceUp;

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= RANKS; rank++) {
      deck.push({ id: `${suit}${rank}`, rank, suit, faceUp: false });
    }
  }
  return deck;
}

/** Fisher–Yates, taking the randomness as an argument so deals are testable. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function createDeal(random: () => number = Math.random): Deal {
  const deck = shuffle(createDeck(), random);
  const tableau: Card[][] = [];
  let taken = 0;
  for (let col = 0; col < 7; col++) {
    const column: Card[] = [];
    for (let i = 0; i <= col; i++) {
      // Only the last card dealt to a column is face up.
      column.push({ ...deck[taken], faceUp: i === col });
      taken++;
    }
    tableau.push(column);
  }
  return {
    stock: deck.slice(taken).map((c) => ({ ...c, faceUp: false })),
    waste: [],
    foundations: [[], [], [], []],
    tableau,
  };
}

const top = (pile: Card[]): Card | undefined => pile[pile.length - 1];

/**
 * The cards a source would lift, or null when nothing can be lifted from it.
 * From a tableau column this is a run — the chosen card plus everything below
 * it — and every card in the run must already be face up.
 */
export function liftable(deal: Deal, from: Source): Card[] | null {
  if (from.kind === 'waste') {
    const card = top(deal.waste);
    return card && isFace(card) ? [card] : null;
  }
  if (from.kind === 'foundation') {
    const card = top(deal.foundations[from.index]);
    return card && isFace(card) ? [card] : null;
  }
  const column = deal.tableau[from.column];
  if (!column || from.cardIndex < 0 || from.cardIndex >= column.length) return null;
  const run = column.slice(from.cardIndex);
  return run.every(isFace) ? run : null;
}

/** Tableau stacks descend and alternate colour; only a King starts an empty one. */
export function acceptsTableau(target: Card | undefined, moving: Card): boolean {
  if (!target) return moving.rank === RANKS;
  return target.rank === moving.rank + 1 && isRed(target) !== isRed(moving);
}

/** Foundations build up in one suit, Ace first. */
export function acceptsFoundation(pile: Card[], moving: Card): boolean {
  if (pile.length === 0) return moving.rank === 1;
  const first = pile[0];
  return first.suit === moving.suit && moving.rank === pile.length + 1;
}

export function canMove(deal: Deal, from: Source, to: Destination): boolean {
  const run = liftable(deal, from);
  if (!run || run.length === 0) return false;
  // A run can only be dropped as a whole, so it must land on a tableau column.
  const head = run[0];
  if (to.kind === 'foundation') return run.length === 1 && acceptsFoundation(deal.foundations[to.index], head);
  return acceptsTableau(top(deal.tableau[to.column]), head);
}

export function applyMove(deal: Deal, from: Source, to: Destination): Deal {
  const run = liftable(deal, from);
  if (!run || run.length === 0 || !canMove(deal, from, to)) return deal;

  const next: Deal = {
    stock: deal.stock,
    waste: deal.waste,
    foundations: deal.foundations.map((p) => p.slice()),
    tableau: deal.tableau.map((col) => col.slice()),
  };
  const placed = run.map((c) => ({ ...c, faceUp: true }));

  if (from.kind === 'waste') next.waste = deal.waste.slice(0, -1);
  else if (from.kind === 'foundation') next.foundations[from.index] = deal.foundations[from.index].slice(0, -1);
  else {
    next.tableau[from.column] = deal.tableau[from.column].slice(0, from.cardIndex);
    // Exposing the next card is what makes a buried column playable again.
    const column = next.tableau[from.column];
    const uncovered = top(column);
    if (uncovered && !uncovered.faceUp) column[column.length - 1] = { ...uncovered, faceUp: true };
  }

  if (to.kind === 'foundation') next.foundations[to.index] = [...deal.foundations[to.index], ...placed];
  else next.tableau[to.column] = [...deal.tableau[to.column], ...placed];

  return next;
}

/** Turn a card over to the stock, or recycle the waste back into it. */
export function drawStock(deal: Deal): Deal {
  if (deal.stock.length > 0) {
    const rest = deal.stock.slice(0, -1);
    const drawn = top(deal.stock)!;
    return { ...deal, stock: rest, waste: [...deal.waste, { ...drawn, faceUp: true }] };
  }
  if (deal.waste.length === 0) return deal;
  return {
    ...deal,
    stock: deal.waste
      .slice()
      .reverse()
      .map((c) => ({ ...c, faceUp: false })),
    waste: [],
  };
}

export const canDraw = (deal: Deal): boolean => deal.stock.length > 0 || deal.waste.length > 0;

export function isWon(deal: Deal): boolean {
  return deal.foundations.every((pile) => pile.length === RANKS);
}

/** How many cards are still face down in the tableau. */
export function buriedCount(deal: Deal): number {
  return deal.tableau.reduce((n, col) => n + col.filter((c) => !c.faceUp).length, 0);
}

export function isStockEmpty(deal: Deal): boolean {
  return deal.stock.length === 0;
}

export interface Move {
  from: Source;
  to: Destination;
}

/**
 * Every move worth making, for the hint button and the "no moves left" check.
 *
 * Two classes are filtered out. A pile never offers a move onto itself, and a
 * card is never offered from one foundation to another: shuffling an Ace into
 * the next empty foundation is legal under `canMove` but never useful, and
 * leaving those in would bury the real hints. The only genuine reason to take a
 * card back off a foundation is to return it to the tableau.
 */
export function availableMoves(deal: Deal): Move[] {
  const moves: Move[] = [];
  const sources: Source[] = [];

  const waste = top(deal.waste);
  if (waste && isFace(waste)) sources.push({ kind: 'waste' });

  deal.foundations.forEach((pile, index) => {
    const card = top(pile);
    if (card && isFace(card)) sources.push({ kind: 'foundation', index });
  });

  deal.tableau.forEach((column, columnIndex) => {
    column.forEach((_, cardIndex) => {
      const from: Source = { kind: 'tableau', column: columnIndex, cardIndex };
      if (liftable(deal, from) !== null) sources.push(from);
    });
  });

  for (const from of sources) {
    for (let index = 0; index < deal.foundations.length; index++) {
      if (from.kind === 'foundation') continue;
      const to: Destination = { kind: 'foundation', index };
      if (canMove(deal, from, to)) moves.push({ from, to });
    }
    for (let column = 0; column < deal.tableau.length; column++) {
      if (from.kind === 'tableau' && from.column === column) continue;
      const to: Destination = { kind: 'tableau', column };
      if (canMove(deal, from, to)) moves.push({ from, to });
    }
  }
  return moves;
}

export function hasMove(deal: Deal): boolean {
  return canDraw(deal) || availableMoves(deal).length > 0;
}

/**
 * Whether sending a card to its foundation now can be undone without giving up
 * a turn. This is the conventional Klondike heuristic, not a proof: a card is
 * treated as safe when
 *   - it is a King (a King can never be needed back under anything), or
 *   - the two foundations of the opposite colour are level, so the next card of
 *     that colour is already placeable and nothing has to be pulled back, or
 *   - it is a 2 whose opposite-colour 2 is already home.
 *
 * The check is deliberately conservative: a false negative just means the
 * player moves the card themselves.
 */
export function isFoundationSafe(deal: Deal, card: Card): boolean {
  if (card.rank === RANKS) return true;

  const height: Record<Suit, number> = { S: 0, H: 0, D: 0, C: 0 };
  for (const pile of deal.foundations) {
    if (pile.length > 0) height[pile[0].suit] = pile.length;
  }
  const red = isRed(card);
  const opposite: [Suit, Suit] = red ? ['S', 'C'] : ['H', 'D'];
  const same: [Suit, Suit] = red ? ['H', 'D'] : ['S', 'C'];

  if (height[opposite[0]] === height[opposite[1]]) return true;
  if (card.rank === 2 && height[same[0]] >= 2 && height[same[1]] >= 2) return true;
  return false;
}

/** Send every card that can safely reach a foundation, until none can. */
export function autoMove(deal: Deal): Deal {
  let current = deal;
  for (let guard = 0; guard < 64; guard++) {
    const move = availableMoves(current).find(
      (m) =>
        m.to.kind === 'foundation' &&
        liftable(current, m.from)?.length === 1 &&
        isFoundationSafe(current, liftable(current, m.from)![0]),
    );
    if (!move) break;
    const next = applyMove(current, move.from, move.to);
    if (next === current) break;
    current = next;
  }
  return current;
}

/** Every foundation but one is full, so the rest must be the other colour. */
export function canAutoFinish(deal: Deal): boolean {
  if (isWon(deal)) return true;
  return availableMoves(deal).every(
    (m) => m.to.kind !== 'foundation' || isFoundationSafe(deal, liftable(deal, m.from)![0]),
  );
}

/** Short label for a move, for the hint line. */
export function describeMove(deal: Deal, move: Move): string {
  const card = liftable(deal, move.from)?.[0];
  if (!card) return '';
  const name = `${RANK_LABEL[card.rank]}${SUIT_LABEL[card.suit]}`;
  return move.to.kind === 'foundation' ? `${name} إلى الأساس` : `${name} إلى العمود ${move.to.column + 1}`;
}
