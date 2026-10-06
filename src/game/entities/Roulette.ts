import { Assets, Container, FillGradient, Graphics, Sprite, type Texture } from 'pixi.js';
import { TIMING, type World } from '../../config';
import { mulberry32 } from '../board/rng';
import { Component } from '../core/Component';
import { clamp, fitContain, type Viewport } from '../core/layout';
import type { TweenGroup, Tween } from '../core/Tween';
import { ACTIVITY_IDS, getActivity } from '../data/activities';
import { rollDrop } from '../loot/loot';
import type { DropResult } from '../loot/types';
import { easings } from '../theme/ease';
import type { ThemeConfig } from '../theme';
import { drawCorners, drawPanel, goldGradient, rgba } from '../ui/draw';
import { LocalizedText, makeText } from '../ui/text';
import type { BurstFx } from './Particles';

export interface RouletteOptions {
  theme: ThemeConfig;
  tweens: TweenGroup;
  fx: BurstFx;
  world: World;
  /** The pre-rolled outcome the strip must land on. */
  drop: DropResult;
  seed: number;
  weights: { bonus: number; nothing: number; activity: number };
  bonusPoints: number;
  fast?: boolean;
}

type RoulettePhase = 'idle' | 'spinning' | 'landed' | 'closed';

interface Cell {
  root: Container;
  bg: Graphics;
  item: DropResult;
  paintedW: number;
}

/**
 * Case-opening roulette: a strip of possible rewards scrolls under a centre marker, decelerates
 * and lands on the pre-rolled drop. Modal — covers the scene and swallows taps (tap to skip the
 * spin, tap to close once landed). `play()` resolves when the player dismisses it.
 */
export class Roulette extends Component {
  private readonly opts: RouletteOptions;
  private readonly dim = new Graphics();
  private readonly panel = new Graphics();
  private readonly corners = new Graphics();
  private readonly viewportMask = new Graphics();
  private readonly fades = new Graphics();
  private readonly strip = new Container();
  private readonly marker = new Graphics();
  private readonly title: LocalizedText;
  private readonly hint: LocalizedText;
  private readonly cells: Cell[] = [];
  private cellW = 110;
  private cellH = 124;
  private gap = 8;
  private panelW = 760;
  private panelH = 230;
  private panelX = 0;
  private panelY = 0;
  private spin: Tween | null = null;
  private endX = 0;
  private phase: RoulettePhase = 'idle';
  private lastIndex = -1;
  private resolveClose: (() => void) | null = null;
  private elapsed = 0;

  constructor(opts: RouletteOptions) {
    super();
    this.opts = opts;
    const { theme } = opts;
    this.dim.eventMode = 'static';
    this.title = new LocalizedText(theme, 'eyebrow', 'roulette.opening');
    this.title.anchor.set(0.5);
    this.hint = new LocalizedText(theme, 'caption', 'roulette.skip');
    this.hint.anchor.set(0.5);
    this.strip.mask = this.viewportMask;
    this.addChild(
      this.dim,
      this.panel,
      this.corners,
      this.viewportMask,
      this.strip,
      this.fades,
      this.marker,
      this.title,
      this.hint,
    );
    this.buildCells();
    this.listen(this, 'pointertap', () => this.onTap());
    this.eventMode = 'static';
  }

