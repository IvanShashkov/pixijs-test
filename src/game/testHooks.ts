import type { Application } from 'pixi.js';
import type { Locale, World } from '../config';
import type { GameState, GameStore } from '../stores/gameStore';
import type { SceneManager } from './core/SceneManager';
import type { SceneKey, SceneParamsMap } from './core/types';
import { GameScene, type GameDebugState } from './scenes/GameScene';
import { ResultsScene } from './scenes/ResultsScene';
import type { GameParams } from './types';

/**
 * `window.__game` — a DEV-only driver for Playwright and manual debugging, because the whole
 * UI is canvas and coordinate clicks are brittle. Stripped from production builds.
 */
export interface GameTestHook {
  ready: Promise<void>;
  goTo<K extends SceneKey>(key: K, params?: SceneParamsMap[K]): Promise<void>;
  store: { getState(): GameState; setState(patch: Partial<GameState>): void };
  setWorld(world: World): Promise<void>;
  setLocale(locale: Locale): Promise<void>;
  startRound(params?: GameParams): Promise<void>;
  endRound(options?: { score?: number }): Promise<void>;
  pause(): void;
  resume(): void;
  playMove(): Promise<boolean>;
  openAllLoot(): Promise<void>;
  /** Starts opening one chest (roulette) — callers usually do not await it. */
  openChest(index: number): Promise<void>;
  settle(ms: number): Promise<void>;
  snapshot(): { scene: SceneKey | null; game: GameDebugState | null; drops: number | null };
}

declare global {
  interface Window {
    __game?: GameTestHook;
  }
}

interface Deps {
  app: Application;
  scenes: SceneManager;
  store: GameStore;
  whenWorldSettled: () => Promise<void>;
}

export function installTestHooks({ scenes, store, whenWorldSettled }: Deps): () => void {
  const settle = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(() => requestAnimationFrame(() => resolve()), ms));
  const idle = async () => {
    await whenWorldSettled();
    await scenes.whenSettled();
    await settle(50);
  };
  const game = () => (scenes.current instanceof GameScene ? scenes.current : null);
  const results = () => (scenes.current instanceof ResultsScene ? scenes.current : null);

  const ready = new Promise<void>((resolve) => {
    if (scenes.currentKey && scenes.currentKey !== 'boot') {
      resolve();
      return;
    }
    const onChange = (key: SceneKey) => {
      if (key !== 'boot') {
        scenes.events.off('change', onChange);
        resolve();
      }
    };
    scenes.events.on('change', onChange);
  });

  const hook: GameTestHook = {
    ready,
    async goTo(key, params) {
      await scenes.goTo(key, params as never);
      await idle();
    },
    store: { getState: () => store.getState(), setState: (patch) => store.setState(patch) },
    async setWorld(world) {
      store.getState().setWorld(world);
      await settle(0);
      await idle();
    },
    async setLocale(locale) {
      store.getState().setLocale(locale);
      await idle();
    },
    async startRound(params) {
      await scenes.goTo('game', params);
      await idle();
    },
    async endRound(options) {
      const g = game();
      if (!g) throw new Error('not in a game');
      await g.debugEndRound(options?.score);
      await idle();
    },
    pause: () => game()?.pause(),
    resume: () => game()?.resume(),
    playMove: () => game()?.playFirstValidMove() ?? Promise.resolve(false),
    openAllLoot: () => results()?.openAll() ?? Promise.resolve(),
    openChest: (index) => results()?.openChest(index) ?? Promise.resolve(),
    settle,
    snapshot: () => ({
      scene: scenes.currentKey,
      game: game()?.debugState ?? null,
      drops: results()?.drops.length ?? null,
    }),
  };
  window.__game = hook;
  return () => {
    if (window.__game === hook) delete window.__game;
  };
}
