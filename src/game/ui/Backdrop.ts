import { Assets, Container, FillGradient, Graphics, Sprite, type Texture } from 'pixi.js';
import type { World } from '../../config';
import { loadBackground } from '../../assets/loadAssets';
import { Component } from '../core/Component';
import { fitCover, type Viewport } from '../core/layout';
import type { ThemeConfig } from '../theme';
import { rgba } from './draw';

export interface BackdropOptions {
  theme: ThemeConfig;
  world: World;
  /** Alpha of the dark tint over the photo (default 0.55). */
  tint?: number;
  /** Show the painted world photo (default true); false = gradient only. */
  photo?: boolean;
}

/**
 * Full-screen background: world photo (orientation-specific, cover-fit) under a tint, a
 * vignette and the world's ambient particles (gold star field for WoW, drifting glows for
 * Horizon). The photo texture is looked up from Assets at layout time, so it appears as soon
 * as the orientation bundle has loaded.
 */
export class Backdrop extends Component {
  private readonly theme: ThemeConfig;
  private readonly opts: BackdropOptions;
  private readonly gradient = new Graphics();
  private readonly photo = new Sprite();
  private readonly tintLayer = new Graphics();
  private readonly vignette = new Graphics();
  private readonly particles = new Container();
  private stars: Array<{ sprite: Sprite; phase: number; speed: number }> = [];
  private glows: Array<{ g: Graphics; ox: number; oy: number; phase: number }> = [];
  private elapsed = 0;
  private lastSize = { w: 0, h: 0 };
  private lastViewport: Viewport | null = null;
  private pendingLoad: string | null = null;

  constructor(opts: BackdropOptions) {
    super();
    this.theme = opts.theme;
    this.opts = opts;
    this.eventMode = 'none';
    this.interactiveChildren = false;
    this.photo.visible = false;
    this.addChild(this.gradient, this.photo, this.tintLayer, this.particles, this.vignette);
  }

  layout(vp: Viewport): void {
    const { width: w, height: h } = vp;
    const c = this.theme.colors;
    const sizeChanged = w !== this.lastSize.w || h !== this.lastSize.h;
    this.lastSize = { w, h };
    this.lastViewport = vp;

    this.gradient
      .clear()
      .rect(0, 0, w, h)
      .fill(
        new FillGradient({
          type: 'radial',
          center: { x: 0.5, y: 0 },
          innerRadius: 0,
          outerCenter: { x: 0.5, y: 0 },
          outerRadius: 1.1,
          colorStops: [
            { offset: 0, color: c.bgMid },
            { offset: 0.45, color: c.bgFrom },
            { offset: 1, color: c.bgTo },
          ],
          textureSpace: 'local',
        }),
      );

    if (this.opts.photo !== false) {
      const alias = vp.portrait
        ? this.theme.assets.background.portrait
        : this.theme.assets.background.landscape;
      const texture = Assets.cache.has(alias) ? Assets.get<Texture>(alias) : null;
      if (texture) {
        this.photo.texture = texture;
        this.photo.visible = true;
        const s = fitCover(texture.width, texture.height, w, h);
        this.photo.scale.set(s);
        this.photo.position.set((w - texture.width * s) / 2, (h - texture.height * s) / 2);
      } else {
        this.photo.visible = false;
        const orientation = vp.portrait ? 'portrait' : 'landscape';
        if (this.pendingLoad !== alias) {
          this.pendingLoad = alias;
          void loadBackground(this.opts.world, orientation).then(() => {
            if (!this.isDisposed && this.lastViewport) this.layout(this.lastViewport);
          });
        }
      }
    }

    this.tintLayer
      .clear()
      .rect(0, 0, w, h)
      .fill({ color: c.bg, alpha: this.opts.tint ?? 0.55 });
    this.vignette
      .clear()
      .rect(0, 0, w, h)
      .fill(
        new FillGradient({
          type: 'radial',
          center: { x: 0.5, y: 0.5 },
          innerRadius: 0,
          outerCenter: { x: 0.5, y: 0.5 },
          outerRadius: 0.75,
          colorStops: [
            { offset: 0, color: rgba(c.bgTo, 0) },
            { offset: 0.6, color: rgba(c.bgTo, 0.1) },
            { offset: 1, color: rgba(c.bgTo, 0.7) },
          ],
          textureSpace: 'local',
        }),
      );

    if (sizeChanged) this.buildParticles(w, h);
  }

  update(deltaMS: number): void {
    this.elapsed += deltaMS;
    const t = this.elapsed / 1000;
    for (const s of this.stars)
      s.sprite.alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
    for (const g of this.glows) {
      g.g.position.set(
        g.ox + Math.sin(t * 0.21 + g.phase) * 24,
        g.oy + Math.cos(t * 0.17 + g.phase) * 18,
      );
      g.g.alpha = 0.8 + 0.2 * Math.sin(t * 0.6 + g.phase);
    }
  }

  private buildParticles(w: number, h: number): void {
    this.particles.removeChildren().forEach((child) => child.destroy());
    this.stars = [];
    this.glows = [];
    const c = this.theme.colors;
    if (this.theme.backdrop === 'stars') {
      const count = Math.round(Math.min(90, (w * h) / 14000));
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
      for (let i = 0; i < count; i++) {
        const g = new Graphics();
        const r = 1 + rnd() * 1.6;
        const color = c.particles[i % c.particles.length];
        g.circle(0, 0, r * 2.6).fill({ color, alpha: 0.12 });
        g.circle(0, 0, r).fill({ color, alpha: 0.95 });
        g.position.set(rnd() * w, rnd() * h);
        this.particles.addChild(g);
        this.stars.push({
          sprite: g as unknown as Sprite,
          phase: rnd() * Math.PI * 2,
          speed: 0.6 + rnd() * 1.4,
        });
      }
      return;
    }
    const spots: Array<[number, number, number, number]> = [
      [0.28, 0.3, c.accent, 0.3],
      [0.72, 0.75, c.secondary, 0.3],
    ];
    for (const [fx, fy, color, alpha] of spots) {
      const radius = Math.max(w, h) * 0.32;
      const g = new Graphics().circle(0, 0, radius).fill(
        new FillGradient({
          type: 'radial',
          center: { x: 0.5, y: 0.5 },
          innerRadius: 0,
          outerCenter: { x: 0.5, y: 0.5 },
          outerRadius: 0.5,
          colorStops: [
            { offset: 0, color: rgba(color, alpha) },
            { offset: 0.5, color: rgba(color, alpha * 0.35) },
            { offset: 1, color: rgba(color, 0) },
          ],
          textureSpace: 'local',
        }),
      );
      g.blendMode = 'add';
      g.position.set(fx * w, fy * h);
      this.particles.addChild(g);
      this.glows.push({ g, ox: fx * w, oy: fy * h, phase: fx * 10 });
    }
  }
}