  layout(vp: Viewport): void {
    const { width: w, height: h, safe } = vp;
    const theme = this.opts.theme;
    const c = theme.colors;
    this.dim.clear().rect(0, 0, w, h).fill({ color: c.bgTo, alpha: 0.72 });

    this.cellW = vp.portrait ? 84 : 110;
    this.cellH = vp.portrait ? 100 : 124;
    this.panelW = Math.min(w - safe * 2, vp.portrait ? 420 : 780);
    this.panelH = this.cellH + 96;
    this.panelX = (w - this.panelW) / 2;
    this.panelY = (h - this.panelH) / 2;
    drawPanel(this.panel, theme, this.panelW, this.panelH, { raised: true, glow: true });
    this.panel.position.set(this.panelX, this.panelY);
    drawCorners(this.corners.clear(), theme, this.panelW, this.panelH);
    this.corners.position.set(this.panelX, this.panelY);

    const stripY = this.panelY + 54;
    const innerX = this.panelX + 10;
    const innerW = this.panelW - 20;
    this.viewportMask
      .clear()
      .rect(innerX, stripY - 6, innerW, this.cellH + 12)
      .fill({ color: 0xffffff });
    this.strip.position.set(this.strip.x, stripY);
    this.cells.forEach((cell, i) => this.placeCell(cell, i));

    // Edge fades and the centre marker.
    const fadeW = Math.min(120, innerW * 0.25);
    const surface = c.surfaceRaised;
    const grad = (dir: 1 | -1) =>
      new FillGradient({
        type: 'linear',
        start: { x: dir === 1 ? 0 : 1, y: 0 },
        end: { x: dir === 1 ? 1 : 0, y: 0 },
        colorStops: [
          { offset: 0, color: rgba(surface, 0.95) },
          { offset: 1, color: rgba(surface, 0) },
        ],
        textureSpace: 'local',
      });
    this.fades
      .clear()
      .rect(innerX, stripY - 6, fadeW, this.cellH + 12)
      .fill(grad(1))
      .rect(innerX + innerW - fadeW, stripY - 6, fadeW, this.cellH + 12)
      .fill(grad(-1));
    const cx = this.panelX + this.panelW / 2;
    this.marker
      .clear()
      .rect(cx - 1.5, stripY - 10, 3, this.cellH + 20)
      .fill({ color: c.accentBright })
      .poly([cx - 9, stripY - 18, cx + 9, stripY - 18, cx, stripY - 6], true)
      .fill({ color: c.accentBright })
      .poly(
        [
          cx - 9,
          stripY + this.cellH + 18,
          cx + 9,
          stripY + this.cellH + 18,
          cx,
          stripY + this.cellH + 6,
        ],
        true,
      )
      .fill({ color: c.accentBright });
    this.marker.alpha = 0.95;

    this.title.position.set(cx, this.panelY + 28);
    this.hint.position.set(cx, this.panelY + this.panelH - 22);
    this.hint.style.wordWrapWidth = this.panelW - 40;
    this.hint.style.wordWrap = true;

    // Keep the current scroll consistent with the new geometry.
    if (this.phase === 'idle') this.strip.x = this.offsetForIndex(2);
    else if (this.phase !== 'spinning')
      this.strip.x = this.offsetForIndex(TIMING.roulette.winnerIndex);
    this.endX = this.offsetForIndex(TIMING.roulette.winnerIndex);
  }

  update(deltaMS: number): void {
    this.elapsed += deltaMS;
    if (this.phase === 'spinning') {
      const idx = this.indexUnderMarker();
      if (idx !== this.lastIndex) {
        this.lastIndex = idx;
        const cell = this.cells[idx];
        if (cell) {
          cell.root.scale.set(1.08);
          void this.opts.tweens.to(
            cell.root.scale,
            { x: 1, y: 1 },
            { duration: 140, ease: easings.quadOut },
          );
        }
        this.marker.alpha = 1;
        void this.opts.tweens.to(this.marker, { alpha: 0.85 }, { duration: 120 });
      }
    } else if (this.phase === 'landed') {
      const winner = this.cells[TIMING.roulette.winnerIndex];
      const pulse = 1.12 + 0.03 * Math.sin(this.elapsed / 180);
      winner?.root.scale.set(pulse);
    }
  }

