import { Application } from 'pixi.js';
import { useEffect, useRef } from 'react';
import { bootGame, type GameHandle } from '../game/bootGame';
import { getTheme } from '../game/theme';
import { gameStore } from '../stores/gameStore';

/**
 * The ONLY React component in the app, and the only place a Pixi Application is created.
 * React's job ends here: mount a host element, run one effect, clean up. Everything the player
 * sees is drawn by the scenes started in `bootGame`.
 */
export function PixiStage() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // `app.init()` is async and React may unmount before it resolves (StrictMode mounts →
    // unmounts → mounts again immediately). `cancelled` lets the async path notice that and
    // destroy what it built; `app`/`game` give cleanup access to whatever did finish.
    let cancelled = false;
    let app: Application | null = null;
    let game: GameHandle | null = null;

    const setup = async () => {
      const instance = new Application();
      await instance.init({
        resizeTo: window,
        background: getTheme(gameStore.getState().world).colors.bg,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        preference: 'webgl',
      });
      if (cancelled) {
        instance.destroy(true, { children: true });
        return;
      }
      app = instance;
      host.appendChild(app.canvas);
      game = bootGame(app);
    };

    setup().catch((error: unknown) => {
      if (!cancelled) console.error('[PixiStage] failed to initialise', error);
    });

    return () => {
      cancelled = true;
      game?.dispose();
      game = null;
      // `true` removes the canvas from the DOM; `children: true` destroys the stage tree.
      // Textures from Assets are left alone — the Assets cache owns them.
      app?.destroy(true, { children: true });
      app = null;
    };
  }, []);

  return <div ref={hostRef} className="h-dvh w-screen overflow-hidden" />;
}
