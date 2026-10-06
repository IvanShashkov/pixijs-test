import type { MatchGroup, ScoringRules } from './types';

/** Score for one cascade step: Σ group score × combo multiplier. */
export function scoreGroups(
  groups: MatchGroup[],
  comboIndex: number,
  rules: ScoringRules,
): { delta: number; multiplier: number } {
  const multiplier = Math.min(1 + comboIndex * rules.comboStep, rules.comboMax);
  let sum = 0;
  for (const g of groups) {
    const len = g.cells.length;
    sum += len * rules.baseTile + (len === 4 ? rules.bonus4 : len >= 5 ? rules.bonus5 : 0);
  }
  return { delta: Math.round(sum * multiplier), multiplier };
}