  /** Spin, land, wait for dismissal. */
  async play(): Promise<void> {
    if (this.phase !== 'idle') return;
    this.phase = 'spinning';
    this.alpha = 0;
    void this.opts.tweens.to(this as Container, { alpha: 1 }, { duration: 220 });
    const { spinMs, fastSpinMs, settleMs } = TIMING.roulette;
    // Land slightly off-centre first (feels mechanical), then settle onto the winner.
    const rng = mulberry32(this.opts.seed ^ 0x51f15e);
    const jitter = (rng() - 0.5) * this.cellW * 0.7;
    this.strip.x = this.offsetForIndex(2);
    this.spin = this.opts.tweens.to(
      this.strip,
      { x: this.endX + jitter },
      { duration: this.opts.fast ? fastSpinMs : spinMs, ease: easings.quintOut },
    );
    const finished = await this.spin;
    this.spin = null;
    if (this.isDisposed) return;
    if (finished) {
      if (
        !(await this.opts.tweens.to(
          this.strip,
          { x: this.endX },
          { duration: settleMs, ease: easings.backOut },
        ))
      )
        return;
      this.land();
    }
    // (When skipped, `skip()` has already landed.)
    if (this.currentPhase() !== 'landed') return;
    const closed = new Promise<void>((resolve) => {
      this.resolveClose = resolve;
    });
    void this.opts.tweens.delay(TIMING.roulette.holdMs * (this.opts.fast ? 0.7 : 1)).then((ok) => {
      if (ok) this.close();
    });
    await closed;
  }

  /** Jump to the end of the spin. */
  skip(): void {
    if (this.phase !== 'spinning' || !this.spin) return;
    const spin = this.spin;
    this.spin = null;
    this.strip.x = this.endX;
    this.land();
    spin.cancel();
  }

  /** Un-narrowed read of `phase` (TS narrows `this.phase` after assignments within a method). */
  private currentPhase(): RoulettePhase {
    return this.phase;
  }

  private onTap(): void {
    if (this.phase === 'spinning') {
      this.skip();
      void this.opts.tweens.delay(400).then((ok) => {
        if (ok && this.phase === 'landed') this.close();
      });
    } else if (this.phase === 'landed') {
      this.close();
    }
  }

  private land(): void {
    if (this.phase === 'landed' || this.phase === 'closed') return;
    this.phase = 'landed';
    const { theme, fx, drop } = this.opts;
    const c = theme.colors;
    const winner = this.cells[TIMING.roulette.winnerIndex];
    if (winner) {
      this.paintCell(winner, true);
      const gx = this.panelX + this.panelW / 2;
      const gy = this.strip.y + this.cellH / 2;
      fx.burst(gx, gy, 18, [c.accentBright, c.glow, ...c.particles], 320, 1.6);
    }
    if (drop.kind === 'bonus') this.title.setKey('roulette.bonus', { n: drop.points });
    else if (drop.kind === 'nothing') this.title.setKey('roulette.nothing');
    else {
      const activity = getActivity(drop.id);
      this.title.setKey(activity ? activity.nameKey : 'drop.activity');
      this.title.style.fill = c.glow;
    }
    this.title.style.fontSize = 16;
    this.title.style.letterSpacing = 2;
    this.hint.setKey('roulette.continue');
  }

  private close(): void {
    if (this.phase === 'closed') return;
    this.phase = 'closed';
    const resolve = this.resolveClose;
    this.resolveClose = null;
    void this.opts.tweens
      .to(this as Container, { alpha: 0 }, { duration: 200 })
      .then(() => resolve?.());
  }

  // ------------------------------------------------------------------ cells

  private buildCells(): void {
    const { theme, drop, seed, weights, bonusPoints } = this.opts;
    const rng = mulberry32(seed);
    const { cells: count, winnerIndex } = TIMING.roulette;
    for (let i = 0; i < count; i++) {
      const item: DropResult =
        i === winnerIndex ? drop : rollDrop(weights, rng, ACTIVITY_IDS, bonusPoints);
      const root = new Container();
      const bg = new Graphics();
      root.addChild(bg);
      const cell: Cell = { root, bg, item, paintedW: 0 };
      this.paintCell(cell, false);
      this.cells.push(cell);
      this.strip.addChild(root);
      void theme;
    }
  }

