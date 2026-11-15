import type { Card, Suit } from '../engines';

export interface SheddingColumn { suit: Suit; cards: { index: number; card: Card }[] }
export function sheddingColumns(laid: Partial<Record<Suit, readonly number[]>>): SheddingColumn[] {
  return (['S', 'H', 'D', 'C'] as const).map(suit => {
    const powers = new Set(laid[suit] ?? []);
    return { suit, cards: Array.from({ length: 13 }, (_, index) => ({ index, power: 14 - index }))
      .filter(slot => powers.has(slot.power))
      .map(({ index, power }) => ({ index, card: { id: `${suit}${power}`, rank: power === 14 ? 1 : power, suit, faceUp: true } })) };
  });
}
// PORT STATUS: source resources/js/Pages/Games/_components/Trix.tsx Layout; confidence high; todos 0.
