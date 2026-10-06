import { Graphics } from 'pixi.js';
import { BUNDLES } from '../../assets/manifest';
import { loadBundle, loadWorld } from '../../assets/loadAssets';
import { Scene } from '../core/Scene';
import type { Viewport } from '../core/layout';
import { Backdrop } from '../ui/Backdrop';
import { drawPanel } from '../ui/draw';
import { LocalizedText } from '../ui/text';

/**
 * Loads fonts → shared → the active world (+ its backdrop for the current orientation) with a
 * progress bar, then hands over to the main menu. No Text is created before the fonts resolve.
 */
export class BootScene extends Scene {
  private readonly backdrop = new Backdrop({
    theme: this.theme,
    world: this.theme.world,
    photo: false,
  });
  private readonly barBg = new Graphics();
  private readonly bar = new Graphics();
  private loadingLabel: LocalizedText | null = null;
  private progress = 0;
  private barWidth = 320;

  override init(): void {
    this.addChild(this.backdrop, this.barBg, this.bar);
    void this.run();
  }

  layout(vp: Viewport): void {
    this.backdrop.layout(vp);
    this.barWidth = Math.min(320, vp.width - 64);
    const x = (vp.width - this.barWidth) / 2;
    const y = vp.height / 2;
    drawPanel(this.barBg, this.theme, this.barWidth + 16, 22, { raised: true });
    this.barBg.position.set(x - 8, y - 11);
    this.bar.position.set(x, y - 3);
    this.loadingLabel?.position.set(vp.width / 2, y - 36);
    this.drawBar();
  }

  override update(ticker: Parameters<Scene['update']>[0]): void {
    super.update(ticker);
    this.backdrop.update(ticker.deltaMS);
  }

  private async run(): Promise<void> {
    const vp = this.ctx.viewport;
    const world = this.ctx.store.getState().world;
    const setProgress = (p: number) => {
      this.progress = p;
      this.drawBar();
    };
    try {
      await loadBundle(BUNDLES.fonts, (p) => setProgress(p * 0.15));
      if (this.isDisposed) return;
      this.loadingLabel = new LocalizedText(this.theme, 'eyebrow', 'boot.loading');
      this.loadingLabel.anchor.set(0.5);
      this.addChild(this.loadingLabel);
      this.layout(this.ctx.viewport);
      await loadBundle(BUNDLES.shared, (p) => setProgress(0.15 + p * 0.2));
      if (this.isDisposed) return;
      await loadWorld(world, vp.portrait ? 'portrait' : 'landscape', (p) =>
        setProgress(0.35 + p * 0.65),
      );
      if (this.isDisposed) return;
      setProgress(1);
      await this.tweens.delay(120);
      if (this.isDisposed) return;
      void this.ctx.scenes.goTo('menu', undefined);
    } catch (error) {
      console.error('[Boot] failed to load assets', error);
    }
  }

  private drawBar(): void {
    const w = Math.max(0, this.barWidth * this.progress);
    this.bar.clear();
    if (w > 0) this.bar.roundRect(0, 0, w, 6, 3).fill({ color: this.theme.colors.accent });
  }
}
