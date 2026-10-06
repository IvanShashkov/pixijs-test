import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../board/rng';
import { computeDropCount, pickWeighted, rollDrop, rollDrops } from './loot';

const weights = { bonus: 40, nothing: 35, activity: 25 };
const locked = ['activity-0', 'activity-1', 'activity-2'];

describe('computeDropCount', () => {
  it('follows thresholds and cap', () => {
    expect(computeDropCount(0, 500, 5)).toBe(0);
    expect(computeDropCount(499, 500, 5)).toBe(0);
    expect(computeDropCount(500, 500, 5)).toBe(1);
    expect(computeDropCount(2499, 500, 5)).toBe(4);
    expect(computeDropCount(2500, 500, 5)).toBe(5);
    expect(computeDropCount(99999, 500, 5)).toBe(5);
  });

  it('guards degenerate inputs', () => {
    expect(computeDropCount(1000, 0, 5)).toBe(0);
    expect(computeDropCount(-100, 500, 5)).toBe(0);
    expect(computeDropCount(1000, 500, 0)).toBe(0);
    expect(computeDropCount(Number.NaN, 500, 5)).toBe(0);
  });
});

describe('pickWeighted', () => {
  it('matches the weight distribution over many samples', () => {
    const rng = mulberry32(123);
    const counts = { bonus: 0, nothing: 0, activity: 0 };
    const N = 20000;
    for (let i = 0; i < N; i++) counts[pickWeighted(weights, rng)!]++;
    expect(counts.bonus / N).toBeCloseTo(0.4, 1);
    expect(counts.nothing / N).toBeCloseTo(0.35, 1);
    expect(counts.activity / N).toBeCloseTo(0.25, 1);
    expect(Math.abs(counts.bonus / N - 0.4)).toBeLessThan(0.02);
    expect(Math.abs(counts.nothing / N - 0.35)).toBeLessThan(0.02);
    expect(Math.abs(counts.activity / N - 0.25)).toBeLessThan(0.02);
  });

  it('never picks zero or negative weights', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 2000; i++) {
      expect(pickWeighted({ a: 0, b: 10, c: -3 }, rng)).toBe('b');
    }
  });

  it('returns null when nothing is pickable', () => {
    expect(pickWeighted({ a: 0, b: 0 }, mulberry32(1))).toBeNull();
    expect(pickWeighted({ a: Number.NaN }, mulberry32(1))).toBeNull();
  });
});

describe('rollDrop', () => {
  it('never returns an activity when none are locked and keeps bonus:nothing ratio', () => {
    const rng = mulberry32(9);
    const counts = { bonus: 0, nothing: 0, activity: 0 };
    const N = 20000;
    for (let i = 0; i < N; i++) counts[rollDrop(weights, rng, [], 150).kind]++;
    expect(counts.activity).toBe(0);
    expect(Math.abs(counts.bonus / N - 40 / 75)).toBeLessThan(0.02);
    expect(Math.abs(counts.nothing / N - 35 / 75)).toBeLessThan(0.02);
  });

  it('returns nothing when all weights are zero', () => {
    expect(rollDrop({ bonus: 0, nothing: 0, activity: 0 }, mulberry32(1), locked, 150)).toEqual({
      kind: 'nothing',
    });
  });

  it('carries bonus points and picks from the locked pool', () => {
    const rng = mulberry32(3);
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const d = rollDrop(weights, rng, locked, 150);
      if (d.kind === 'bonus') expect(d.points).toBe(150);
      if (d.kind === 'activity') {
        expect(locked).toContain(d.id);
        seen.add(d.id);
      }
    }
    expect(seen.size).toBe(3);
  });
});

describe('rollDrops', () => {
  it('never awards the same activity twice and respects the pool size', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const drops = rollDrops(
        10,
        { bonus: 1, nothing: 1, activity: 50 },
        mulberry32(seed),
        locked,
        150,
      );
      const ids = drops.filter((d) => d.kind === 'activity').map((d) => (d as { id: string }).id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeLessThanOrEqual(locked.length);
      expect(drops).toHaveLength(10);
    }
  });

  it('is deterministic per seed', () => {
    expect(rollDrops(5, weights, mulberry32(11), locked, 150)).toEqual(
      rollDrops(5, weights, mulberry32(11), locked, 150),
    );
  });

  it('returns an empty list for count 0', () => {
    expect(rollDrops(0, weights, mulberry32(1), locked, 150)).toEqual([]);
  });
});
