import { clone, idx } from './board';
import { applyGravity, refill } from './gravity';
import { findMatches } from './matches';
import { isValidSwap, swapCells } from './moves';
import { scoreGroups } from './scoring';
import type { Board, BoardRules, CascadeStep, Cell, Rng, SwapOutcome } from './types';

/** Clear → gravity → refill until the board has no matches. Deterministic for a given rng. */
export function resolveCascades(
  b: Board,
  rules: BoardRules,
  rng: Rng,
  maxSteps = 50,
): { steps: CascadeStep[]; board: Board; totalScore: number } {
  const steps: CascadeStep[] = [];
  let board = b;
  let totalScore = 0;
  for (let comboIndex = 0; comboIndex < maxSteps; comboIndex++) {
    const matches = findMatches(board);
    if (matches.length === 0) break;
    const cleared = clone(board);
    const clearedCells: Cell[] = [];
    for (const g of matches) {
      for (const cell of g.cells) {
        cleared.cells[idx(cleared, cell.r, cell.c)] = -1;
        clearedCells.push(cell);
      }
    }
    clearedCells.sort((x, y) => x.r - y.r || x.c - y.c);
    const { delta, multiplier } = scoreGroups(matches, comboIndex, rules.scoring);
    const gravity = applyGravity(cleared);
    const filled = refill(gravity.board, rules, rng);
    board = filled.board;
    totalScore += delta;
    steps.push({
      comboIndex,
      multiplier,
      matches,
      clearedCells,
      falls: gravity.falls,
      spawns: filled.spawns,
      scoreDelta: delta,
      board,
    });
  }
  return { steps, board, totalScore };
}

/** Attempt a player swap. Invalid swaps change nothing. */
export function trySwap(b: Board, a: Cell, c: Cell, rules: BoardRules, rng: Rng): SwapOutcome {
  if (!isValidSwap(b, a, c)) return { valid: false };
  const swapped = swapCells(b, a, c);
  const { steps, board, totalScore } = resolveCascades(swapped, rules, rng);
  return { valid: true, swapped, steps, board, totalScore };
}
