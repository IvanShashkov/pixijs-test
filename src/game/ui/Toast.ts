import { Graphics, type Container, type Ticker } from 'pixi.js';
import { TIMING } from '../../config';
import type { TranslationKey } from '../../i18n';
import { Component } from '../core/Component';
import { TweenGroup } from '../core/Tween';
import type { Toaster } from '../core/types';
import type { ThemeConfig } from '../theme';
import { easings } from '../theme/ease';
import { drawPanel } from './draw';
import { LocalizedText } from './text';

/** Below the top bar (safe margin + bar height + gap) so it never covers a scene title. */
const TOAST_TOP = 16 + 56 + 12;

/**
 * Single transient message pill at the top of the screen. Lives in the SceneManager overlay
 * so it survives scene transitions. Theme is looked up per call (world may change).
 */
export class ToastLayer extends Component implements Toaster {
  private readonly getTheme: () => ThemeConfig;
  private readonly getWidth: () => number;
  private readonly tweens = new TweenGroup();
  private current: { bg: Graphics; text: LocalizedText } | null = null;

  constructor(getTheme: () => ThemeConfig, getWidth: () => number) {
    super();
    this.getTheme = getTheme;
    this.getWidth = getWidth;
    this.eventMode = 'none';
    this.onDispose(() => this.tweens.killAll());
  }

  show(key: TranslationKey, params?: Record<string, string | number>): void {
    this.dismiss();
    const theme = this.getTheme();
    const text = new LocalizedText(theme, 'body', key, params);
    text.anchor.set(0.5);
    const w = Math.ceil(text.width) + 40;
    const h = 44;
    const bg = drawPanel(new Graphics(), theme, w, h, { raised: true });
    bg.position.set(-w / 2, -h / 2);
    this.addChild(bg, text);
    this.current = { bg, text };
    this.position.set(this.getWidth() / 2, -h);
    this.alpha = 0;
    const run = async () => {
      const inTween = this.tweens.to(
        this as Container,
        { y: TOAST_TOP + h / 2, alpha: 1 },
        { duration: 240, ease: easings.backOut },
      );
      if (!(await inTween)) return;
      if (!(await this.tweens.delay(TIMING.toastMs))) return;
      if (
        !(await this.tweens.to(
          this as Container,
          { y: -h, alpha: 0 },
          { duration: 220, ease: easings.quadIn },
        ))
      )
        return;
      this.dismiss();
    };
    void run();
  }

  update(ticker: Ticker): void {
    this.tweens.update(ticker.deltaMS);
  }

  private dismiss(): void {
    this.tweens.killAll();
    if (this.current) {
      this.current.bg.destroy();
      this.current.text.destroy();
      this.current = null;
    }
  }
}
