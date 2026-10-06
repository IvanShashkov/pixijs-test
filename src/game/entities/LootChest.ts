import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { TIMING } from '../../config';
import { Component } from '../core/Component';
import { clamp, fitContain } from '../core/layout';
import type { TweenGroup } from '../core/Tween';
import { getActivity } from '../data/activities';
import type { DropResult } from '../loot/types';
import { alias } from '../theme/assets';
import { easings } from '../theme/ease';
import type { ThemeConfig } from '../theme';
import { LocalizedText, makeText } from '../ui/text';
import type { BurstFx } from './Particles';

export interface LootChestOptions {
  theme: ThemeConfig;
  tweens: TweenGroup;
  fx: BurstFx;
  size: number;
  drop: DropResult;
  /** Called once, when the content is revealed (the scene applies store effects here). */
  onReveal: (drop: DropResult) => void;
  /** Runs between the shake and the reveal (the Results scene plugs the roulette in here). */
  beforeReveal?: () => Promise<void>;
}

export type LootState = 'closed' | 'opening' | 'open';

/**
 * One chest / container on the Results screen. Origin = bottom centre of the chest.
 * Tap (or `open()`) shakes it, pops the whirlwind, swaps to the open art and shows the reward.
 */
export class LootChest extends Component {
  state: LootState = 'closed';
  private readonly opts: LootChestOptions;
  private readonly sprite: Sprite;
  private readonly whirl: Sprite;
  private readonly reward = new Container();
  private flipTimer = 0;
  private whirlScale = 1;
  private size: number;
  private elapsed = 0;
  private sparkleTimer = 0;
  private readonly bobPhase = Math.random() * Math.PI * 2;

  constructor(opts: LootChestOptions) {
    super();
    this.opts = opts;
    const { theme } = opts;
    this.size = opts.size;
    this.sprite = new Sprite(Assets.get<Texture>(theme.assets.loot.closed));
    this.sprite.anchor.set(0.5, 1);
    this.whirl = new Sprite(Assets.get<Texture>(alias.fx('whirl')));
    this.whirl.anchor.set(0.5, 0.82);
    this.whirl.visible = false;
    this.reward.visible = false;
    this.addChild(this.sprite, this.whirl, this.reward);
    this.setSize(opts.size);

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = {
      contains: (x, y) => Math.abs(x) <= this.size / 2 && y <= 0 && y >= -this.size,
    };
    this.listen(this, 'pointertap', () => void this.open());
  }

  /** Re-fit the chest (and its reward card) to a new box size; safe to call from layout. */
  setSize(size: number): void {
    this.size = size;
    const s = fitContain(this.sprite.texture.width, this.sprite.texture.height, size, size);
    this.sprite.scale.set(s);
    this.whirlScale = (size * 1.7) / this.whirl.texture.height;
    this.reward.position.set(0, -size - 10);
    if (this.reward.visible) this.showReward(false, false);
  }

  async open(): Promise<void> {
    if (this.state !== 'closed') return;
    this.state = 'opening';
    this.cursor = 'default';
    const { tweens, theme, fx } = this.opts;
    const size = this.size;
    // Shake
    for (let i = 0; i < 4; i++) {
      if (
        !(await tweens.to(
          this as Container,
          { rotation: i % 2 === 0 ? 0.08 : -0.08 },
          { duration: TIMING.lootShakeMs / 4, ease: easings.sineInOut },
        ))
      )
        return;
    }
    this.rotation = 0;
    this.sprite.y = 0;
    if (this.opts.beforeReveal) {
      await this.opts.beforeReveal();
      if (this.isDisposed) return;
    }
    // Whirl pop (sibling keyframes), swap art at the midpoint.
    this.whirl.visible = true;
    this.whirl.alpha = 0;
    this.whirl.scale.set(this.whirlScale * 0.25);
    const total = TIMING.whirlMs;
    const seq: Array<[number, number, number]> = [
      [1.07, total * 0.22, 1],
      [1, total * 0.16, 1],
      [1.02, total * 0.34, 1],
      [0.3, total * 0.28, 0],
    ];
    let elapsed = 0;
    let revealed = false;
    for (const [scale, duration, alpha] of seq) {
      const tw = tweens.to(
        this.whirl.scale,
        { y: this.whirlScale * scale },
        { duration, ease: easings.quadOut },
      );
      void tweens.to(this.whirl, { alpha }, { duration });
      elapsed += duration;
      if (!revealed && elapsed >= total / 2) {
        revealed = true;
        this.sprite.texture = Assets.get<Texture>(theme.assets.loot.open);
        fx.burst(0, -size * 0.5, 14, theme.colors.particles, 300, 1.6);
        this.showReward();
      }
      if (!(await tw)) return;
    }
    this.whirl.visible = false;
    this.state = 'open';
  }

