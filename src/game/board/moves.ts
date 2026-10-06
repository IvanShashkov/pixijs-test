import { at, clone, inBounds } from './board';
import { matchesAt } from './matches';
import type { Board, Cell, Move } from './types';

export function areAdjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

/** Pure swap of two cells; returns a new board. */
export function swapCells(b: Board, a: Cell, c: Cell): Board {
  const out = clone(b);
  const ia = a.r * b.cols + a.c;
  const ic = c.r * b.cols + c.c;
  const tmp = out.cells[ia]!;
  out.cells[ia] = out.cells[ic]!;
  out.cells[ic] = tmp;
  return out;
}

/** Adjacent, both occupied, and swapping produces a match at either cell. */
export function isValidSwap(b: Board, a: Cell, c: Cell): boolean {
  if (!inBounds(b, a.r, a.c) || !inBounds(b, c.r, c.c)) return false;
  if (!areAdjacent(a, c)) return false;
  if (at(b, a.r, a.c) < 0 || at(b, c.r, c.c) < 0) return false;
  const swapped = swapCells(b, a, c);
  return matchesAt(swapped, a) || matchesAt(swapped, c);
}

function scanMoves(b: Board, stopAtFirst: boolean): Move[] {
  const scratch = clone(b);
  const cells = scratch.cells;
  const moves: Move[] = [];
  const test = (a: Cell, c: Cell): boolean => {
    const ia = a.r * b.cols + a.c;
    const ic = c.r * b.cols + c.c;
    if (cells[ia]! < 0 || cells[ic]! < 0) return false;
    const tmp = cells[ia]!;
    cells[ia] = cells[ic]!;
    cells[ic] = tmp;
    const ok = matchesAt(scratch, a) || matchesAt(scratch, c);
    cells[ic] = cells[ia]!;
    cells[ia] = tmp;
    return ok;
  };
  for (let r = 0; r < b.rows; r++) {
    for (let c = 0; c < b.cols; c++) {
      const a = { r, c };
      if (c + 1 < b.cols && test(a, { r, c: c + 1 })) {
        moves.push({ a, b: { r, c: c + 1 } });
        if (stopAtFirst) return moves;
      }
      if (r + 1 < b.rows && test(a, { r: r + 1, c })) {
        moves.push({ a, b: { r: r + 1, c } });
        if (stopAtFirst) return moves;
      }
    }
  }
  return moves;
}

/** Every adjacent pair (right and down partners, each once) whose swap yields a match. */
export function findValidMoves(b: Board): Move[] {
  return scanMoves(b, false);
}

export function hasValidMove(b: Board): boolean {
  return scanMoves(b, true).length > 0;
}
