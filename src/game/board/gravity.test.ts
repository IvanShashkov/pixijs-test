import { describe, expect, it } from 'vitest';
import { fromRows, toRows } from './board';
import { applyGravity, refill } from './gravity';
import { DEFAULT_RULES } from './index';
import type { Rng } from './types';

describe('applyGravity', () => {
  it('drops a single tile into one hole', () => {
    const b = fromRows([
      [1, 2],
      [-1, 3],
      [4, 5],
    ]);
    const { board, falls } = applyGravity(b);
    expect(toRows(board)).toEqual([
      [-1, 2],
      [1, 3],
      [4, 5],
    ]);
    expect(falls).toEqual([{ from: { r: 0, c: 0 }, to: { r: 1, c: 0 }, gem: 1 }]);
  });

  it('handles multiple holes and preserves order', () => {
    const b = fromRows([[1], [-1], [2], [-1], [3]]);
    const { board, falls } = applyGravity(b);
    expect(toRows(board)).toEqual([[-1], [-1], [1], [2], [3]]);
    expect(falls).toHaveLength(2);
    for (const f of falls) expect(board.cells[f.to.r * board.cols + f.to.c]).toBe(f.gem);
  });

  it('leaves a fully cleared column empty with no falls', () => {
    const b = fromRows([
      [-1, 1],
      [-1, 2],
      [-1, 3],
    ]);
    const { board, falls } = applyGravity(b);
    expect(falls).toEqual([]);
    expect(toRows(board)).toEqual([
      [-1, 1],
      [-1, 2],
      [-1, 3],
    ]);
  });
});

describe('refill', () => {
  const seq = (values: number[]): Rng => {
    let i = 0;
    return () => values[i++ % values.length]! / DEFAULT_RULES.gemCount + 1e-9;
  };

  it('fills every empty cell with a gem in range', () => {
    const b = fromRows([
      [-1, -1, 1],
      [-1, 2, 3],
      [4, 5, 0],
    ]);
    const { board, spawns } = refill(b, DEFAULT_RULES, seq([0, 1, 2, 3, 4, 5]));
    expect(board.cells.every((g) => g >= 0 && g < DEFAULT_RULES.gemCount)).toBe(true);
    expect(spawns).toHaveLength(3);
  });

  it('uses spawnOffset = n - r per column', () => {
    const b = fromRows([
      [-1, -1],
      [-1, 1],
      [2, 3],
    ]);
    const { spawns } = refill(b, DEFAULT_RULES, seq([0]));
    expect(spawns).toEqual([
      { cell: { r: 0, c: 0 }, gem: 0, spawnOffset: 2 },
      { cell: { r: 1, c: 0 }, gem: 0, spawnOffset: 1 },
      { cell: { r: 0, c: 1 }, gem: 0, spawnOffset: 1 },
    ]);
  });

  it('consumes the rng column-major, top to bottom', () => {
    const b = fromRows([
      [-1, -1],
      [-1, 1],
    ]);
    const { spawns } = refill(b, DEFAULT_RULES, seq([3, 4, 5]));
    expect(spawns.map((s) => s.gem)).toEqual([3, 4, 5]);
    expect(spawns.map((s) => `${s.cell.r},${s.cell.c}`)).toEqual(['0,0', '1,0', '0,1']);
  });

  it('only changes previously empty cells', () => {
    const b = fromRows([
      [-1, 1],
      [2, 3],
    ]);
    const { board } = refill(b, DEFAULT_RULES, seq([5]));
    expect(toRows(board)).toEqual([
      [5, 1],
      [2, 3],
    ]);
  });
});
