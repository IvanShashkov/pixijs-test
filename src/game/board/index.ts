import { BOARD, SCORING } from '../../config';
import type { BoardRules } from './types';

export * from './types';
export * from './rng';
export * from './board';
export * from './matches';
export * from './moves';
export * from './gravity';
export * from './scoring';
export * from './cascade';
export * from './reshuffle';

export const DEFAULT_RULES: BoardRules = {
  rows: BOARD.rows,
  cols: BOARD.cols,
  gemCount: BOARD.gemCount,
  scoring: { ...SCORING },
};