  private paintCell(cell: Cell, winner: boolean): void {
    const { theme } = this.opts;
    const c = theme.colors;
    const w = this.cellW;
    const h = this.cellH;
    cell.paintedW = w;
    // Remove previous content except the bg.
    for (const child of [...cell.root.children]) if (child !== cell.bg) child.destroy();
    cell.root.pivot.set(w / 2, h / 2);
    cell.root.position.set(cell.root.x, cell.root.y);
    const isActivity = cell.item.kind === 'activity';
    drawPanel(cell.bg, theme, w, h, {
      raised: isActivity || winner,
      alpha: isActivity ? 0.95 : 0.7,
      glow: winner,
    });
    if (isActivity) {
      cell.bg.roundRect(2, 2, w - 4, h - 4, theme.shape.radius).stroke({
        width: 1.5,
        alignment: 1,
        ...(theme.shape.buttonBorder === 'gradient'
          ? { fill: goldGradient(theme) }
          : { color: c.accent, alpha: 0.9 }),
      });
    }
    const labelY = h - 10;
    if (cell.item.kind === 'activity') {
      const activity = getActivity(cell.item.id);
      const alias = activity ? theme.assets.activities[activity.index] : null;
      if (alias && Assets.cache.has(alias)) {
        const art = new Sprite(Assets.get<Texture>(alias));
        art.anchor.set(0.5, 1);
        const box = Math.min(w - 20, h - 40);
        art.scale.set(fitContain(art.texture.width, art.texture.height, box, box));
        art.position.set(w / 2, h - 32);
        cell.root.addChild(art);
      }
      const name = activity
        ? new LocalizedText(theme, 'small', activity.nameKey, undefined, {
            fontSize: 10,
            fill: c.text,
            align: 'center',
            wordWrap: true,
            wordWrapWidth: w - 10,
            breakWords: true,
          })
        : null;
      if (name) {
        name.anchor.set(0.5, 1);
        name.position.set(w / 2, labelY + 2);
        cell.root.addChild(name);
      }
    } else if (cell.item.kind === 'bonus') {
      const coin = new Graphics();
      const r = Math.min(w, h) * 0.2;
      coin
        .circle(0, 0, r)
        .fill(theme.shape.buttonBorder === 'gradient' ? goldGradient(theme) : { color: c.accent });
      coin.circle(0, 0, r).stroke({ width: 2, alignment: 1, color: c.accentBright, alpha: 0.9 });
      coin
        .poly([0, -r * 0.55, r * 0.5, 0, 0, r * 0.55, -r * 0.5, 0], true)
        .fill({ color: c.textOnAccent, alpha: 0.85 });
      coin.position.set(w / 2, h / 2 - 12);
      cell.root.addChild(coin);
      const label = makeText(theme, 'price', `+${cell.item.points}`, {
        fontSize: 13,
        fill: c.accentBright,
      });
      label.anchor.set(0.5, 1);
      label.position.set(w / 2, labelY);
      cell.root.addChild(label);
    } else {
      const ring = new Graphics();
      const r = Math.min(w, h) * 0.18;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        ring
          .arc(0, 0, r, a, a + Math.PI / 8)
          .stroke({ width: 2, color: c.textMuted, alpha: 0.55, cap: 'round' });
      }
      ring.position.set(w / 2, h / 2 - 12);
      cell.root.addChild(ring);
      const label = new LocalizedText(theme, 'small', 'drop.nothing', undefined, {
        fontSize: 11,
        fill: c.textMuted,
      });
      label.anchor.set(0.5, 1);
      label.position.set(w / 2, labelY);
      cell.root.addChild(label);
    }
  }

  private placeCell(cell: Cell, i: number): void {
    if (cell.paintedW !== this.cellW)
      this.paintCell(cell, this.phase === 'landed' && i === TIMING.roulette.winnerIndex);
    cell.root.pivot.set(this.cellW / 2, this.cellH / 2);
    cell.root.position.set(i * (this.cellW + this.gap) + this.cellW / 2, this.cellH / 2);
  }

  /** strip.x that puts cell `i` under the centre marker. */
  private offsetForIndex(i: number): number {
    const cx = this.panelX + this.panelW / 2;
    return cx - (i * (this.cellW + this.gap) + this.cellW / 2);
  }

  private indexUnderMarker(): number {
    const cx = this.panelX + this.panelW / 2;
    const local = cx - this.strip.x;
    return clamp(
      Math.round((local - this.cellW / 2) / (this.cellW + this.gap)),
      0,
      this.cells.length - 1,
    );
  }
}
