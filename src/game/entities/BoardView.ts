import {
  Assets,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  type FederatedPointerEvent,
  type Renderer,
  type Texture,
  type Ticker,
} from 'pixi.js';
import { TIMING } from '../../config';
import { t } from '../../i18n';
import {
  areAdjacent,
  hasValidMove,
  findValidMoves,
  reshuffle,
  trySwap,
  type Board,
  type BoardRules,
  type CascadeStep,
  type Cell,
  type Rng,
} from '../board';
import { Component } from '../core/Component';
import type { Rect } from '../core/layout';
import type { TweenGroup } from '../core/Tween';
import { easings } from '../theme/ease';
import type { ThemeConfig } from '../theme';
import { drawPanel } from '../ui/draw';
import { BurstFx, FloatingText } from './Particles';

export interface BoardViewOptions {
  theme: ThemeConfig;
  /** Dedicated tween group so the Game scene can freeze the board while paused. */
  tweens: TweenGroup;
  renderer: Renderer;
  rules: BoardRules;
  rng: Rng;
  board: Board;
  onScore?: (delta: number, comboIndex: number, multiplier: number) => void;
  onBusyChange?: (busy: boolean) => void;
  onInvalidSwap?: () => void;
  onReshuffle?: () => void;
  /** Any pointer-down on the board (used to reset the idle hint timer). */
  onInput?: () => void;
}

/** Logical size of one cell; `layout()` scales the whole view so tween targets never go stale. */
const CELL = 100;
const TILE = CELL * 0.86;

type InputState =
  | { kind: 'idle' }
  | { kind: 'pressed'; cell: Cell; startX: number; startY: number; pointerId: number }
  | { kind: 'selected'; cell: Cell };

/**
 * Renders a Board and plays the pure cascade steps back as animation. Supports tap-tap and
 * drag swaps; locks input while animating. Origin is the board's top-left corner.
 */
export class BoardView extends Component {
  model: Board;
  private readonly rules: BoardRules;
  private readonly rng: Rng;
  private readonly theme: ThemeConfig;
  private readonly tweens: TweenGroup;
  private readonly opts: BoardViewOptions;
  private readonly textures: Texture[];
  private readonly panel = new Graphics();
  private readonly grid = new Graphics();
  private readonly tileLayer = new Container();
  private readonly tileMask = new Graphics();
  private readonly selection = new Graphics();
  private readonly fx: BurstFx;
  private readonly popups: FloatingText;
  private tiles: (Sprite | null)[][] = [];
  private readonly pool: Sprite[] = [];
  private input: InputState = { kind: 'idle' };
  private inputEnabled = true;
  private _busy = false;
  private idleResolvers: Array<() => void> = [];
  private elapsed = 0;
  private hinting = false;
  tileSizePx = CELL;

  constructor(opts: BoardViewOptions) {
    super();
    this.opts = opts;
    this.theme = opts.theme;
    this.tweens = opts.tweens;
    this.rules = opts.rules;
    this.rng = opts.rng;
    this.model = opts.board;
    this.textures = opts.theme.assets.gems.map((a) => Assets.get<Texture>(a));
    const w = this.rules.cols * CELL;
    const h = this.rules.rows * CELL;

    drawPanel(this.panel, this.theme, w + 24, h + 24, { alpha: 0.82 });
    this.panel.position.set(-12, -12);
    for (let r = 0; r <= this.rules.rows; r++) this.grid.moveTo(0, r * CELL).lineTo(w, r * CELL);
    for (let c = 0; c <= this.rules.cols; c++) this.grid.moveTo(c * CELL, 0).lineTo(c * CELL, h);
    this.grid.stroke({
      width: 1,
      color: this.theme.colors.border,
      alpha: this.theme.colors.borderAlpha * 0.9,
    });

    this.tileMask.rect(0, -CELL * 0.2, w, h + CELL * 0.2).fill({ color: 0xffffff });
    this.tileLayer.mask = this.tileMask;

    this.fx = new BurstFx(opts.renderer);
    this.popups = new FloatingText(this.theme, this.tweens);
    this.drawSelection();
    this.selection.visible = false;

    this.addChild(
      this.panel,
      this.grid,
      this.tileLayer,
      this.tileMask,
      this.selection,
      this.fx,
      this.popups,
    );
    this.buildTiles();

    this.eventMode = 'static';
    this.hitArea = new Rectangle(0, 0, w, h);
    this.listen(this, 'pointerdown', (e: FederatedPointerEvent) => this.onPointerDown(e));
    this.listen(this, 'globalpointermove', (e: FederatedPointerEvent) => this.onPointerMove(e));
    this.listen(this, 'pointerup', (e: FederatedPointerEvent) => this.onPointerUp(e));
    this.listen(this, 'pointerupoutside', (e: FederatedPointerEvent) => this.onPointerUp(e));
    this.listen(this, 'pointercancel', () => this.resetInput());
    this.onDispose(() => {
      for (const r of this.idleResolvers) r();
      this.idleResolvers = [];
    });
  }

