import { describe, expect, it } from 'vitest';
import { fromRows } from './board';
import { findMatches, matchesAt } from './matches';

const cells = (g: { cells: { r: number; c: number }[] }) => g.cells.map((c) => `${c.r},${c.c}`);

describe('findMatches', () => {
  it('finds a horizontal 3', () => {
    const b = fromRows([
      [1, 1, 1, 2],
      [2, 3, 4, 5],
    ]);
    const m = findMatches(b);
    expect(m).toHaveLength(1);
    expect(m[0]!.gem).toBe(1);
    expect(cells(m[0]!)).toEqual(['0,0', '0,1', '0,2']);
  });

  it('finds a vertical 3', () => {
    const b = fromRows([
      [1, 2],
      [1, 3],
      [1, 4],
      [2, 5],
    ]);
    const m = findMatches(b);
    expect(m).toHaveLength(1);
    expect(cells(m[0]!)).toEqual(['0,0', '1,0', '2,0']);
  });

  it('keeps 4- and 5-runs as single groups', () => {
    const b4 = fromRows([[1, 1, 1, 1, 2]]);
    expect(findMatches(b4)[0]!.cells).toHaveLength(4);
    const b5 = fromRows([[1, 1, 1, 1, 1]]);
    const m5 = findMatches(b5);
    expect(m5).toHaveLength(1);
    expect(cells(m5[0]!)).toEqual(['0,0', '0,1', '0,2', '0,3', '0,4']);
  });

  it('merges an L shape into one group', () => {
    const b = fromRows([
      [1, 2, 3],
      [1, 4, 5],
      [1, 1, 1],
    ]);
    const m = findMatches(b);
    expect(m).toHaveLength(1);
    expect(cells(m[0]!)).toEqual(['0,0', '1,0', '2,0', '2,1', '2,2']);
  });

  it('merges a T shape into one group', () => {
    const b = fromRows([
      [1, 1, 1],
      [2, 1, 3],
      [4, 1, 5],
    ]);
    const m = findMatches(b);
    expect(m).toHaveLength(1);
    expect(m[0]!.cells).toHaveLength(5);
  });

  it('merges a plus shape into one group', () => {
    const b = fromRows([
      [2, 1, 3],
      [1, 1, 1],
      [4, 1, 5],
    ]);
    const m = findMatches(b);
    expect(m).toHaveLength(1);
    expect(m[0]!.cells).toHaveLength(5);
  });

  it('keeps disjoint same-gem runs separate', () => {
    const b = fromRows([
      [1, 1, 1, 2, 3],
      [2, 3, 4, 5, 2],
      [1, 1, 1, 3, 4],
    ]);
    const m = findMatches(b);
    expect(m).toHaveLength(2);
    expect(m[0]!.cells[0]).toEqual({ r: 0, c: 0 });
    expect(m[1]!.cells[0]).toEqual({ r: 2, c: 0 });
  });

  it('keeps corner-touching runs separate', () => {
    // Horizontal run in row 0 cols 0-2 and vertical run in col 3 rows 1-3 touch only diagonally.
    const b = fromRows([
      [1, 1, 1, 2],
      [2, 3, 4, 1],
      [3, 4, 5, 1],
      [4, 5, 2, 1],
    ]);
    const m = findMatches(b);
    expect(m).toHaveLength(2);
  });

  it('separates adjacent runs of different gems', () => {
    const b = fromRows([
      [1, 1, 1],
      [2, 2, 2],
    ]);
    const m = findMatches(b);
    expect(m).toHaveLength(2);
    expect(m[0]!.gem).toBe(1);
    expect(m[1]!.gem).toBe(2);
  });

  it('never matches empty cells', () => {
    const b = fromRows([
      [-1, -1, -1],
      [0, 1, 2],
    ]);
    expect(findMatches(b)).toEqual([]);
    expect(matchesAt(b, { r: 0, c: 0 })).toBe(false);
  });

  it('returns [] when there is nothing', () => {
    const b = fromRows([
      [0, 1, 0],
      [1, 0, 1],
      [0, 1, 0],
    ]);
    expect(findMatches(b)).toEqual([]);
  });

  it('has no duplicate cells in a group', () => {
    const b = fromRows([
      [1, 1, 1, 1, 1],
      [1, 2, 1, 2, 1],
      [1, 2, 1, 2, 1],
    ]);
    const m = findMatches(b);
    expect(m).toHaveLength(1);
    const set = new Set(cells(m[0]!));
    expect(set.size).toBe(m[0]!.cells.length);
    expect(set.size).toBe(11);
  });
});

describe('matchesAt', () => {
  it('detects membership in a run', () => {
    const b = fromRows([
      [1, 1, 1],
      [2, 3, 4],
    ]);
    expect(matchesAt(b, { r: 0, c: 1 })).toBe(true);
    expect(matchesAt(b, { r: 1, c: 1 })).toBe(false);
  });
});
