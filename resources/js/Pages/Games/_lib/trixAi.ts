// A Trix opponent. Two jobs: pick a contract when it owns the kingdom, and play
// a card under whichever contract is running. The avoidance contracts share one
// policy — duck the trick, shed the contract's penalty card onto someone else —
// and the التركس contract has its own, aiming to empty the hand fast.
//
// `teams` (the فريقين mode) is what the partner-awareness is for: a partner who
// is already winning the trick is spared rather than fed a penalty card.

import { SUITS, type Card } from './cards';
import { groupBySuit, highest, lowest, power } from './cardGames/hand';
import { hasSuit, trickWinner, type Seat } from './cardGames/trick';
import { legalPlays, TRIX_PLAYERS, type Contract, type TrixDeal, type TrixOptions } from './trix';

type AvoidDeal = Exclude<TrixDeal, { contract: 'trix' }>;
type ShedDeal = Extract<TrixDeal, { contract: 'trix' }>;
type ContractId = TrixDeal['contract'];

const partnerOf = (seat: Seat): Seat => (seat + 2) % TRIX_PLAYERS;

/** Whether a card carries the penalty the contract is about. */
function isPenalty(card: Card, contract: ContractId): boolean {
  if (contract === 'queens') return card.rank === 12;
  if (contract === 'diamonds') return card.suit === 'D';
  if (contract === 'kingOfHearts') return card.id === 'H13';
  return false;
}

// ---- playing ----------------------------------------------------------------

/** The card to play, or null when there is nothing to do but pass (التركس only). */
export function choosePlay(deal: TrixDeal, seat: Seat, options: TrixOptions): Card | null {
  const legal = legalPlays(deal, seat);
  if (legal.length === 0) return null;

  if (deal.contract === 'trix') return shedPlay(deal, legal);
  if (deal.round.trick.length === 0) return leadAvoid(legal, deal.contract);
  return followAvoid(deal, seat, legal, options.teams);
}

/** Leading: keep clear of the contract's penalty suit when possible, then go low. */
function leadAvoid(legal: Card[], contract: ContractId): Card {
  const safe = legal.filter((card) => !isPenalty(card, contract));
  return lowest(safe.length > 0 ? safe : legal);
}

/** Following: duck under the winner; when void, give away a penalty — not to a partner. */
function followAvoid(deal: AvoidDeal, seat: Seat, legal: Card[], teams: boolean): Card {
  const { round, contract } = deal;
  const led = round.trick[0].card.suit;
  const current = trickWinner(round.trick, null);

  if (!hasSuit(round.hands[seat], led)) {
    if (teams && current.seat === partnerOf(seat)) return lowest(legal);
    const penalties = legal.filter((card) => isPenalty(card, contract));
    return penalties.length > 0 ? highest(penalties) : highest(legal);
  }

  // Must follow: stay under the current winner if any card allows it.
  const ducks = legal.filter((card) => !(card.suit === led && power(card) > power(current.card)));
  return lowest(ducks.length > 0 ? ducks : legal);
}

/** التركس: build the suit the hand is longest in, and shed the highest there. */
function shedPlay(deal: ShedDeal, legal: Card[]): Card {
  const groups = groupBySuit(deal.hands[deal.turn]);
  return legal
    .slice()
    .sort((a, b) => groups[b.suit].length - groups[a.suit].length || power(b) - power(a))[0];
}

// ---- choosing a contract ----------------------------------------------------

/** The contract the kingdom holder should name for this hand. */
export function chooseContractFor(hands: Card[][], seat: Seat, remaining: Contract[]): Contract {
  return remaining.slice().sort((a, b) => fit(hands[seat], b) - fit(hands[seat], a))[0];
}

/** How well a hand suits a contract — also used to hint a human king. */
export function fit(hand: Card[], contract: Contract): number {
  const bySuit = groupBySuit(hand);
  const rankSum = hand.reduce((sum, card) => sum + power(card), 0);

  switch (contract) {
    case 'queens':
      return -25 * hand.filter((card) => card.rank === 12).length - rankSum / 20;
    case 'diamonds':
      return -10 * hand.filter((card) => card.suit === 'D').length - rankSum / 20;
    case 'kingOfHearts':
      return (hand.some((card) => card.id === 'H13') ? -75 : 0) - bySuit.H.length * 2;
    case 'tricks':
      return -rankSum / 4;
    default:
      return 10 * SUITS.reduce((sum, suit) => sum + longestRun(bySuit[suit]), 0) - rankSum / 40;
  }
}

/** The longest set of consecutive ranks in one suit — a rough shed potential. */
function longestRun(cards: Card[]): number {
  const powers = [...new Set(cards.map(power))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let previous = -2;
  for (const p of powers) {
    run = p === previous + 1 ? run + 1 : 1;
    previous = p;
    best = Math.max(best, run);
  }
  return best;
}
