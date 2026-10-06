import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';
import { Component } from '../core/Component';
import { TIMING } from '../../config';
import type { TweenGroup } from '../core/Tween';
import { easings } from '../theme/ease';
import type { ThemeConfig } from '../theme';
import { makeText, type TextVariant } from '../ui/text';

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

/**
 * Pooled sprite bursts for match clears and chest openings. One generated 8 px disc texture is
 * shared; particles are tinted per call. Advance with `update(deltaMS)` from the owner.
 */
export class BurstFx extends Component {
  private readonly texture: Texture;
  private readonly pool: Sprite[] = [];
  private readonly live: Particle[] = [];
  private seed = 1;

  constructor(renderer: Renderer) {
    super();
    const g = new Graphics().circle(4, 4, 4).fill({ color: 0xffffff });
    this.texture = this.ownTexture(renderer.generateTexture({ target: g, resolution: 2 }));
    g.destroy();
    this.eventMode = 'none';
  }

  burst(x: number, y: number, count: number, colors: number[], speed = 240, size = 1): void {
    for (let i = 0; i < count; i++) {
      const sprite = this.pool.pop() ?? new Sprite(this.texture);
      sprite.anchor.set(0.5);
      sprite.tint = colors[i % colors.length];
      sprite.position.set(x, y);
      const s = size * (0.6 + this.rnd() * 0.8);
      sprite.scale.set(s);
      sprite.alpha = 1;
      sprite.visible = true;
      this.addChild(sprite);
      const angle = this.rnd() * Math.PI * 2;
      const v = speed * (0.6 + this.rnd() * 0.7);
      const life = 320 + this.rnd() * 200;
      this.live.push({
        sprite,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - speed * 0.4,
        life,
        maxLife: life,
      });
    }
  }

  update(deltaMS: number): void {
    const dt = deltaMS / 1000;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= deltaMS;
      p.vy += 700 * dt;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.sprite.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life <= 0) {
        p.sprite.visible = false;
        this.removeChild(p.sprite);
        this.pool.push(p.sprite);
        this.live.splice(i, 1);
      }
    }
  }

  private rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}

/** Floating "+120" / "×3" popups that rise and fade. */
export class FloatingText extends Component {
  private readonly theme: ThemeConfig;
  private readonly tweens: TweenGroup;

  constructor(theme: ThemeConfig, tweens: TweenGroup) {
    super();
    this.theme = theme;
    this.tweens = tweens;
    this.eventMode = 'none';
  }

  show(
    text: string,
    x: number,
    y: number,
    variant: TextVariant = 'popup',
    color?: number,
    rise = 40,
  ): void {
    const node = makeText(
      this.theme,
      variant,
      text,
      color !== undefined ? { fill: color } : undefined,
    );
    node.anchor.set(0.5);
    node.position.set(x, y);
    node.scale.set(0.6);
    this.addChild(node);
    const run = async () => {
      void this.tweens.to(node.scale, { x: 1, y: 1 }, { duration: 180, ease: easings.backOut });
      const ok = await this.tweens.to(
        node,
        { y: y - rise, alpha: 0 },
        { duration: TIMING.comboPopupMs, ease: easings.quadIn, delay: 120 },
      );
      if (ok || !node.destroyed) node.destroy();
    };
    void run();
  }

  /** Wrap an arbitrary container the same way (e.g. an icon). */
  float(node: Container, x: number, y: number, rise = 40): void {
    node.position.set(x, y);
    this.addChild(node);
    void this.tweens
      .to(
        node,
        { y: y - rise, alpha: 0 },
        { duration: TIMING.comboPopupMs, ease: easings.quadIn, delay: 200 },
      )
      .then(() => {
        if (!node.destroyed) node.destroy();
      });
  }
}
