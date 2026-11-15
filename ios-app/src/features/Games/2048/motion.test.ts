import { expect, test } from 'bun:test';
import type { Tile } from '../engines';
import { advanceRound, boardGeometry, clearGhosts, continueRound, describeTileMotion, newRound, type Round2048 } from './motion';

const tile = (id: number, value: number, row: number, col: number): Tile => ({ id, value, row, col, fresh: false, merged: false, moved: false, merges: 0 });
const round = (board: Tile[]): Round2048 => ({ board, score: 0, phase: 'playing', continuing: false, ghosts: [], ghostRevision: 0 });

test('a moving merge preserves the survivor ID and slides the absorbed tile to its actual landing cell', () => {
  const before = round([tile(1, 2, 0, 2), tile(2, 2, 0, 3)]);
  const next = advanceRound(before, 'left', () => 100, () => 0);
  expect(next.board.find(row => row.id === 1)).toMatchObject({ id: 1, value: 4, row: 0, col: 0, merges: 1, merged: true, moved: true });
  expect(next.board.some(row => row.id === 2)).toBe(false);
  expect(next.ghosts).toEqual([{ id: 2, value: 2, row: 0, col: 3, targetRow: 0, targetCol: 0 }]);
  expect(next.board.find(row => row.id === 100)).toMatchObject({ fresh: true, value: 2 });
  expect(next.score).toBe(4);
  expect(describeTileMotion(next.board.find(row => row.id === 1)!, false)).toEqual({ kind: 'merge', key: 'merge:1:1', delay: 140, duration: 200 });
  expect(before.board.map(row => row.col)).toEqual([2, 3]);
});

test('stationary merges pop at once and consecutive merges on one ID replay through the merge counter', () => {
  let id = 100;
  const first = advanceRound(round([tile(1, 2, 0, 0), tile(2, 2, 0, 1), tile(3, 4, 0, 2)]), 'left', () => id++, () => 0);
  const second = advanceRound(first, 'left', () => id++, () => 0);
  expect(describeTileMotion(first.board.find(row => row.id === 1)!, false)).toEqual({ kind: 'merge', key: 'merge:1:1', delay: 0, duration: 200 });
  expect(describeTileMotion(second.board.find(row => row.id === 1)!, false)).toEqual({ kind: 'merge', key: 'merge:1:2', delay: 0, duration: 200 });
  expect(second.board.find(row => row.id === 1)?.value).toBe(8);
  expect(second.score).toBe(12);
  expect(second.ghosts.map(row => row.id)).toEqual([2, 3]);
  expect(second.ghostRevision).toBe(2);
});

test('spawn and reduced-motion descriptions preserve event identity without replaying motion', () => {
  let id = 1;
  const initial = newRound(() => id++, () => 0);
  expect(initial.board).toHaveLength(2);
  expect(describeTileMotion(initial.board[0]!, false)).toEqual({ kind: 'spawn', key: 'spawn:1', delay: 0, duration: 160 });
  expect(describeTileMotion(initial.board[0]!, true)).toEqual({ kind: 'none', key: 'spawn:1', delay: 0, duration: 0 });
  const merged = { ...tile(9, 8, 2, 1), merged: true, moved: true, merges: 3 };
  expect(describeTileMotion(merged, true)).toEqual({ kind: 'none', key: 'merge:9:3', delay: 0, duration: 0 });
});

test('legal moves compose while earlier ghosts survive and settling cannot overwrite the latest board', () => {
  let id = 3;
  const left = advanceRound(round([tile(1, 2, 0, 0), tile(2, 2, 0, 1)]), 'left', () => id++, () => 0);
  const right = advanceRound(left, 'right', () => id++, () => 0);
  const settled = clearGhosts(right);
  expect(right.board.find(row => row.id === 1)).toMatchObject({ col: 2, value: 4 });
  expect(right.ghosts.map(row => row.id)).toEqual([2]);
  expect(right.ghostRevision).toBe(left.ghostRevision);
  expect(settled.board).toBe(right.board);
  expect(settled.score).toBe(4);
  expect(settled.ghosts).toEqual([]);
  expect(clearGhosts(settled)).toBe(settled);
});

test('illegal swipes and terminal overlays never spawn or change tile identities', () => {
  const before = round([tile(1, 2, 0, 0)]);
  const never = () => { throw new Error('No spawn is allowed.'); };
  expect(advanceRound(before, 'left', never, never)).toBe(before);
  const won = { ...before, phase: 'won' as const };
  expect(advanceRound(won, 'right', never, never)).toBe(won);
  expect(continueRound(won)).toMatchObject({ phase: 'playing', continuing: true });
  expect(advanceRound({ ...before, phase: 'lost' }, 'right', never, never).phase).toBe('lost');
});

test('resizing keeps four equal cells, symmetric insets and the source left-to-right column ordering', () => {
  for (const size of [284, 357, 440]) {
    const grid = boardGeometry(size);
    expect(grid.padding * 2 + grid.cell * 4 + grid.gap * 3).toBe(size);
    expect(grid.pitch).toBe(grid.cell + grid.gap);
    expect(grid.padding + 3 * grid.pitch + grid.cell).toBe(size - grid.padding);
  }
});
