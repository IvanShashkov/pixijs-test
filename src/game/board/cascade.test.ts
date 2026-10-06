import { describe, expect, it } from 'vitest';
import { createBoard, fromRows, toRows } from './board';
import { resolveCascades, trySwap } from './cascade';
import { applyGravity, refill } from './gravity';
import { DEFAULT_RULES } from './index';
import { findMatches } from './matches';
import { mulberry32 } from './rng';
import type { Rng } from './types';

const seq = (values: number[]): Rng => {
  let i = 0;
  return () => values[i++ % values.length]! / DEFAULT_RULES.gemCount + 1e-9;
};

describe('resolveCascades', () => {
  it('resolves a crafted two-step cascade with correct accounting', () => {
    // Only the bottom row matches. After clearing it, gravity leaves row 0 empty; feeding the
    // refill gems 2,2,2 makes row 0 a second match (combo 1).
    const start = fromRows([
      [2, 5, 2],
      [3, 2, 4],
      [1, 1, 1],
    ]);
    const { steps, totalScore, board } = resolveCascades(
      start,
      DEFAULT_RULES,
      seq([2, 2, 2, 0, 3]),
    );
    expect(steps).toHaveLength(2);
    expect(steps[0]!.comboIndex).toBe(0);
    expect(steps[0]!.multiplier).toBe(1);
    expect(steps[0]!.scoreDelta).toBe(30);
    expect(steps[0]!.clearedCells).toEqual([
      { r: 2, c: 0 },
      { r: 2, c: 1 },
      { r: 2, c: 2 },
    ]);
    expect(steps[1]!.comboIndex).toBe(1);
    expect(steps[1]!.multiplier).toBe(2);
    expect(steps[1]!.scoreDelta).toBe(60);
    expect(totalScore).toBe(90);
    expect(findMatches(board)).toEqual([]);
    expect(toRows(board)).toEqual(toRows(steps[1]!.board));
  });

  it('each step board equals manual clear → gravity → refill', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rngA = mulberry32(seed);
      const rngB = mulberry32(seed);
      // Build a board with a guaranteed match by planting a row.
      const base = createBoard(DEFAULT_RULES, mulberry32(seed + 1000));
      const cells = base.cells.slice();
      cells[0] = 0;
      cells[1] = 0;
      cells[2] = 0;
      const planted = { ...base, cells };
      const { steps } = resolveCascades(planted, DEFAULT_RULES, rngA);
      let cur = planted;
      for (const step of steps) {
        const groups = findMatches(cur);
        expect(groups).toEqual(step.matches);
        const cleared = { ...cur, cells: cur.cells.slice() };
        for (const g of groups) for (const c of g.cells) cleared.cells[c.r * cur.cols + c.c] = -1;
        const grav = applyGravity(cleared);
        const fill = refill(grav.board, DEFAULT_RULES, rngB);
        expect(step.falls).toEqual(grav.falls);
        expect(step.spawns).toEqual(fill.spawns);
        expect(toRows(step.board)).toEqual(toRows(fill.board));
        cur = fill.board;
      }
      expect(findMatches(cur)).toEqual([]);
    }
  });

  it('totalScore is the sum of step deltas and output is deterministic', () => {
    const base = createBoard(DEFAULT_RULES, mulberry32(3));
    const cells = base.cells.slice();
    cells[8] = 1;
    cells[9] = 1;
    cells[10] = 1;
    const planted = { ...base, cells };
    const a = resolveCascades(planted, DEFAULT_RULES, mulberry32(77));
    const b = resolveCascades(planted, DEFAULT_RULES, mulberry32(77));
    expect(a).toEqual(b);
    expect(a.totalScore).toBe(a.steps.reduce((s, st) => s + st.scoreDelta, 0));
    expect(a.steps.length).toBeGreaterThan(0);
  });

  it('respects maxSteps', () => {
    const start = fromRows([
      [2, 5, 2],
      [3, 2, 4],
      [1, 1, 1],
    ]);
    const { steps } = resolveCascades(start, DEFAULT_RULES, seq([2, 2, 2]), 1);
    expect(steps).toHaveLength(1);
  });

  it('returns no steps for a stable board', () => {
    const b = createBoard(DEFAULT_RULES, mulberry32(9));
    const res = resolveCascades(b, DEFAULT_RULES, mulberry32(1));
    expect(res.steps).toEqual([]);
    expect(res.totalScore).toBe(0);
    expect(res.board).toBe(b);
  });
});

describe('trySwap', () => {
  it('returns invalid without touching anything', () => {
    const b = createBoard(DEFAULT_RULES, mulberry32(4));
    const before = b.cells.slice();
    const out = trySwap(b, { r: 0, c: 0 }, { r: 2, c: 0 }, DEFAULT_RULES, mulberry32(1));
    expect(out.valid).toBe(false);
    expect(b.cells).toEqual(before);
  });

  it('resolves a valid swap', () => {
    const b = fromRows([
      [1, 2, 1, 1],
      [3, 4, 5, 2],
      [0, 0, 3, 0],
    ]);
    const out = trySwap(b, { r: 0, c: 0 }, { r: 0, c: 1 }, DEFAULT_RULES, mulberry32(1));
    expect(out.valid).toBe(true);
    if (!out.valid) return;
    expect(toRows(out.swapped)[0]).toEqual([2, 1, 1, 1]);
    expect(out.steps.length).toBeGreaterThan(0);
    expect(out.steps[0]!.matches[0]!.gem).toBe(1);
    expect(findMatches(out.board)).toEqual([]);
    expect(out.totalScore).toBeGreaterThanOrEqual(30);
  });
});
