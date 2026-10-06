import type { World } from '../config';
import type { DropResult } from './loot/types';

/** Carried from the Game scene to the Results scene. */
export interface RoundResult {
  world: World;
  score: number;
  coefficient: number;
  credited: number;
  drops: DropResult[];
}

/** Optional overrides when starting a round (used by the dev/e2e hook). */
export interface GameParams {
  seed?: number;
  seconds?: number;
}
