// 2048 rules, kept free of React so the board component only owns animation
// and storage. The board is a flat list of tiles rather than a 4x4 matrix:
// every tile carries a stable id, which is what lets React animate a slide
// (same DOM node, changed transform) instead of snapping values around.

export const SIZE = 4;
export const TARGET = 2048;

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  /** Spawned by the last move — replays the appear animation. */
  fresh: boolean;
  /** Absorbed a follower by the last move — replays the pop on landing. */
  merged: boolean;
  /** Relocated by the last move. A merge that did not travel pops at once. */
  moved: boolean;
  /**
   * How many followers this tile has absorbed. A tile that merges on two runs
   * in a row keeps its id and its `merged` flag, so the UI keys the tile's face
   * on this counter to force the pop to replay.
   */
  merges: number;
}

/** A tile eaten by a merge. The UI slides it into its killer, then fades it. */
export interface AbsorbedTile {
  id: number;
  value: number;
  /** Cell it started in. */
  row: number;
  col: number;
  /** Cell the surviving tile ended in. */
  targetRow: number;
  targetCol: number;
}

export interface MoveResult {
  tiles: Tile[];
  absorbed: AbsorbedTile[];
  moved: boolean;
  gained: number;
}

export function emptyBoard(): Tile[] {
  return [];
}

function lineIndex(dir: Direction, i: number): number[] {
  // Cells of line i, ordered from the edge the tiles travel toward.
  const out: number[] = [];
  for (let k = 0; k < SIZE; k++) {
    if (dir === 'left') out.push(i * SIZE + k);
    else if (dir === 'right') out.push(i * SIZE + (SIZE - 1 - k));
    else if (dir === 'up') out.push(k * SIZE + i);
    else out.push((SIZE - 1 - k) * SIZE + i);
  }
  return out;
}

function isEmpty(board: Tile[], cell: number): boolean {
  return !board.some((t) => t.row * SIZE + t.col === cell);
}

/** Append a 2 (90%) or a 4 (10%) to a random empty cell. No-op when full. */
export function spawn(board: Tile[], nextId: () => number, random: () => number = Math.random): Tile[] {
  const free: number[] = [];
  for (let cell = 0; cell < SIZE * SIZE; cell++) {
    if (isEmpty(board, cell)) free.push(cell);
  }
  if (free.length === 0) return board;
  const cell = free[Math.floor(random() * free.length)];
  return [
    ...board,
    {
      id: nextId(),
      value: random() < 0.9 ? 2 : 4,
      row: Math.floor(cell / SIZE),
      col: cell % SIZE,
      fresh: true,
      merged: false,
      moved: false,
      merges: 0,
    },
  ];
}

/** A fresh game: two starting tiles, as in the original. */
export function newBoard(nextId: () => number, random: () => number = Math.random): Tile[] {
  return spawn(spawn([], nextId, random), nextId, random);
}

/** Slide and merge every line. A tile may merge at most once per move. */
export function move(board: Tile[], dir: Direction): MoveResult {
  const next: Tile[] = [];
  // Followers that got eaten, paired with the id of the tile that ate them.
  const eaten: Array<{ tile: Tile; by: number }> = [];
  let moved = false;
  let gained = 0;

  for (let i = 0; i < SIZE; i++) {
    const cells = lineIndex(dir, i);
    const line = cells
      .map((cell) => board.find((t) => t.row * SIZE + t.col === cell))
      .filter((t): t is Tile => t !== undefined);

    const packed: Tile[] = [];
    for (let k = 0; k < line.length; k++) {
      const cur = line[k];
      const follower = line[k + 1];
      if (follower && follower.value === cur.value) {
        packed.push({
          ...cur,
          value: cur.value * 2,
          fresh: false,
          merged: true,
          merges: cur.merges + 1,
        });
        eaten.push({ tile: follower, by: cur.id });
        gained += cur.value * 2;
        k++;
        moved = true;
      } else {
        packed.push({ ...cur, fresh: false, merged: false });
      }
    }

    packed.forEach((tile, k) => {
      const cell = cells[k];
      const row = Math.floor(cell / SIZE);
      const col = cell % SIZE;
      const travelled = row !== tile.row || col !== tile.col;
      if (travelled) moved = true;
      next.push({ ...tile, row, col, moved: travelled });
    });
  }

  return {
    tiles: next,
    absorbed: eaten.flatMap(({ tile, by }) => {
      const target = next.find((t) => t.id === by);
      if (!target) return [];
      return [{
        id: tile.id,
        value: tile.value,
        row: tile.row,
        col: tile.col,
        targetRow: target.row,
        targetCol: target.col,
      }];
    }),
    moved,
    gained,
  };
}

/** A board is stuck only when it is full and no two neighbours match. */
export function canMove(board: Tile[]): boolean {
  if (board.length < SIZE * SIZE) return true;
  return board.some((t) => {
    const right = board.find((x) => x.row === t.row && x.col === t.col + 1);
    const below = board.find((x) => x.row === t.row + 1 && x.col === t.col);
    return (right && right.value === t.value) || (below && below.value === t.value);
  });
}

export function highestTile(board: Tile[]): number {
  return board.reduce((max, t) => Math.max(max, t.value), 0);
}

/** Aspect-based tile palette — the 2→2048 ramp every 2048 clone uses. */
export const TILE_CLASS: Record<number, string> = {
  2: 'bg-[#eee4da] text-[#776e65]',
  4: 'bg-[#ede0c8] text-[#776e65]',
  8: 'bg-[#f2b179] text-[#f9f6f2]',
  16: 'bg-[#f59563] text-[#f9f6f2]',
  32: 'bg-[#f67c5f] text-[#f9f6f2]',
  64: 'bg-[#f65e3b] text-[#f9f6f2]',
  128: 'bg-[#edcf72] text-[#f9f6f2] shadow-[0_0_12px_rgba(237,207,114,0.55)]',
  256: 'bg-[#edcc61] text-[#f9f6f2] shadow-[0_0_14px_rgba(237,204,97,0.6)]',
  512: 'bg-[#edc850] text-[#f9f6f2] shadow-[0_0_16px_rgba(237,200,80,0.65)]',
  1024: 'bg-[#edc53f] text-[#f9f6f2] shadow-[0_0_18px_rgba(237,197,63,0.7)]',
  2048: 'bg-[#edc22e] text-[#f9f6f2] shadow-[0_0_22px_rgba(237,194,46,0.8)]',
};

export function tileClass(value: number): string {
  return TILE_CLASS[value] ?? 'bg-[#3c3a32] text-[#f9f6f2]';
}

/** Long values need a smaller face to stay inside the tile. */
export function tileFontClass(value: number): string {
  if (value >= 1024) return 'text-xl sm:text-2xl';
  if (value >= 128) return 'text-2xl sm:text-3xl';
  return 'text-3xl sm:text-4xl';
}
