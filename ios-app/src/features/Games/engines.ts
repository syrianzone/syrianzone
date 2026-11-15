/* eslint-disable @typescript-eslint/no-require-imports */
// The source engines run unchanged. Narrow boundary types keep legacy web compiler settings out of the native strict project.
export type Suit = 'S' | 'H' | 'D' | 'C';
export interface Card { id: string; rank: number; suit: Suit; faceUp: boolean }
export const cards = require('../../../../resources/js/Domain/games/cards') as {
  RANK_LABEL: string[]; SUIT_LABEL: Record<Suit, string>; SUITS: Suit[]; PIP_LAYOUTS: Record<number, { x: number; y: number; flip?: boolean }[]>;
  isRed(card: Card): boolean; createDeck(): Card[]; shuffle<T>(items: T[], random?: () => number): T[];
};
export type Direction = 'up' | 'down' | 'left' | 'right';
export interface Tile { id: number; value: number; row: number; col: number; fresh: boolean; merged: boolean; moved: boolean; merges: number }
export interface AbsorbedTile { id: number; value: number; row: number; col: number; targetRow: number; targetCol: number }
export const engine2048 = require('../../../../resources/js/Pages/Games/_lib/engine2048') as {
  newBoard(id: () => number, random?: () => number): Tile[]; spawn(board: Tile[], id: () => number, random?: () => number): Tile[];
  move(board: Tile[], direction: Direction): { tiles: Tile[]; moved: boolean; gained: number; absorbed: AbsorbedTile[] };
  canMove(board: Tile[]): boolean; highestTile(board: Tile[]): number;
};
export interface Deal { stock: Card[]; waste: Card[]; foundations: Card[][]; tableau: Card[][] }
export type Source = { kind: 'waste' } | { kind: 'foundation'; index: number } | { kind: 'tableau'; column: number; cardIndex: number };
export type Destination = { kind: 'foundation'; index: number } | { kind: 'tableau'; column: number };
export interface SolitaireMove { from: Source; to: Destination }
export const solitaire = require('../../../../resources/js/Pages/Games/_lib/solitaire') as {
  createDeal(random?: () => number): Deal; liftable(deal: Deal, from: Source): Card[] | null; canMove(deal: Deal, from: Source, to: Destination): boolean;
  applyMove(deal: Deal, from: Source, to: Destination): Deal; drawStock(deal: Deal): Deal; canDraw(deal: Deal): boolean; isWon(deal: Deal): boolean;
  availableMoves(deal: Deal): SolitaireMove[]; autoMove(deal: Deal): Deal;
};
export interface Play { seat: number; card: Card }
export interface CompletedTrick { plays: Play[]; winner: number }
export interface TarneebOptions { target: number; minBid: number; maxBid: number; kaboot: number; kabootMade: number; kabootLoss: number; kabootDefence: number; sweepBonus: number }
export interface TarneebRound { options: TarneebOptions; dealer: number; hands: Card[][]; auction: { highBid: number | null; highSeat: number | null; actions: ({ seat: number; pass: true } | { seat: number; value: number })[] }; phase: 'bidding' | 'trump' | 'playing' | 'complete'; trump: Suit | null; declarer: number | null; turn: number | null; trick: Play[]; tricks: [number, number]; history: CompletedTrick[] }
export interface MatchState { options: { players: number; units: number[][]; target: number; dealer: number }; round: number; dealer: number; scores: number[]; winner: number | null }
export const matches = require('../../../../resources/js/Pages/Games/_lib/cardGames/match') as {
  createMatch(options: { players: number; units?: number[][]; target: number; dealer?: number }): MatchState;
  applyRound(match: MatchState, scores: number[]): MatchState; isMatchOver(match: MatchState): boolean;
};
export const tarneeb = require('../../../../resources/js/Pages/Games/_lib/tarneeb') as {
  DEFAULT_TARNEEB: TarneebOptions; TARNEEB_TEAMS: number[][];
  createRound(options?: TarneebOptions, dealer?: number, random?: () => number): TarneebRound; legalBids(round: TarneebRound): number[];
  bid(round: TarneebRound, seat: number, value: number): TarneebRound; pass(round: TarneebRound, seat: number): TarneebRound;
  chooseTrump(round: TarneebRound, seat: number, suit: Suit): TarneebRound; legalPlays(round: TarneebRound, seat: number): Card[];
  playCard(round: TarneebRound, seat: number, card: Card): TarneebRound; scoreRound(round: TarneebRound): [number, number]; isRedeal(round: TarneebRound): boolean; teamOf(seat: number): 0 | 1;
};
export const tarneebAi = require('../../../../resources/js/Pages/Games/_lib/tarneebAi') as { chooseBid(round: TarneebRound, seat: number): number | null; chooseTrump(round: TarneebRound, seat: number): Suit; choosePlay(round: TarneebRound, seat: number): Card };
export type Contract = 'queens' | 'diamonds' | 'tricks' | 'kingOfHearts' | 'trix';
export interface TrixOptions { teams: boolean }
export interface AvoidanceRound { players: number; hands: Card[][]; leader: number; turn: number; trick: Play[]; history: CompletedTrick[]; collected: Card[][] }
export type TrixDeal = { contract: Exclude<Contract, 'trix'>; round: AvoidanceRound; phase: 'playing' | 'complete' } | { contract: 'trix'; hands: Card[][]; layout: { runs: Partial<Record<Suit, { lo: number; hi: number }>>; laid: Partial<Record<Suit, number[]>> }; turn: number; out: number[]; phase: 'playing' | 'complete' };
export interface TrixGame { options: TrixOptions; firstKing: number; scores: number[]; kingdom: number; remaining: Contract[]; hands: Card[][] | null; deal: TrixDeal | null; complete: boolean; history: { contract: Contract; king: number; points: number[] }[] }
export const trix = require('../../../../resources/js/Pages/Games/_lib/trix') as {
  DEFAULT_TRIX: TrixOptions; CONTRACTS: Contract[]; CONTRACT_INFO: Record<Contract, { name: string; kind: 'avoid' | 'shed' }>;
  createGame(options?: TrixOptions, random?: () => number): TrixGame; beginDeal(game: TrixGame, random?: () => number): TrixGame;
  chooseContract(game: TrixGame, contract: Contract): TrixGame; finishDeal(game: TrixGame): TrixGame; kingOf(game: TrixGame): number;
  legalPlays(deal: TrixDeal, seat: number): Card[]; playCard(deal: TrixDeal, seat: number, card: Card): TrixDeal; pass(deal: TrixDeal, seat: number): TrixDeal;
  standings(game: TrixGame): { totals: number[]; winner: number | null }; scoreDeal(deal: TrixDeal): number[];
};
export const trixAi = require('../../../../resources/js/Pages/Games/_lib/trixAi') as { chooseContractFor(hands: Card[][], seat: number, remaining: Contract[]): Contract; choosePlay(deal: TrixDeal, seat: number, options: TrixOptions): Card | null };
// PORT STATUS: source resources/js/Pages/Games/_lib/* and resources/js/Domain/games/cards.ts; confidence medium; todos 1 boundary declarations covered by source characterization tests.
