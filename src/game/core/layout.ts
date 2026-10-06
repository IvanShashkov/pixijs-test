import type { Application } from 'pixi.js';
import { LAYOUT } from '../../config';

export interface Viewport {
  width: number;
  height: number;
  portrait: boolean;
  /** Safe margin from the screen edge. */
  safe: number;
  /** UI scale factor for things that should shrink on small screens (cards, heroine). 0.7..1. */
  ui: number;
}

export function viewportOf(app: Application): Viewport {
  const { width, height } = app.screen;
  return {
    width,
    height,
    portrait: height > width,
    safe: LAYOUT.margin,
    ui: clamp(Math.min(width, height) / 720, 0.7, 1),
  };
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Scale factor so that (tw × th) fits inside (bw × bh). */
export function fitContain(tw: number, th: number, bw: number, bh: number): number {
  return Math.min(bw / tw, bh / th);
}

/** Scale factor so that (tw × th) covers (bw × bh). */
export function fitCover(tw: number, th: number, bw: number, bh: number): number {
  return Math.max(bw / tw, bh / th);
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const rect = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});

/** Format seconds as m:ss. */
export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Thousands separator that is locale-neutral (thin space), so widths stay stable. */
export function formatPoints(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
