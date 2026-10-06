import { Container, EventEmitter, Graphics, type Application, type Ticker } from 'pixi.js';
import { TIMING } from '../../config';
import { easings } from '../theme/ease';
import { TweenGroup } from './Tween';
import type { SceneContext, SceneKey, SceneLike, SceneNavigator, SceneParamsMap } from './types';

export type SceneRegistry = {
  [K in SceneKey]: new (ctx: SceneContext) => SceneLike;
};

/**
 * Owns the one active scene, the fade overlay, the single `app.ticker` callback and the
 * renderer resize listener. Transitions are serialised on a promise chain so rapid navigation
 * can never interleave two scene setups.
 */
export class SceneManager implements SceneNavigator {
  readonly layer = new Container();
  readonly overlay = new Container();
  /** Emits `change` with the new SceneKey once a scene is shown. */
  readonly events = new EventEmitter<{ change: [SceneKey] }>();
  private readonly fade = new Graphics();
  private readonly app: Application;
  private readonly registry: SceneRegistry;
  private readonly tweens = new TweenGroup();
  private ctx!: SceneContext;
  private chain: Promise<void> = Promise.resolve();
  private destroyed = false;
  private busyDepth = 0;

  current: SceneLike | null = null;
  currentKey: SceneKey | null = null;
  private lastParams: unknown;

  constructor(app: Application, registry: SceneRegistry) {
    this.app = app;
    this.registry = registry;
    this.fade.alpha = 0;
    this.fade.eventMode = 'none';
    this.overlay.addChild(this.fade);
    app.stage.addChild(this.layer, this.overlay);
    app.ticker.add(this.tick, this);
    app.renderer.on('resize', this.onResize, this);
  }

  attach(ctx: SceneContext): void {
    this.ctx = ctx;
    this.redrawFade();
  }

  /** Resolves when every queued transition has settled (test hooks wait on this). */
  whenSettled(): Promise<void> {
    return this.chain;
  }

  goTo<K extends SceneKey>(key: K, params: SceneParamsMap[K]): Promise<void> {
    return this.enqueue(() => this.transition(key, params));
  }

  /** Re-create the current scene (theme / locale changed) carrying its snapshot or last params. */
  rebuildCurrent(): Promise<void> {
    return this.enqueue(async () => {
      if (!this.currentKey) return;
      const params = this.current?.snapshot?.() ?? this.lastParams;
      await this.transition(this.currentKey, params);
    });
  }

  /** Dim the screen and block input while awaiting `work` (bundle loads on world switch). */
  async withBusy<T>(work: () => Promise<T>): Promise<T> {
    this.busyDepth++;
    if (this.busyDepth === 1) await this.fadeTo(0.55);
    try {
      return await work();
    } finally {
      this.busyDepth--;
      if (this.busyDepth === 0 && !this.destroyed) await this.fadeTo(0);
    }
  }

  layout(): void {
    this.redrawFade();
    this.current?.layout(this.ctx.viewport);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.app.ticker.remove(this.tick, this);
    this.app.renderer.off('resize', this.onResize, this);
    this.tweens.killAll();
    this.events.removeAllListeners();
    this.current?.destroy();
    this.current = null;
    this.layer.destroy({ children: true });
    this.overlay.destroy({ children: true });
  }

  private enqueue(step: () => Promise<void>): Promise<void> {
    const next = this.chain.then(async () => {
      if (this.destroyed) return;
      await step();
    });
    // Keep the chain alive after a failure so later navigation still works.
    this.chain = next.catch((error: unknown) => {
      console.error('[SceneManager] transition failed', error);
    });
    return next;
  }

  private async transition(key: SceneKey, params: unknown): Promise<void> {
    const Ctor = this.registry[key];
    const next = new Ctor(this.ctx);
    await next.init(params);
    if (this.destroyed) {
      next.destroy();
      return;
    }
    this.redrawFade();
    await this.fadeTo(1);
    // Keep `current` pointing at the old scene while it hides: its tweens only advance while
    // the manager ticks it.
    const old = this.current;
    if (old) {
      await old.hide();
      old.destroy();
    }
    this.current = null;
    this.layer.addChild(next as unknown as Container);
    this.current = next;
    this.currentKey = key;
    this.lastParams = params;
    next.layout(this.ctx.viewport);
    const shown = next.show();
    await this.fadeTo(0);
    await shown;
    this.events.emit('change', key);
  }

  private fadeTo(alpha: number): Promise<boolean> {
    this.fade.eventMode = alpha > 0 ? 'static' : 'none';
    return Promise.resolve(
      this.tweens.to(this.fade, { alpha }, { duration: TIMING.sceneFadeMs, ease: easings.quadOut }),
    );
  }

  private redrawFade(): void {
    const { width, height } = this.app.screen;
    this.fade
      .clear()
      .rect(0, 0, width, height)
      .fill({ color: this.ctx?.theme.colors.bg ?? 0x000000 });
    // Keep input blocked while visible, regardless of alpha target mid-tween.
    this.fade.eventMode = this.fade.alpha > 0 ? 'static' : 'none';
  }

  private tick(ticker: Ticker): void {
    this.tweens.update(ticker.deltaMS);
    this.current?.update(ticker);
  }

  private onResize(): void {
    this.layout();
  }
}