  get busy(): boolean {
    return this._busy;
  }

  /** Logical board size in local units (before scaling). */
  get logicalSize(): { width: number; height: number } {
    return { width: this.rules.cols * CELL, height: this.rules.rows * CELL };
  }

  /** Fit the board into `avail` (screen px) and centre it. */
  layout(avail: Rect): void {
    const tile = Math.floor(
      Math.min(avail.width / this.rules.cols, avail.height / this.rules.rows),
    );
    this.tileSizePx = tile;
    const s = tile / CELL;
    this.scale.set(s);
    const w = this.rules.cols * tile;
    const h = this.rules.rows * tile;
    this.position.set(
      Math.round(avail.x + (avail.width - w) / 2),
      Math.round(avail.y + (avail.height - h) / 2),
    );
  }

  update(ticker: Ticker): void {
    this.elapsed += ticker.deltaMS;
    this.fx.update(ticker.deltaMS);
    if (this.selection.visible) {
      this.selection.alpha =
        0.7 + 0.3 * Math.sin((this.elapsed / TIMING.selectPulseMs) * Math.PI * 2);
    }
  }

  setInputEnabled(on: boolean): void {
    this.inputEnabled = on;
    this.cursor = on ? 'pointer' : 'default';
    if (!on) this.resetInput();
  }

  /** Resolves immediately if idle, otherwise when the current cascade finishes. */
  whenIdle(): Promise<void> {
    if (!this._busy) return Promise.resolve();
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }

  /** Tiles cascade in from above, column by column. Locks input until done. */
  async playIntro(): Promise<void> {
    if (this._busy) return;
    this.setBusy(true);
    const moves: Array<PromiseLike<boolean>> = [];
    this.forEachTile((sprite, r, c) => {
      const target = this.cellCenter({ r, c });
      sprite.y = this.cellCenter({ r: r - this.rules.rows - 1, c }).y;
      moves.push(
        this.tweens
          .to(
            sprite,
            { y: target.y },
            {
              duration: TIMING.fallMsMax,
              delay: c * TIMING.boardIntroStaggerMs + (this.rules.rows - r) * 18,
              ease: easings.quadIn,
            },
          )
          .then(async (ok) => {
            if (!ok) return ok;
            sprite.scale.set(TILE / sprite.texture.width, (TILE / sprite.texture.height) * 0.84);
            await this.tweens.to(
              sprite.scale,
              { y: TILE / sprite.texture.height },
              { duration: 110, ease: easings.quadOut },
            );
            return true;
          }),
      );
    });
    await Promise.all(moves);
    if (!this.isDisposed) this.setBusy(false);
  }

  /** Wiggle the two tiles of a valid move (idle hint). */
  async hintMove(): Promise<void> {
    if (this._busy || this.hinting || !this.inputEnabled || this.isDisposed) return;
    const moves = findValidMoves(this.model);
    if (moves.length === 0) return;
    this.hinting = true;
    const { a, b } = moves[0];
    const sprites = [this.tiles[a.r][a.c], this.tiles[b.r][b.c]].filter((t): t is Sprite => !!t);
    const base = (t: Sprite) => ({ x: TILE / t.texture.width, y: TILE / t.texture.height });
    for (let i = 0; i < 2; i++) {
      await Promise.all(
        sprites.map((t) =>
          this.tweens.to(
            t.scale,
            { x: base(t).x * 1.14, y: base(t).y * 1.14 },
            { duration: 150, ease: easings.quadOut },
          ),
        ),
      );
      if (this.isDisposed) return;
      await Promise.all(
        sprites.map((t) =>
          this.tweens.to(t.scale, base(t), { duration: 170, ease: easings.quadIn }),
        ),
      );
      if (this.isDisposed) return;
    }
    this.hinting = false;
  }

