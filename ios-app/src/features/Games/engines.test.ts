import { expect, test } from 'bun:test';
import { cards, engine2048, solitaire, tarneeb, tarneebAi, trix, trixAi, type Tile } from './engines';
const random = (seed: number): (() => number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const tile = (col: number, value: number): Tile => ({ id: col + 1, col, row: 0, value, fresh: false, merged: false, moved: false, merges: 0 });
test('native boundary runs original 2048 merge-once and score behavior', () => {
  const result = engine2048.move([tile(0, 2), tile(1, 2), tile(2, 2), tile(3, 2)], 'left');
  expect(result.tiles.map(t => [t.col, t.value])).toEqual([[0, 4], [1, 4]]);
  expect(result.gained).toBe(8);
  expect(result.absorbed).toHaveLength(2);
  expect(engine2048.move([tile(0, 4)], 'left').moved).toBe(false);
});
test('original deck, Klondike deal, stock and immutability survive native adapter', () => {
  expect(new Set(cards.createDeck().map(c => c.id)).size).toBe(52);
  const deal = solitaire.createDeal(random(1));
  expect(deal.tableau.map(column => column.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(deal.tableau.every(column => column.at(-1)?.faceUp)).toBe(true);
  expect(deal.stock).toHaveLength(24);
  const moved = solitaire.drawStock(deal);
  expect(moved.stock).toHaveLength(23);
  expect(moved.waste.at(-1)?.faceUp).toBe(true);
  expect(deal.waste).toHaveLength(0);
});
test('original Tarneeb AI completes deterministic rounds with exactly thirteen tricks', () => {
  for (let seed = 1; seed <= 12; seed++) {
    let round = tarneeb.createRound(undefined, 0, random(seed));
    let steps = 0;
    while (round.phase !== 'complete' && steps++ < 120) {
      const seat = round.turn;
      if (seat === null) throw new Error('Missing native turn');
      if (round.phase === 'bidding') { const bid = tarneebAi.chooseBid(round, seat); round = bid === null ? tarneeb.pass(round, seat) : tarneeb.bid(round, seat, bid); }
      else if (round.phase === 'trump') round = tarneeb.chooseTrump(round, seat, tarneebAi.chooseTrump(round, seat));
      else round = tarneeb.playCard(round, seat, tarneebAi.choosePlay(round, seat));
    }
    expect(round.phase).toBe('complete');
    if (!tarneeb.isRedeal(round)) { expect(round.tricks[0] + round.tricks[1]).toBe(13); expect(round.history).toHaveLength(13); expect(tarneeb.scoreRound(round).every(Number.isFinite)).toBe(true); }
  }
});
test('original Trix runs all twenty contracts without illegal moves through native types', () => {
  for (const teams of [false, true]) {
    const rng = random(19);
    let game = trix.createGame({ teams }, rng);
    let steps = 0;
    while (!game.complete && steps++ < 3000) {
      if (!game.hands && !game.deal) game = trix.beginDeal(game, rng);
      else if (game.hands) game = trix.chooseContract(game, trixAi.chooseContractFor(game.hands, trix.kingOf(game), game.remaining));
      else if (game.deal?.phase === 'complete') game = trix.finishDeal(game);
      else if (game.deal) { const seat = game.deal.contract === 'trix' ? game.deal.turn : game.deal.round.turn; const card = trixAi.choosePlay(game.deal, seat, game.options); game = { ...game, deal: card ? trix.playCard(game.deal, seat, card) : trix.pass(game.deal, seat) }; }
    }
    expect(game.complete).toBe(true);
    expect(game.history).toHaveLength(20);
    expect(game.scores.reduce((sum, score) => sum + score, 0)).toBe(0);
  }
});
