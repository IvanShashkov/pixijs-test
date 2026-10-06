import type { LootWeights } from '../../config';
import { rngInt } from '../board/rng';
import type { Rng } from '../board/types';
import type { DropResult } from './types';

/** Number of chests/containers for a round: floor(credited / perPoints), capped. */
export function computeDropCount(credited: number, perPoints: number, cap: number): number {
  if (!(perPoints > 0) || !(credited > 0) || !(cap > 0)) return 0;
  return Math.min(Math.floor(credited / perPoints), Math.floor(cap));
}

/** Weighted pick; weights ≤ 0 or non-finite are ignored. Null when nothing is pickable. */
export function pickWeighted<K extends string>(weights: Record<K, number>, rng: Rng): K | null {
  const keys = Object.keys(weights) as K[];
  let total = 0;
  for (const k of keys) {
    const w = weights[k];
    if (Number.isFinite(w) && w > 0) total += w;
  }
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const k of keys) {
    const w = weights[k];
    if (!Number.isFinite(w) || w <= 0) continue;
    if (roll < w) return k;
    roll -= w;
  }
  // Floating-point edge: fall back to the last pickable key.
  for (let i = keys.length - 1; i >= 0; i--) {
    const w = weights[keys[i]!];
    if (Number.isFinite(w) && w > 0) return keys[i]!;
  }
  return null;
}

/**
 * Roll one drop. When no activities are locked the activity weight is dropped and the other
 * weights keep their ratio. A total weight of zero yields `nothing`.
 */
export function rollDrop(
  weights: LootWeights,
  rng: Rng,
  lockedActivityIds: readonly string[],
  bonusPoints: number,
): DropResult {
  const effective: LootWeights = lockedActivityIds.length ? weights : { ...weights, activity: 0 };
  const kind = pickWeighted(effective, rng);
  if (kind === 'bonus') return { kind: 'bonus', points: bonusPoints };
  if (kind === 'activity') {
    return { kind: 'activity', id: lockedActivityIds[rngInt(rng, lockedActivityIds.length)]! };
  }
  return { kind: 'nothing' };
}

/** Roll `count` drops; an activity is never awarded twice within the batch. */
export function rollDrops(
  count: number,
  weights: LootWeights,
  rng: Rng,
  lockedActivityIds: readonly string[],
  bonusPoints: number,
): DropResult[] {
  const pool = [...lockedActivityIds];
  const drops: DropResult[] = [];
  for (let i = 0; i < count; i++) {
    const drop = rollDrop(weights, rng, pool, bonusPoints);
    if (drop.kind === 'activity') {
      const at = pool.indexOf(drop.id);
      if (at >= 0) pool.splice(at, 1);
    }
    drops.push(drop);
  }
  return drops;
}