  /** Play the first valid move (dev/e2e hook). */
  async playFirstValidMove(): Promise<boolean> {
    const moves = findValidMoves(this.model);
    if (moves.length === 0 || this._busy) return false;
    return this.trySwap(moves[0].a, moves[0].b);
  }

  /** Swap two cells with animation; resolves `true` when the swap was valid. */
  async trySwap(a: Cell, b: Cell): Promise<boolean> {
    if (this._busy || this.isDisposed) return false;
    this.setBusy(true);
    this.selection.visible = false;
    const sa = this.tiles[a.r][a.c];
    const sb = this.tiles[b.r][b.c];
    if (!sa || !sb) {
      this.setBusy(false);
      return false;
    }
    const pa = this.cellCenter(a);
    const pb = this.cellCenter(b);
    const swapTween = { duration: TIMING.swapMs, ease: this.theme.ease };
    await Promise.all([
      this.tweens.to(sa, { x: pb.x, y: pb.y }, swapTween),
      this.tweens.to(sb, { x: pa.x, y: pa.y }, swapTween),
    ]);
    if (this.isDisposed) return false;

    const outcome = trySwap(this.model, a, b, this.rules, this.rng);
    if (!outcome.valid) {
      await Promise.all([
        this.tweens.to(sa, { x: pa.x, y: pa.y }, swapTween),
        this.tweens.to(sb, { x: pb.x, y: pb.y }, swapTween),
      ]);
      if (this.isDisposed) return false;
      // Head-shake: both tiles jitter sideways.
      for (const dx of [6, -6, 4, -4, 0]) {
        await Promise.all([
          this.tweens.to(sa, { x: pa.x + dx }, { duration: TIMING.shakeMs, ease: easings.linear }),
          this.tweens.to(sb, { x: pb.x + dx }, { duration: TIMING.shakeMs, ease: easings.linear }),
        ]);
        if (this.isDisposed) return false;
      }
      this.opts.onInvalidSwap?.();
      this.setBusy(false);
      return false;
    }
    this.tiles[a.r][a.c] = sb;
    this.tiles[b.r][b.c] = sa;
    this.model = outcome.swapped;
    await this.playSteps(outcome.steps);
    if (this.isDisposed) return true;
    if (!hasValidMove(this.model)) await this.playReshuffle();
    this.setBusy(false);
    return true;
  }

  async reshuffleNow(): Promise<void> {
    if (this._busy) return;
    this.setBusy(true);
    await this.playReshuffle();
    this.setBusy(false);
  }

  // ---------------------------------------------------------------- input

  private onPointerDown(e: FederatedPointerEvent): void {
    this.opts.onInput?.();
    if (!this.inputEnabled || this._busy) return;
    const cell = this.cellAt(e);
    if (!cell) return;
    if (this.input.kind === 'selected') {
      const sel = this.input.cell;
      if (sel.r === cell.r && sel.c === cell.c) {
        this.resetInput();
        return;
      }
      if (areAdjacent(sel, cell)) {
        this.input = { kind: 'idle' };
        void this.trySwap(sel, cell);
        return;
      }
    }
    const local = this.toLocal(e.global);
    this.input = {
      kind: 'pressed',
      cell,
      startX: local.x,
      startY: local.y,
      pointerId: e.pointerId,
    };
    this.showSelection(cell);
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (this.input.kind !== 'pressed' || e.pointerId !== this.input.pointerId) return;
    const local = this.toLocal(e.global);
    const dx = local.x - this.input.startX;
    const dy = local.y - this.input.startY;
    const threshold = CELL * TIMING.dragThresholdCells;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    const from = this.input.cell;
    const to: Cell =
      Math.abs(dx) > Math.abs(dy)
        ? { r: from.r, c: from.c + Math.sign(dx) }
        : { r: from.r + Math.sign(dy), c: from.c };
    if (to.r < 0 || to.c < 0 || to.r >= this.rules.rows || to.c >= this.rules.cols) return;
    this.input = { kind: 'idle' };
    void this.trySwap(from, to);
  }

  private onPointerUp(e: FederatedPointerEvent): void {
    if (this.input.kind !== 'pressed' || e.pointerId !== this.input.pointerId) return;
    this.input = { kind: 'selected', cell: this.input.cell };
  }

  private resetInput(): void {
    this.input = { kind: 'idle' };
    this.selection.visible = false;
  }

