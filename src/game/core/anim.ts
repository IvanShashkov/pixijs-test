import type { Container } from 'pixi.js';
import { TIMING } from '../../config';
import { easings, type Easing } from '../theme/ease';
import type { TweenGroup } from './Tween';

export interface EnterOptions {
  from?: 'top' | 'bottom' | 'left' | 'right';
  distance?: number;
  stagger?: number;
  duration?: number;
  delay?: number;
  ease?: Easing;
}

/**
 * Entrance choreography: nodes start offset + transparent and slide to the positions `layout()`
 * gave them, one after another. Resolves when the last one lands (false if killed).
 */
export function enter(
  tweens: TweenGroup,
  nodes: Container[],
  opts: EnterOptions = {},
): Promise<boolean> {
  const distance = opts.distance ?? TIMING.entrance.distance;
  const stagger = opts.stagger ?? TIMING.entrance.staggerMs;
  const duration = opts.duration ?? TIMING.entrance.durationMs;
  const ease = opts.ease ?? easings.cubicOut;
  const from = opts.from ?? 'bottom';
  const dx = from === 'left' ? -distance : from === 'right' ? distance : 0;
  const dy = from === 'top' ? -distance : from === 'bottom' ? distance : 0;
  const tweens$ = nodes.map((node, i) => {
    const tx = node.x;
    const ty = node.y;
    node.position.set(tx + dx, ty + dy);
    node.alpha = 0;
    const delay = (opts.delay ?? 0) + i * stagger;
    void tweens.to(node, { alpha: 1 }, { duration: duration * 0.7, delay, ease: easings.quadOut });
    return tweens.to(node, { x: tx, y: ty }, { duration, delay, ease });
  });
  return Promise.all(tweens$).then((results) => results.every(Boolean));
}

export interface PopOptions {
  stagger?: number;
  duration?: number;
  delay?: number;
  scaleFrom?: number;
}

/** Scale-pop entrance for centre-anchored nodes (title, chests, chips). */
export function popIn(
  tweens: TweenGroup,
  nodes: Container[],
  opts: PopOptions = {},
): Promise<boolean> {
  const stagger = opts.stagger ?? TIMING.entrance.staggerMs;
  const duration = opts.duration ?? TIMING.entrance.durationMs;
  const scaleFrom = opts.scaleFrom ?? 0.6;
  const tweens$ = nodes.map((node, i) => {
    const sx = node.scale.x;
    const sy = node.scale.y;
    node.scale.set(sx * scaleFrom, sy * scaleFrom);
    node.alpha = 0;
    const delay = (opts.delay ?? 0) + i * stagger;
    void tweens.to(node, { alpha: 1 }, { duration: duration * 0.6, delay, ease: easings.quadOut });
    return tweens.to(node.scale, { x: sx, y: sy }, { duration, delay, ease: easings.backOut });
  });
  return Promise.all(tweens$).then((results) => results.every(Boolean));
}

/** Drop-in with a bounce (chests, badges). */
export function dropIn(
  tweens: TweenGroup,
  nodes: Container[],
  opts: EnterOptions = {},
): Promise<boolean> {
  return enter(tweens, nodes, {
    from: 'top',
    distance: 70,
    ease: easings.bounceOut,
    duration: 620,
    ...opts,
  });
}

/**
 * Infinite ping-pong on a numeric property until `alive()` turns false. Used for glow pulses and
 * shimmer loops; the owning component passes `() => !this.isDisposed`.
 */
export async function loopPulse(
  tweens: TweenGroup,
  target: object,
  key: string,
  low: number,
  high: number,
  periodMs: number,
  alive: () => boolean,
): Promise<void> {
  const t = target as Record<string, number>;
  while (alive()) {
    if (!(await tweens.to(t, { [key]: high }, { duration: periodMs / 2, ease: easings.sineInOut })))
      return;
    if (!alive()) return;
    if (!(await tweens.to(t, { [key]: low }, { duration: periodMs / 2, ease: easings.sineInOut })))
      return;
  }
}
