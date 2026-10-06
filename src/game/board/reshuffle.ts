import { BOARD } from '../../config';
import { clone, createBoard } from './board';
import { findMatches } from './matches';
import { hasValidMove } from './moves';
import { rngInt } from './rng';
import type { Board, BoardRules, Rng } from './types';

/**
 * Permute the existing gems (Fisher–Yates) until the board has no matches and at least one
 * valid move. After `maxAttempts` failures a fresh board is generated instead (`fallback`).
 */
export function reshuffle(
  b: Board,
  rules: BoardRules,
  rng: Rng,
  maxAttempts: number = BOARD.reshuffleAttempts,
): { board: Board; fallback: boolean } {
  const board = clone(b);
  const cells = board.cells;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    for (let i = cells.length - 1; i > 0; i--) {
      const j = rngInt(rng, i + 1);
      const tmp = cells[i]!;
      cells[i] = cells[j]!;
      cells[j] = tmp;
    }
    if (findMatches(board).length === 0 && hasValidMove(board)) return { board, fallback: false };
  }
  return { board: createBoard(rules, rng), fallback: true };
}
