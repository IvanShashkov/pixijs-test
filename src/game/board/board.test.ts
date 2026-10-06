import { describe, expect, it } from 'vitest';
import { at, clone, createBoard, fromRows, idx, inBounds, toRows } from './board';
import { DEFAULT_RULES } from './index';
import { findMatches } from './matches';
import { hasValidMove } from './moves';
import { mulberry32 } from './rng';

describe('board helpers', () => {
  const b = fromRows([
    [0, 1, 2],
    [3, 4, 5],
  ]);

  it('round-trips rows', () => {
    expect(toRows(b)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);
    expect(b.rows).toBe(2);
    expect(b.cols).toBe(3);
  });

  it('indexes row-major', () => {
    expect(idx(b, 1, 2)).toBe(5);
    expect(at(b, 1, 0)).toBe(3);
    expect(at(b, 5, 5)).toBe(-1);
  });

  it('checks bounds', () => {
    expect(inBounds(b, 0, 0)).toBe(true);
    expect(inBounds(b, 1, 2)).toBe(true);
    expect(inBounds(b, 2, 0)).toBe(false);
    expect(inBounds(b, 0, -1)).toBe(false);
  });

  it('clones deeply', () => {
    const c = clone(b);
    c.cells[0] = 9;
    expect(at(b, 0, 0)).toBe(0);
  });

  it('rejects ragged rows', () => {
    expect(() => fromRows([[0, 1], [0]])).toThrow();
  });
});

describe('createBoard', () => {
  it('produces valid boards for many seeds', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const b = createBoard(DEFAULT_RULES, mulberry32(seed));
      expect(b.rows).toBe(DEFAULT_RULES.rows);
      expect(b.cols).toBe(DEFAULT_RULES.cols);
      expect(b.cells.length).toBe(64);
      for (const g of b.cells) {
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThan(DEFAULT_RULES.gemCount);
      }
      expect(findMatches(b)).toEqual([]);
      expect(hasValidMove(b)).toBe(true);
    }
  });

  it('is deterministic per seed', () => {
    expect(createBoard(DEFAULT_RULES, mulberry32(5))).toEqual(
      createBoard(DEFAULT_RULES, mulberry32(5)),
    );
  });

  it('rejects too few gem kinds', () => {
    expect(() => createBoard({ ...DEFAULT_RULES, gemCount: 3 }, mulberry32(1))).toThrow();
  });
});
