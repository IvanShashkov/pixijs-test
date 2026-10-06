import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { LAYOUT, TIMING } from '../../config';
import { Component } from '../core/Component';
import type { TweenGroup } from '../core/Tween';
import type { ThemeConfig } from '../theme';
import { alias } from '../theme/assets';
import { easings } from '../theme/ease';

export interface HeroineOptions {
  theme: ThemeConfig;
  tweens: TweenGroup;
  /** Assets alias of the costume sprite. */
  costume: string | null;
  targetHeight: number;
  platform?: boolean;
}

/**
 * The heroine as a normalised full-body sprite: anchored at the feet, scaled by HEIGHT only to
 * `targetHeight` (sprites differ in canvas size), optionally standing on the world's platform
 * with the feet sunk 55 % into it. Idle = gentle bob + breathing. Costume swaps play the
 * whirlwind effect and switch the texture at the midpoint. The component origin is the feet.
 */
export class Heroine extends Component {
  private readonly tweens: TweenGroup;
  private readonly platform: Sprite | null = null;
  private readonly figure = new Container();
  private readonly sprite = new Sprite();
  private readonly whirl = new Sprite();
  private readonly shadow = new Graphics();
  private targetHeight: number;
  private costume: string | null;
  private elapsed = 0;
  private swapping = false;
  private swapToken = 0;
  private flipTimer = 0;
  private cheering = false;
  bobbing = true;

  constructor(opts: HeroineOptions) {
    super();
    this.tweens = opts.tweens;
    this.targetHeight = opts.targetHeight;
    this.costume = opts.costume;
    this.eventMode = 'none';

    if (opts.platform) {
      this.platform = new Sprite(Assets.get<Texture>(opts.theme.assets.platform));
      this.platform.anchor.set(0.5, 1);
      this.addChild(this.platform);
    } else {
      this.addChild(this.shadow);
    }
    this.sprite.anchor.set(0.5, 1);
    this.whirl.anchor.set(0.5, 1);
    this.whirl.visible = false;
    this.figure.addChild(this.sprite, this.whirl);
    this.addChild(this.figure);
    this.applyCostume(opts.costume);
    this.setTargetHeight(opts.targetHeight);
  }

  get currentCostume(): string | null {
    return this.costume;
  }

  setTargetHeight(h: number): void {
    this.targetHeight = h;
    if (this.sprite.texture.width > 1) this.sprite.scale.set(h / this.sprite.texture.height);
    if (this.platform) {
      const platformW = h * 0.92;
      this.platform.scale.set(platformW / this.platform.texture.width);
      this.platform.position.set(0, this.platform.height * LAYOUT.platformFeetOffset);
    } else {
      this.shadow
        .clear()
        .ellipse(0, 0, h * 0.18, h * 0.045)
        .fill({ color: 0x000000, alpha: 0.35 });
    }
    const whirlTexture = this.whirl.texture;
    if (whirlTexture.width > 1) this.whirl.scale.set((h * 1.1) / whirlTexture.height);
  }

  /**
   * Swap costume.
   *  - `whirl`   — the sibling's whirlwind hides the switch (texture swaps at the midpoint).
   *  - `instant` — texture swaps right away with a quick squash-and-stretch (shop try-on).
   *  - `none`    — silent swap.
   * A newer call cancels any swap still in flight, so rapid taps always end on the last costume.
   */
  async setCostume(
    costumeAlias: string | null,
    mode: 'whirl' | 'instant' | 'none' = 'whirl',
  ): Promise<void> {
    if (costumeAlias === this.costume && !this.swapping) return;
    const token = ++this.swapToken;
    this.cancelSwap();
    if (mode === 'none' || !Assets.cache.has(alias.fx('whirl'))) {
      this.applyCostume(costumeAlias);
      this.setTargetHeight(this.targetHeight);
      return;
    }
    if (mode === 'instant') {
      this.applyCostume(costumeAlias);
      this.setTargetHeight(this.targetHeight);
      await this.pop(token);
      return;
    }
    this.swapping = true;
    this.bobbing = false;
    this.figure.position.set(0, 0);
    this.figure.scale.set(1);
    this.whirl.texture = Assets.get<Texture>(alias.fx('whirl'));
    this.whirl.visible = true;
    this.whirl.alpha = 0;
    const s = (this.targetHeight * 1.1) / this.whirl.texture.height;
    this.whirl.scale.set(s * 0.25);
    const total = TIMING.whirlMs;
    // Sibling keyframes: .25 → 1.07 (22 %) → 1 (38 %) → 1.02 (72 %) → .3 (100 %).
    const seq: Array<[number, number, number]> = [
      [1.07, total * 0.22, 1],
      [1, total * 0.16, 1],
      [1.02, total * 0.34, 1],
      [0.3, total * 0.28, 0],
    ];
    let elapsed = 0;
    let swapped = false;
    for (const [scale, duration, alpha] of seq) {
      const tw = this.tweens.to(
        this.whirl.scale,
        { y: s * scale },
        { duration, ease: easings.quadOut },
      );
      void this.tweens.to(this.whirl, { alpha }, { duration });
      elapsed += duration;
      if (!swapped && elapsed >= total / 2) {
        swapped = true;
        this.applyCostume(costumeAlias);
        this.setTargetHeight(this.targetHeight);
      }
      if (!(await tw) || token !== this.swapToken) return;
    }
    if (!swapped) {
      this.applyCostume(costumeAlias);
      this.setTargetHeight(this.targetHeight);
    }
    this.whirl.visible = false;
    this.swapping = false;
    this.bobbing = true;
  }

