import type { Application, Ticker } from 'pixi.js';
import { loadWorld } from '../assets/loadAssets';
import { setLocale } from '../i18n';
import { gameStore } from '../stores/gameStore';
import { SceneManager, type SceneRegistry } from './core/SceneManager';
import { viewportOf } from './core/layout';
import type { SceneContext } from './core/types';
import { BootScene } from './scenes/BootScene';
import { CollectionScene } from './scenes/CollectionScene';
import { GameScene } from './scenes/GameScene';
import { InventoryScene } from './scenes/InventoryScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { ResultsScene } from './scenes/ResultsScene';
import { SettingsScene } from './scenes/SettingsScene';
import { ShopScene } from './scenes/ShopScene';
import { installTestHooks } from './testHooks';
import { getTheme } from './theme';
import { ToastLayer } from './ui/Toast';

export interface GameHandle {
  dispose(): void;
}

const registry: SceneRegistry = {
  boot: BootScene,
  menu: MainMenuScene,
  game: GameScene,
  results: ResultsScene,
  shop: ShopScene,
  inventory: InventoryScene,
  collection: CollectionScene,
  settings: SettingsScene,
};

/**
 * Wires the whole game onto an initialised Application: scene manager, toasts, store →
 * scene propagation (world switch loads the bundle then rebuilds; locale switch rebuilds)
 * and the dev-only test hook. Synchronous: returns a handle whose `dispose()` is safe to call
 * at any point, including before boot finishes (React StrictMode).
 */
export function bootGame(app: Application): GameHandle {
  let disposed = false;
  setLocale(gameStore.getState().locale);

  const scenes = new SceneManager(app, registry);
  const toasts = new ToastLayer(
    () => getTheme(gameStore.getState().world),
    () => app.screen.width,
  );
  scenes.overlay.addChild(toasts);
  const tickToasts = (ticker: Ticker) => toasts.update(ticker);
  app.ticker.add(tickToasts);

  const ctx: SceneContext = {
    app,
    scenes,
    store: gameStore,
    get theme() {
      return getTheme(gameStore.getState().world);
    },
    get viewport() {
      return viewportOf(app);
    },
    toasts,
  };
  scenes.attach(ctx);

  let pendingWorldSwitch: Promise<void> = Promise.resolve();
  const unsubscribe = [
    gameStore.subscribe(
      (s) => s.world,
      (world) => {
        const vp = viewportOf(app);
        pendingWorldSwitch = scenes
          .withBusy(() => loadWorld(world, vp.portrait ? 'portrait' : 'landscape'))
          .then(() => (disposed ? undefined : scenes.rebuildCurrent()))
          .catch((error: unknown) => console.error('[bootGame] world switch failed', error));
      },
    ),
    gameStore.subscribe(
      (s) => s.locale,
      (locale) => {
        setLocale(locale);
        if (!disposed) void scenes.rebuildCurrent();
      },
    ),
  ];

  const removeHooks = import.meta.env.DEV
    ? installTestHooks({
        app,
        scenes,
        store: gameStore,
        whenWorldSettled: () => pendingWorldSwitch,
      })
    : () => undefined;

  void scenes.goTo('boot', undefined);

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      removeHooks();
      for (const u of unsubscribe) u();
      app.ticker.remove(tickToasts);
      scenes.destroy();
    },
  };
}