  private cellAt(e: FederatedPointerEvent): Cell | null {
    const p = this.toLocal(e.global);
    const c = Math.floor(p.x / CELL);
    const r = Math.floor(p.y / CELL);
    if (r < 0 || c < 0 || r >= this.rules.rows || c >= this.rules.cols) return null;
    return { r, c };
  }

  private showSelection(cell: Cell): void {
    this.selection.visible = true;
    this.selection.position.set(cell.c * CELL, cell.r * CELL);
  }

  private drawSelection(): void {
    const c = this.theme.colors;
    this.selection
      .clear()
      .roundRect(3, 3, CELL - 6, CELL - 6, this.theme.shape.radius * 2)
      .fill({ color: c.accent, alpha: 0.14 })
      .roundRect(3, 3, CELL - 6, CELL - 6, this.theme.shape.radius * 2)
      .stroke({ width: 4, color: c.accentBright, alignment: 1 });
  }

  // ------------------------------------------------------------- playback

  private async playSteps(steps: CascadeStep[]): Promise<void> {
    const center = this.logicalSize;
    for (const step of steps) {
      if (this.isDisposed) return;
      this.opts.onScore?.(step.scoreDelta, step.comboIndex, step.multiplier);
      // Clear
      const clears: Array<PromiseLike<boolean>> = [];
      let cx = 0;
      let cy = 0;
      for (const cell of step.clearedCells) {
        const sprite = this.tiles[cell.r][cell.c];
        this.tiles[cell.r][cell.c] = null;
        const p = this.cellCenter(cell);
        cx += p.x;
        cy += p.y;
        if (!sprite) continue;
        const gem = this.model.cells[cell.r * this.rules.cols + cell.c];
        const color = this.theme.colors.gems[gem] ?? this.theme.colors.accent;
        this.fx.burst(
          p.x,
          p.y,
          7,
          [color, this.theme.colors.accentBright, this.theme.colors.particles[0]],
          260,
          1.4,
        );
        clears.push(
          this.tweens
            .to(sprite.scale, { x: 0, y: 0 }, { duration: TIMING.clearMs, ease: easings.quadIn })
            .then((ok) => {
              this.release(sprite);
              return ok;
            }),
        );
      }
      // Expanding ring per match group, tinted like the gem.
      for (const group of step.matches) {
        let gx = 0;
        let gy = 0;
        for (const cell of group.cells) {
          const p = this.cellCenter(cell);
          gx += p.x;
          gy += p.y;
        }
        gx /= group.cells.length;
        gy /= group.cells.length;
        const ring = new Graphics().circle(0, 0, CELL * 0.5).stroke({
          width: 8,
          color: this.theme.colors.gems[group.gem] ?? this.theme.colors.accent,
          alpha: 0.9,
        });
        ring.position.set(gx, gy);
        ring.scale.set(0.4);
        this.fx.addChild(ring);
        void this.tweens.to(
          ring.scale,
          { x: 1.9, y: 1.9 },
          { duration: 320, ease: easings.quadOut },
        );
        void this.tweens
          .to(ring, { alpha: 0 }, { duration: 320, ease: easings.quadOut })
          .then(() => {
            if (!ring.destroyed) ring.destroy();
          });
      }
      if (step.clearedCells.length) {
        cx /= step.clearedCells.length;
        cy /= step.clearedCells.length;
        this.popups.show(`+${step.scoreDelta}`, cx, cy, 'popup', undefined, 60);
        if (step.comboIndex >= 1) {
          this.popups.show(
            `×${step.multiplier}`,
            center.width / 2,
            center.height / 2 - 20,
            'popup',
            this.theme.colors.glow,
            50,
          );
        }
      }
      await Promise.all(clears);
      if (this.isDisposed) return;

      // Falls + spawns
      const moves: Array<PromiseLike<boolean>> = [];
      for (const fall of step.falls) {
        const sprite = this.tiles[fall.from.r][fall.from.c];
        this.tiles[fall.from.r][fall.from.c] = null;
        this.tiles[fall.to.r][fall.to.c] = sprite;
        if (!sprite) continue;
        moves.push(this.fallTween(sprite, fall.to, fall.to.r - fall.from.r));
      }
      for (const spawn of step.spawns) {
        const sprite = this.acquire(spawn.gem);
        const start = this.cellCenter({ r: -spawn.spawnOffset, c: spawn.cell.c });
        sprite.position.set(start.x, start.y);
        this.tiles[spawn.cell.r][spawn.cell.c] = sprite;
        moves.push(this.fallTween(sprite, spawn.cell, spawn.cell.r + spawn.spawnOffset));
      }
      await Promise.all(moves);
      this.model = step.board;
      if (this.isDisposed) return;
      if (!(await this.tweens.delay(TIMING.stepGapMs))) return;
    }
  }