  update(deltaMS: number): void {
    this.elapsed += deltaMS;
    if (this.state === 'closed') {
      // Idle bob + an occasional sparkle so unopened loot invites a tap.
      this.sprite.y =
        -2 + 2 * Math.sin((this.elapsed / TIMING.chestBobMs) * Math.PI * 2 + this.bobPhase);
      this.sparkleTimer += deltaMS;
      if (this.sparkleTimer > TIMING.chestSparkleMs) {
        this.sparkleTimer = (this.bobPhase * 300) % 900;
        const c = this.opts.theme.colors;
        this.opts.fx.burst(
          this.x + (Math.random() - 0.5) * this.size * 0.6,
          this.y - this.size * (0.6 + Math.random() * 0.4),
          3,
          [c.accentBright, c.glow],
          60,
          0.8,
        );
      }
      return;
    }
    if (this.state !== 'opening' || !this.whirl.visible) return;
    this.flipTimer += deltaMS;
    if (this.flipTimer >= TIMING.whirlFlipMs) {
      this.flipTimer = 0;
      this.whirl.scale.x = -this.whirl.scale.x;
      this.whirl.rotation = this.whirl.scale.x > 0 ? -0.024 : 0.024;
    }
    this.whirl.scale.x = Math.sign(this.whirl.scale.x || 1) * Math.abs(this.whirl.scale.y);
  }

  /** Apply the reward without animation (used when leaving the screen early). */
  revealInstantly(): void {
    if (this.state === 'open') return;
    this.state = 'open';
    this.sprite.texture = Assets.get<Texture>(this.opts.theme.assets.loot.open);
    this.showReward(false);
  }

  private showReward(animate = true, notify = true): void {
    const { theme, drop, tweens } = this.opts;
    const size = this.size;
    const k = clamp(size / 96, 0.6, 1);
    const c = theme.colors;
    this.reward.removeChildren().forEach((n) => n.destroy());
    this.reward.visible = true;
    const bg = new Graphics();
    const nodes: Container[] = [];
    let contentWidth = size * 0.8;
    let cursorY = -8;
    if (drop.kind === 'bonus') {
      const label = makeText(theme, 'popup', `+${drop.points}`, {
        fontSize: Math.max(14, 24 * k),
        fill: c.accentBright,
      });
      label.anchor.set(0.5, 1);
      label.position.set(0, cursorY);
      cursorY -= label.height;
      nodes.push(label);
      contentWidth = Math.max(contentWidth, label.width);
    } else if (drop.kind === 'nothing') {
      const label = new LocalizedText(theme, 'body', 'drop.nothing', undefined, {
        fontSize: Math.max(11, 15 * k),
        fill: c.textMuted,
      });
      label.anchor.set(0.5, 1);
      label.position.set(0, cursorY);
      cursorY -= label.height;
      nodes.push(label);
      contentWidth = Math.max(contentWidth, label.width);
    } else {
      const activity = getActivity(drop.id);
      if (activity) {
        const name = new LocalizedText(theme, 'body', activity.nameKey, undefined, {
          fontSize: Math.max(10, 13 * k),
          fill: c.text,
          align: 'center',
          wordWrap: true,
          wordWrapWidth: size * 1.1,
        });
        name.anchor.set(0.5, 1);
        name.position.set(0, cursorY);
        cursorY -= name.height + 2;
        nodes.push(name);
        contentWidth = Math.max(contentWidth, name.width);
      }
      const eyebrow = new LocalizedText(theme, 'eyebrow', 'drop.activity', undefined, {
        fontSize: Math.max(8, 10 * k),
        letterSpacing: 1.5,
        fill: c.glow,
      });
      eyebrow.anchor.set(0.5, 1);
      eyebrow.position.set(0, cursorY);
      cursorY -= eyebrow.height + 6;
      nodes.push(eyebrow);
      contentWidth = Math.max(contentWidth, eyebrow.width);
      const texAlias = activity ? theme.assets.activities[activity.index] : null;
      if (texAlias && Assets.cache.has(texAlias)) {
        const art = new Sprite(Assets.get<Texture>(texAlias));
        art.anchor.set(0.5, 1);
        const box = size * 0.9;
        const fit = fitContain(art.texture.width, art.texture.height, box, box);
        art.scale.set(fit);
        art.position.set(0, cursorY);
        cursorY -= box;
        nodes.push(art);
        if (animate) {
          art.scale.set(fit * 0.6);
          void tweens.to(art.scale, { x: fit, y: fit }, { duration: 350, ease: easings.backOut });
        }
      }
    }
    const w = Math.ceil(contentWidth) + 16;
    const h = -cursorY + 8;
    bg.roundRect(-w / 2, -h, w, h, theme.shape.radius * 2).fill({ color: c.surface, alpha: 0.78 });
    bg.roundRect(-w / 2, -h, w, h, theme.shape.radius * 2).stroke({
      width: 1,
      alignment: 1,
      color: c.border,
      alpha: c.borderAlpha,
    });
    this.reward.addChild(bg, ...nodes);
    if (animate) {
      this.reward.alpha = 0;
      this.reward.y = -size + 10;
      void tweens.to(
        this.reward,
        { alpha: 1, y: -size - 10 },
        { duration: 320, ease: easings.backOut },
      );
    } else {
      this.reward.alpha = 1;
      this.reward.y = -size - 10;
    }
    if (notify) this.opts.onReveal(drop);
  }
}
