import type { Application, Ticker } from 'pixi.js';
import type { GameStore } from '../../stores/gameStore';
import type { TranslationKey } from '../../i18n';
import type { ThemeConfig } from '../theme';
import type { GameParams, RoundResult } from '../types';
import type { Viewport } from './layout';

export type SceneKey =
  'boot' | 'menu' | 'game' | 'results' | 'shop' | 'inventory' | 'collection' | 'settings';

/** Parameters each scene accepts in `init()`. */
export interface SceneParamsMap {
  boot: undefined;
  menu: undefined;
  game: GameParams | undefined;
  results: RoundResult;
  shop: undefined;
  inventory: undefined;
  collection: undefined;
  settings: undefined;
}

export interface Toaster {
  show(key: TranslationKey, params?: Record<string, string | number>): void;
}

/** Everything a scene can reach. `theme` and `viewport` are live getters. */
export interface SceneContext {
  readonly app: Application;
  readonly scenes: SceneNavigator;
  readonly store: GameStore;
  readonly theme: ThemeConfig;
  readonly viewport: Viewport;
  readonly toasts: Toaster;
}

/** The part of the SceneManager scenes are allowed to use. */
export interface SceneNavigator {
  goTo<K extends SceneKey>(key: K, params: SceneParamsMap[K]): Promise<void>;
  rebuildCurrent(): Promise<void>;
  withBusy<T>(work: () => Promise<T>): Promise<T>;
  readonly currentKey: SceneKey | null;
}

export interface SceneLike {
  init(params: unknown): Promise<void> | void;
  layout(vp: Viewport): void;
  show(): Promise<void>;
  hide(): Promise<void>;
  update(ticker: Ticker): void;
  snapshot?(): unknown;
  destroy(): void;
}
