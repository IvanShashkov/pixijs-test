import type { Container, Ticker } from 'pixi.js';
import { TIMING } from '../../config';
import { easings } from '../theme/ease';
import type { ThemeConfig } from '../theme';
import { Component } from './Component';
import type { Viewport } from './layout';
import { TweenGroup } from './Tween';
import type { SceneContext, SceneLike } from './types';

/**
 * Base class for every screen. Lifecycle, driven by the SceneManager:
 *
 *   new Scene(ctx) → await init(params) → layout(vp) → await show() → update(ticker)… →
 *   await hide() → destroy()
 *
 * - `init` builds the display tree and may lazy-load assets. No positioning here.
 * - `layout` is idempotent: called once after init and again on every resize.
 * - `update` advances this scene's tween group; override and call super for per-frame logic.
 * - `destroy` kills tweens and runs the Component disposers. Scenes never touch `app.ticker`
 *   or `renderer` events directly; the manager owns both.
 */
export abstract class Scene<P = undefined> extends Component implements SceneLike {
  protected readonly ctx: SceneContext;
  /** Theme snapshot taken at construction; a world switch rebuilds the scene with a new one. */
  protected readonly theme: ThemeConfig;
  protected readonly tweens = new TweenGroup();
  protected viewport: Viewport;

  constructor(ctx: SceneContext) {
    super();
    this.ctx = ctx;
    this.theme = ctx.theme;
    this.viewport = ctx.viewport;
  }

  init(_params: P): Promise<void> | void {
    void _params;
  }

  abstract layout(vp: Viewport): void;

  /** Default entrance: fade in. */
  async show(): Promise<void> {
    this.alpha = 0;
    await this.tweens.to(
      this as Container,
      { alpha: 1 },
      { duration: TIMING.sceneFadeMs, ease: easings.quadOut },
    );
  }

  /** Default exit: fade out. */
  async hide(): Promise<void> {
    await this.tweens.to(this as Container, { alpha: 0 }, { duration: TIMING.sceneFadeMs * 0.6 });
  }

  update(ticker: Ticker): void {
    this.tweens.update(ticker.deltaMS);
  }

  /** State to carry across `rebuildCurrent()` (world/locale switch). */
  snapshot?(): P;

  /** Relayout with the live viewport (after text changes etc.). */
  protected relayout(): void {
    this.viewport = this.ctx.viewport;
    this.layout(this.viewport);
  }

  override destroy(): void {
    if (this.isDisposed) return;
    this.tweens.killAll();
    super.destroy();
  }
}
