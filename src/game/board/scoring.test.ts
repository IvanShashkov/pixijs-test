import { describe, expect, it } from 'vitest';
import { scoreGroups } from './scoring';
import type { MatchGroup, ScoringRules } from './types';

const rules: ScoringRules = { baseTile: 10, bonus4: 20, bonus5: 60, comboStep: 1, comboMax: 5 };
const group = (len: number): MatchGroup => ({
  gem: 0,
  cells: Array.from({ length: len }, (_, c) => ({ r: 0, c })),
});

describe('scoreGroups', () => {
  it('scores 3/4/5/6 cell groups', () => {
    expect(scoreGroups([group(3)], 0, rules).delta).toBe(30);
    expect(scoreGroups([group(4)], 0, rules).delta).toBe(60);
    expect(scoreGroups([group(5)], 0, rules).delta).toBe(110);
    expect(scoreGroups([group(6)], 0, rules).delta).toBe(120);
  });

  it('applies the combo multiplier', () => {
    expect(scoreGroups([group(3)], 1, rules)).toEqual({ delta: 60, multiplier: 2 });
    expect(scoreGroups([group(3)], 3, rules)).toEqual({ delta: 120, multiplier: 4 });
  });

  it('caps the multiplier', () => {
    expect(scoreGroups([group(3)], 10, rules).multiplier).toBe(5);
  });

  it('sums groups and rounds', () => {
    const r2 = { ...rules, comboStep: 0.5 };
    expect(scoreGroups([group(3), group(4)], 1, r2).delta).toBe(135);
    expect(scoreGroups([group(3)], 1, { ...rules, comboStep: 0.33 }).delta).toBe(40);
  });
});
