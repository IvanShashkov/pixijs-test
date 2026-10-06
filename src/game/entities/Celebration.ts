import { Assets, Sprite, type Texture } from 'pixi.js';
import { LAYOUT, TIMING } from '../../config';
import { Component } from '../core/Component';
import type { TweenGroup } from '../core/Tween';
import { alias } from '../theme/assets';
import { easings } from '../theme/ease';

export interface CelebrationOptions {
  tweens: TweenGroup;
  width: number;
  /** Feet line in local coordinates (characters stand here). */
  floorY: number;
}

/**
 * The sibling's hero intro as a Pixi sequence: Кама runs in from the left, Лиса from the right
 * (mirrored), they meet, swap to the hug frame and a pixel heart floats up. Plays once.
 */
export class Celebration extends Component {
  private readonly tweens: TweenGroup;
  private readonly left: Sprite;
  private readonly right: Sprite;
  private readonly hug: Sprite;
  private readonly heart: Sprite;
  private stageWidth: number;
  private floorY: number;
  private running = false;
  private elapsed = 0;
  private finished = false;

  constructor(opts: CelebrationOptions) {
    super();
    this.tweens = opts.tweens;
    this.stageWidth = opts.width;
    this.floorY = opts.floorY;
    this.eventMode = 'none';
    const make = (texAlias: string, height: number) => {
      const s = new Sprite(Assets.get<Texture>(texAlias));
      s.anchor.set(0.5, 1);
      s.scale.set(height / s.texture.height);
      return s;
    };
    this.left = make(alias.heroineRun('horizon'), LAYOUT.celebrationRunnerHeight);
    this.right = make(alias.heroineRun('wow'), LAYOUT.celebrationRunnerHeight);
    this.right.scale.x = -this.right.scale.x;
    this.hug = make(alias.fx('hug'), LAYOUT.celebrationHugHeight);
    this.heart = make(alias.fx('heart'), LAYOUT.celebrationHeartHeight);
    this.hug.visible = false;
    this.heart.visible = false;
    this.left.visible = false;
    this.right.visible = false;
    this.addChild(this.left, this.right, this.hug, this.heart);
  }

  layout(width: number, floorY: number): void {
    this.stageWidth = width;
    this.floorY = floorY;
    if (this.finished) this.placeFinal();
  }

  async play(): Promise<void> {
    if (this.running || this.finished) return;
    this.running = true;
    const { runMs, hugPopMs, hugToHeartMs, heartMs } = TIMING.celebration;
    const gap = 4;
    const halfL = Math.abs(this.left.width) / 2;
    const halfR = Math.abs(this.right.width) / 2;
    const cx = this.stageWidth / 2;
    this.left.visible = this.right.visible = true;
    this.left.position.set(-halfL, this.floorY);
    this.right.position.set(this.stageWidth + halfR, this.floorY);
    const leftTarget = cx - gap / 2 - halfL;
    const rightTarget = cx + gap / 2 + halfR;
    const ok = await Promise.all([
      this.tweens.to(this.left, { x: leftTarget }, { duration: runMs, ease: easings.linear }),
      this.tweens.to(this.right, { x: rightTarget }, { duration: runMs, ease: easings.linear }),
    ]);
    if (!ok.every(Boolean) || this.finished) return;
    this.left.visible = this.right.visible = false;
    this.hug.visible = true;
    this.hug.position.set(cx, this.floorY);
    const hugScale = LAYOUT.celebrationHugHeight / this.hug.texture.height;
    this.hug.scale.set(hugScale * 0.94);
    this.hug.alpha = 0;
    void this.tweens.to(this.hug, { alpha: 1 }, { duration: hugPopMs });
    if (
      !(await this.tweens.to(
        this.hug.scale,
        { x: hugScale, y: hugScale },
        { duration: hugPopMs, ease: easings.quadOut },
      ))
    )
      return;
    if (!(await this.tweens.delay(hugToHeartMs))) return;
    this.heart.visible = true;
    const heartScale = LAYOUT.celebrationHeartHeight / this.heart.texture.height;
    this.heart.position.set(cx, this.floorY - this.hug.height - 6);
    this.heart.alpha = 0;
    this.heart.scale.set(heartScale * 0.6);
    void this.tweens.to(this.heart, { alpha: 1 }, { duration: heartMs * 0.2 });
    if (
      !(await this.tweens.to(
        this.heart.scale,
        { x: heartScale * 1.15, y: heartScale * 1.15 },
        { duration: heartMs * 0.5, ease: easings.quadOut },
      ))
    )
      return;
    if (
      !(await this.tweens.to(
        this.heart.scale,
        { x: heartScale, y: heartScale },
        { duration: heartMs * 0.5, ease: easings.quadOut },
      ))
    )
      return;
    this.finished = true;
    this.running = false;
  }

  /** Jump to the final hug + heart frame. */
  skip(): void {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    this.placeFinal();
  }

  update(deltaMS: number): void {
    if (!this.running || this.finished || !this.left.visible) return;
    this.elapsed += deltaMS;
    const { bobMs } = TIMING.celebration;
    const phase = (this.elapsed % (bobMs * 2)) / (bobMs * 2);
    const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2;
    const bob = -4 * tri;
    const rot = (-1.5 + 3 * tri) * (Math.PI / 180);
    this.left.y = this.floorY + bob;
    this.right.y = this.floorY + bob;
    this.left.rotation = rot;
    this.right.rotation = -rot;
  }

  private placeFinal(): void {
    const cx = this.stageWidth / 2;
    this.left.visible = this.right.visible = false;
    this.hug.visible = this.heart.visible = true;
    this.hug.alpha = this.heart.alpha = 1;
    this.hug.scale.set(LAYOUT.celebrationHugHeight / this.hug.texture.height);
    this.heart.scale.set(LAYOUT.celebrationHeartHeight / this.heart.texture.height);
    this.hug.position.set(cx, this.floorY);
    this.heart.position.set(cx, this.floorY - this.hug.height - 6);
  }
}