  /** Abort a whirl in flight (a newer swap superseded it). */
  private cancelSwap(): void {
    if (!this.swapping) return;
    this.swapping = false;
    this.whirl.visible = false;
    this.figure.position.set(0, 0);
    this.figure.scale.set(1);
    this.bobbing = true;
  }

  /** Squash-and-stretch acknowledging an instant costume change. */
  private async pop(token: number): Promise<void> {
    if (this.cheering) return;
    const fig = this.figure;
    this.bobbing = false;
    fig.scale.set(1.08, 0.9);
    if (
      !(await this.tweens.to(
        fig.scale,
        { x: 0.97, y: 1.04 },
        { duration: 140, ease: easings.quadOut },
      ))
    )
      return;
    if (token !== this.swapToken) return;
    if (
      !(await this.tweens.to(fig.scale, { x: 1, y: 1 }, { duration: 180, ease: easings.backOut }))
    )
      return;
    if (token === this.swapToken) this.bobbing = true;
  }

  /** Little jump + squash-and-stretch (big combos, round end). */
  async cheer(): Promise<void> {
    if (this.cheering || this.swapping || this.isDisposed) return;
    this.cheering = true;
    const fig = this.figure;
    void this.tweens.to(fig.scale, { x: 1.06, y: 0.92 }, { duration: 90, ease: easings.quadOut });
    if (!(await this.tweens.delay(90))) return;
    void this.tweens.to(fig.scale, { x: 0.96, y: 1.06 }, { duration: 120, ease: easings.quadOut });
    if (!(await this.tweens.to(fig, { y: -22 }, { duration: 170, ease: easings.quadOut }))) return;
    void this.tweens.to(fig.scale, { x: 1, y: 1 }, { duration: 200, ease: easings.backOut });
    if (!(await this.tweens.to(fig, { y: 0 }, { duration: 260, ease: easings.bounceOut }))) return;
    this.cheering = false;
  }

  update(deltaMS: number): void {
    this.elapsed += deltaMS;
    if (this.swapping) {
      this.flipTimer += deltaMS;
      if (this.flipTimer >= TIMING.whirlFlipMs) {
        this.flipTimer = 0;
        this.whirl.scale.x = -this.whirl.scale.x;
        this.whirl.rotation = this.whirl.scale.x > 0 ? -0.024 : 0.024;
      }
      // keep |scale.x| in sync with the tweened y scale
      this.whirl.scale.x = Math.sign(this.whirl.scale.x || 1) * Math.abs(this.whirl.scale.y);
      return;
    }
    if (!this.bobbing || this.cheering) return;
    const t = (this.elapsed / TIMING.idleBobMs) * Math.PI * 2;
    this.figure.y = -3 * (0.5 + 0.5 * Math.sin(t));
    this.figure.scale.y = 1 + 0.012 * (0.5 + 0.5 * Math.sin(t));
  }

  private applyCostume(costumeAlias: string | null): void {
    this.costume = costumeAlias;
    if (costumeAlias && Assets.cache.has(costumeAlias)) {
      this.sprite.texture = Assets.get<Texture>(costumeAlias);
      this.sprite.visible = true;
    } else {
      this.sprite.visible = false;
    }
  }
}
