import { clone, idx } from './board';
import { rngInt } from './rng';
import type { Board, BoardRules, Fall, Rng, Spawn } from './types';

/** Collapse every column downward. Returns the fall moves (from → to) for occupied cells. */
export function applyGravity(b: Board): { board: Board; falls: Fall[] } {
  const board = clone(b);
  const falls: Fall[] = [];
  for (let c = 0; c < b.cols; c++) {
    let w = b.rows - 1;
    for (let r = b.rows - 1; r >= 0; r--) {
      const gem = board.cells[idx(board, r, c)]!;
      if (gem < 0) continue;
      if (w !== r) {
        falls.push({ from: { r, c }, to: { r: w, c }, gem });
        board.cells[idx(board, w, c)] = gem;
        board.cells[idx(board, r, c)] = -1;
      }
      w--;
    }
  }
  return { board, falls };
}

/**
 * Fill empty cells (assumed at the top of each column after gravity) with random gems.
 * Consumption order: column-major, top → bottom. `spawnOffset = n - r` so every new tile in a
 * column falls exactly `n` rows.
 */
export function refill(b: Board, rules: BoardRules, rng: Rng): { board: Board; spawns: Spawn[] } {
  const board = clone(b);
  const spawns: Spawn[] = [];
  for (let c = 0; c < b.cols; c++) {
    let n = 0;
    for (let r = 0; r < b.rows; r++) if (board.cells[idx(board, r, c)]! < 0) n++;
    for (let r = 0; r < b.rows; r++) {
      const i = idx(board, r, c);
      if (board.cells[i]! >= 0) continue;
      const gem = rngInt(rng, rules.gemCount);
      board.cells[i] = gem;
      spawns.push({ cell: { r, c }, gem, spawnOffset: n - r });
    }
  }
  return { board, spawns };
}
