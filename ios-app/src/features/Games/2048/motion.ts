import { engine2048, type AbsorbedTile, type Direction, type Tile } from '../engines';

// Source timings and keyframes: resources/js/Pages/Games/2048/styles.css.
export const MOTION_2048 = { slide: 140, spawn: 160, pop: 200, fade: 160, ghostLifetime: 320, popPeak: 1.22, ghostScale: 0.35 } as const;
export interface Round2048 {
  board: Tile[];
  score: number;
  phase: 'playing' | 'won' | 'lost';
  continuing: boolean;
  ghosts: AbsorbedTile[];
  ghostRevision: number;
}

export function newRound(nextId: () => number, random = Math.random): Round2048 {
  return { board: engine2048.newBoard(nextId, random), score: 0, phase: 'playing', continuing: false, ghosts: [], ghostRevision: 0 };
}

export function advanceRound(current: Round2048, direction: Direction, nextId: () => number, random = Math.random): Round2048 {
  if (current.phase !== 'playing') return current;
  const result = engine2048.move(current.board, direction);
  if (!result.moved) return current;
  const board = engine2048.spawn(result.tiles, nextId, random);
  return { ...current, board, score: current.score + result.gained,
    phase: !current.continuing && engine2048.highestTile(board) >= 2048 ? 'won' : engine2048.canMove(board) ? 'playing' : 'lost',
    ghosts: result.absorbed.length ? [...current.ghosts, ...result.absorbed] : current.ghosts,
    ghostRevision: current.ghostRevision + (result.absorbed.length ? 1 : 0) };
}

export function continueRound(current: Round2048): Round2048 {
  return { ...current, continuing: true, phase: engine2048.canMove(current.board) ? 'playing' : 'lost' };
}

export function clearGhosts(current: Round2048): Round2048 {
  return current.ghosts.length ? { ...current, ghosts: [] } : current;
}

export function describeTileMotion(tile: Tile, reducedMotion: boolean): { kind: 'spawn' | 'merge' | 'none'; key: string; delay: number; duration: number } {
  const kind = tile.fresh ? 'spawn' : tile.merged ? 'merge' : 'none';
  const key = kind === 'merge' ? `merge:${tile.id}:${tile.merges}` : `${kind}:${tile.id}`;
  return reducedMotion ? { kind: 'none', key, delay: 0, duration: 0 }
    : { kind, key, delay: kind === 'merge' && tile.moved ? MOTION_2048.slide : 0, duration: kind === 'spawn' ? MOTION_2048.spawn : kind === 'merge' ? MOTION_2048.pop : 0 };
}

export function boardGeometry(size: number): { padding: number; gap: number; cell: number; pitch: number } {
  const padding = 4, gap = 4, cell = (size - padding * 2 - gap * 3) / 4;
  return { padding, gap, cell, pitch: cell + gap };
}

// PORT STATUS: source resources/js/Pages/Games/_components/Game2048.tsx and 2048/styles.css; confidence high; todos 0.