  private fallTween(sprite: Sprite, to: Cell, distance: number): PromiseLike<boolean> {
    const target = this.cellCenter(to);
    const duration = Math.min(
      TIMING.fallMsMax,
      Math.max(TIMING.fallMsMin, TIMING.fallMsPerCell * Math.max(1, distance)),
    );
    return this.tweens
      .to(sprite, { y: target.y }, { duration, ease: easings.quadIn })
      .then(async (ok) => {
        if (!ok) return ok;
        sprite.scale.set(TILE / sprite.texture.width, (TILE / sprite.texture.height) * 0.86);
        await this.tweens.to(
          sprite.scale,
          { y: TILE / sprite.texture.height },
          { duration: 90, ease: easings.quadOut },
        );
        return true;
      });
  }

  private async playReshuffle(): Promise<void> {
    const size = this.logicalSize;
    this.popups.show(
      t('game.noMoves'),
      size.width / 2,
      size.height / 2,
      'heading',
      this.theme.colors.accentBright,
      30,
    );
    const outs: Array<PromiseLike<boolean>> = [];
    this.forEachTile((sprite, r, c) =>
      outs.push(
        this.tweens.to(
          sprite.scale,
          { x: 0, y: 0 },
          { duration: TIMING.reshuffleMs * 0.5, ease: easings.quadIn, delay: (r + c) * 12 },
        ),
      ),
    );
    await Promise.all(outs);
    if (this.isDisposed) return;
    const { board } = reshuffle(this.model, this.rules, this.rng);
    this.model = board;
    const ins: Array<PromiseLike<boolean>> = [];
    this.forEachTile((sprite, r, c) => {
      sprite.texture = this.textures[board.cells[r * this.rules.cols + c]];
      ins.push(
        this.tweens.to(
          sprite.scale,
          { x: TILE / sprite.texture.width, y: TILE / sprite.texture.height },
          { duration: TIMING.reshuffleMs * 0.6, ease: easings.backOut, delay: (r + c) * 12 },
        ),
      );
    });
    await Promise.all(ins);
    this.opts.onReshuffle?.();
  }

  // ---------------------------------------------------------------- tiles

  private buildTiles(): void {
    this.tiles = [];
    for (let r = 0; r < this.rules.rows; r++) {
      const row: (Sprite | null)[] = [];
      for (let c = 0; c < this.rules.cols; c++) {
        const gem = this.model.cells[r * this.rules.cols + c];
        const sprite = this.acquire(gem);
        const p = this.cellCenter({ r, c });
        sprite.position.set(p.x, p.y);
        row.push(sprite);
      }
      this.tiles.push(row);
    }
  }

  private forEachTile(fn: (sprite: Sprite, r: number, c: number) => void): void {
    for (let r = 0; r < this.rules.rows; r++)
      for (let c = 0; c < this.rules.cols; c++) {
        const s = this.tiles[r][c];
        if (s) fn(s, r, c);
      }
  }

  private acquire(gem: number): Sprite {
    const sprite = this.pool.pop() ?? new Sprite();
    sprite.texture = this.textures[gem];
    sprite.anchor.set(0.5);
    sprite.scale.set(TILE / sprite.texture.width, TILE / sprite.texture.height);
    sprite.alpha = 1;
    sprite.visible = true;
    sprite.eventMode = 'none';
    this.tileLayer.addChild(sprite);
    return sprite;
  }

  private release(sprite: Sprite): void {
    sprite.visible = false;
    this.tileLayer.removeChild(sprite);
    this.pool.push(sprite);
  }

  private cellCenter(cell: Cell): { x: number; y: number } {
    return { x: (cell.c + 0.5) * CELL, y: (cell.r + 0.5) * CELL };
  }

  private setBusy(busy: boolean): void {
    if (this._busy === busy) return;
    this._busy = busy;
    this.opts.onBusyChange?.(busy);
    if (!busy) {
      const resolvers = this.idleResolvers;
      this.idleResolvers = [];
      for (const r of resolvers) r();
    }
  }
}
