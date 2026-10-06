import { Assets } from 'pixi.js';
import type { World } from '../config';
import {
  BUNDLES,
  backgroundBundle,
  manifest,
  worldBundle,
  type BundleName,
  type Orientation,
} from './manifest';

/**
 * Idempotent wrappers around the Pixi `Assets` API.
 *
 * `Assets.init` may only run once per page (a second call warns and is ignored), and the React
 * shell's effect runs twice under StrictMode. Memoising the promises means every caller shares
 * one init and one load per bundle.
 *
 * Loaded textures are owned by the Assets cache for the lifetime of the page. Scenes must not
 * destroy them.
 */
let initPromise: Promise<void> | null = null;
const bundlePromises = new Map<BundleName, Promise<void>>();
const loaded = new Set<BundleName>();

export type ProgressCallback = (progress: number) => void;

export function initAssets(): Promise<void> {
  initPromise ??= Assets.init({ manifest });
  return initPromise;
}

export function loadBundle(name: BundleName, onProgress?: ProgressCallback): Promise<void> {
  let promise = bundlePromises.get(name);
  if (!promise) {
    promise = initAssets()
      .then(() => Assets.loadBundle(name, onProgress))
      .then(() => {
        loaded.add(name);
      });
    // Drop the memo on failure so a later attempt can retry instead of replaying the rejection.
    promise.catch(() => bundlePromises.delete(name));
    bundlePromises.set(name, promise);
  } else if (onProgress) {
    promise.then(() => onProgress(1)).catch(() => undefined);
  }
  return promise;
}

export function isBundleLoaded(name: BundleName): boolean {
  return loaded.has(name);
}

/** Everything a world needs on screen: its bundle plus the backdrop for the current orientation. */
export function loadWorld(
  world: World,
  orientation: Orientation,
  onProgress?: ProgressCallback,
): Promise<void> {
  const parts: Array<[BundleName, number]> = [
    [worldBundle(world), 0.7],
    [backgroundBundle(world, orientation), 0.3],
  ];
  const progress = new Map<BundleName, number>();
  const report = () => {
    if (!onProgress) return;
    let total = 0;
    for (const [name, weight] of parts) total += (progress.get(name) ?? 0) * weight;
    onProgress(total);
  };
  return Promise.all(
    parts.map(([name]) =>
      loadBundle(name, (p) => {
        progress.set(name, p);
        report();
      }),
    ),
  ).then(() => undefined);
}

export function loadBackground(world: World, orientation: Orientation): Promise<void> {
  return loadBundle(backgroundBundle(world, orientation));
}

export const CORE_BUNDLES: BundleName[] = [BUNDLES.fonts, BUNDLES.shared];
