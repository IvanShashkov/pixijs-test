import { describe, expect, it } from 'vitest';
import { createBoard, fromRows, toRows } from './board';
import { trySwap } from './cascade';
import { DEFAULT_RULES } from './index';
import { findMatches } from './matches';
import { areAdjacent, findValidMoves, hasValidMove, isValidSwap, swapCells } from './moves';
import { mulberry32 } from './rng';
import type { Board, Move } from './types';

describe('areAdjacent', () => {
  it('accepts orthogonal neighbours only', () => {
    expect(areAdjacent({ r: 0, c: 0 }, { r: 0, c: 1 })).toBe(true);
    expect(areAdjacent({ r: 0, c: 0 }, { r: 1, c: 0 })).toBe(true);
    expect(areAdjacent({ r: 0, c: 0 }, { r: 1, c: 1 })).toBe(false);
    expect(areAdjacent({ r: 0, c: 0 }, { r: 0, c: 0 })).toBe(false);
  });
});

describe('swapCells', () => {
  it('is pure', () => {
    const b = fromRows([[0, 1]]);
    const s = swapCells(b, { r: 0, c: 0 }, { r: 0, c: 1 });
    expect(toRows(s)).toEqual([[1, 0]]);
    expect(toRows(b)).toEqual([[0, 1]]);
  });
});

describe('isValidSwap', () => {
  const b = fromRows([
    [1, 2, 1, 1],
    [3, 4, 5, 2],
    [0, 0, 3, 0],
  ]);

  it('accepts a swap that makes a match', () => {
    expect(isValidSwap(b, { r: 0, c: 1 }, { r: 1, c: 1 })).toBe(false);
    expect(isValidSwap(b, { r: 0, c: 0 }, { r: 0, c: 1 })).toBe(true);
  });

  it('rejects adjacent swaps without a match', () => {
    expect(isValidSwap(b, { r: 1, c: 0 }, { r: 1, c: 1 })).toBe(false);
  });

  it('rejects non-adjacent and out-of-bounds swaps', () => {
    expect(isValidSwap(b, { r: 0, c: 0 }, { r: 0, c: 2 })).toBe(false);
    expect(isValidSwap(b, { r: 0, c: 0 }, { r: 0, c: 0 })).toBe(false);
    expect(isValidSwap(b, { r: 0, c: 0 }, { r: -1, c: 0 })).toBe(false);
  });

  it('rejects swaps involving empty cells', () => {
    const e = fromRows([
      [-1, 1, 1],
      [1, 2, 3],
    ]);
    expect(isValidSwap(e, { r: 0, c: 0 }, { r: 1, c: 0 })).toBe(false);
  });
});

describe('findValidMoves', () => {
  const bruteForce = (b: Board): Move[] => {
    const moves: Move[] = [];
    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        const a = { r, c };
        for (const p of [
          { r, c: c + 1 },
          { r: r + 1, c },
        ]) {
          if (p.r >= b.rows || p.c >= b.cols) continue;
          if (findMatches(swapCells(b, a, p)).length > 0) moves.push({ a, b: p });
        }
      }
    }
    return moves;
  };

  it('matches brute force on seeded boards', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const b = createBoard(DEFAULT_RULES, mulberry32(seed));
      expect(findValidMoves(b)).toEqual(bruteForce(b));
    }
  });

  it('finds none on a move-less 4-colour pattern', () => {
    // Rows cycle through 4 colours, columns alternate 2: no run of 3 can be formed by any swap.
    const rows = Array.from({ length: 8 }, (_, r) =>
      Array.from({ length: 8 }, (_, c) => (c + 2 * r) % 4),
    );
    const b = fromRows(rows);
    expect(findMatches(b)).toEqual([]);
    expect(findValidMoves(b)).toEqual([]);
    expect(hasValidMove(b)).toBe(false);
  });

  it('hasValidMove agrees with findValidMoves', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const b = createBoard(DEFAULT_RULES, mulberry32(seed));
      expect(hasValidMove(b)).toBe(findValidMoves(b).length > 0);
    }
  });
});

describe('trySwap producing two matches', () => {
  it('yields two groups in step 0', () => {
    // Swap (1,1)<->(1,2): col 1 = 2,2,2,5 → match of 2s; col 2 = 3,3,3,4 → match of 3s.
    const dbl = fromRows([
      [1, 2, 3, 2],
      [4, 3, 2, 3],
      [1, 2, 3, 2],
      [5, 5, 4, 4],
    ]);
    const out = trySwap(dbl, { r: 1, c: 1 }, { r: 1, c: 2 }, DEFAULT_RULES, mulberry32(1));
    expect(out.valid).toBe(true);
    if (!out.valid) return;
    expect(out.steps[0]!.matches).toHaveLength(2);
    expect(out.steps[0]!.comboIndex).toBe(0);
    expect(out.steps[0]!.multiplier).toBe(1);
    expect(out.steps[0]!.clearedCells).toHaveLength(6);
  });
});
