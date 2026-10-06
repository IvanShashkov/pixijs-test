import { BOARD } from '../../config';
import { hasValidMove } from './moves';
import { rngInt } from './rng';
import type { Board, BoardRules, Rng } from './types';

export function idx(b: Board, r: number, c: number): number {
  return r * b.cols + c;
}

export function at(b: Board, r: number, c: number): number {
  return b.cells[r * b.cols + c] ?? -1;
}

export function inBounds(b: Board, r: number, c: number): boolean {
  return r >= 0 && r < b.rows && c >= 0 && c < b.cols;
}

export function clone(b: Board): Board {
  return { rows: b.rows, cols: b.cols, cells: b.cells.slice() };
}

export function fromRows(rows: number[][]): Board {
  const cols = rows[0]?.length ?? 0;
  for (const row of rows) {
    if (row.length !== cols) throw new Error('fromRows: ragged rows');
  }
  return { rows: rows.length, cols, cells: rows.flat() };
}

export function toRows(b: Board): number[][] {
  const out: number[][] = [];
  for (let r = 0; r < b.rows; r++) out.push(b.cells.slice(r * b.cols, (r + 1) * b.cols));
  return out;
}

/**
 * Fill a board with no initial matches and at least one valid move.
 * For each cell the gem that would complete a run of 3 to the left or above is excluded.
 */
export function createBoard(rules: BoardRules, rng: Rng): Board {
  if (rules.gemCount < BOARD.minGemCount) {
    throw new Error(`createBoard: gemCount must be >= ${BOARD.minGemCount}`);
  }
  const { rows, cols, gemCount } = rules;
  for (let attempt = 0; attempt < 100; attempt++) {
    const cells = new Array<number>(rows * cols).fill(-1);
    const board: Board = { rows, cols, cells };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const left =
          c >= 2 && cells[idx(board, r, c - 1)] === cells[idx(board, r, c - 2)]
            ? cells[idx(board, r, c - 1)]
            : -1;
        const up =
          r >= 2 && cells[idx(board, r - 1, c)] === cells[idx(board, r - 2, c)]
            ? cells[idx(board, r - 1, c)]
            : -1;
        const candidates: number[] = [];
        for (let g = 0; g < gemCount; g++) if (g !== left && g !== up) candidates.push(g);
        cells[idx(board, r, c)] = candidates[rngInt(rng, candidates.length)]!;
      }
    }
    if (hasValidMove(board)) return board;
  }
  throw new Error('createBoard: could not produce a board with a valid move');
}
