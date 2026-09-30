// The shared playing-card kit: the card value, the deck, and the labels and pip
// geometry every card game draws from. Free of React and of any one game's
// rules, so solitaire, tarneeb and whatever comes next can share it.

export type Suit = 'S' | 'H' | 'D' | 'C';

/** Rank 1 = Ace … 13 = King. */
export interface Card {
  id: string;
  rank: number;
  suit: Suit;
  /**
   * Display state, not identity: a card is only ever drawn from its rank and
   * suit, and each game decides when a given card is up (solitaire flips cards
   * as they are uncovered; a trick game shows its hand up and its opponents'
   * down).
   */
  faceUp: boolean;
}

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
