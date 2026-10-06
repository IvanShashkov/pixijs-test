import type { Ticker } from 'pixi.js';
import { LAYOUT, TIMING } from '../../config';
import { Scene } from '../core/Scene';
import { clamp, formatPoints, type Viewport } from '../core/layout';
import { Celebration } from '../entities/Celebration';
import { LootChest } from '../entities/LootChest';
import { BurstFx } from '../entities/Particles';
import { Roulette } from '../entities/Roulette';
import { dropIn, enter, popIn } from '../core/anim';
import type { DropResult } from '../loot/types';
import { easings } from '../theme/ease';
import type { RoundResult } from '../types';
import { Backdrop } from '../ui/Backdrop';
import { UiButton } from '../ui/Button';
import { GroundStrip } from '../ui/GroundStrip';
import { LocalizedText, makeText } from '../ui/text';

/** Round summary, pre-rolled loot to open, and the heroines' celebration. */
export class ResultsScene extends Scene<RoundResult> {
  private result!: RoundResult;
  private backdrop!: Backdrop;
  private ground!: GroundStrip;
  private celebration!: Celebration;
  private fx!: BurstFx;
  private title!: LocalizedText;
  private scoreLabel!: LocalizedText;
  private scoreValue!: ReturnType<typeof makeText>;
  private coefText!: ReturnType<typeof makeText>;
  private creditedLabel!: LocalizedText;
  private creditedValue!: ReturnType<typeof makeText>;
  private lootHint!: LocalizedText;
  private chests: LootChest[] = [];
  private openAllButton!: UiButton;
  private continueButton!: UiButton;
  private playAgainButton!: UiButton;
  private chestSize = 96;
  private opening = false;
  private fastMode = false;
  private roulette: Roulette | null = null;

  override init(params: RoundResult): void {
    this.result = params;
    const { store, scenes, app } = this.ctx;
    const c = this.theme.colors;
    this.backdrop = new Backdrop({ theme: this.theme, world: this.theme.world, tint: 0.62 });
    this.ground = new GroundStrip(this.theme);
    this.celebration = new Celebration({ tweens: this.tweens, width: 800, floorY: 0 });
    this.fx = new BurstFx(app.renderer);

    this.title = new LocalizedText(this.theme, 'title', 'results.title', undefined, {
      fontSize: 34,
    });
    this.scoreLabel = new LocalizedText(this.theme, 'eyebrow', 'results.score');
    this.scoreValue = makeText(this.theme, 'hudValue', '0', { fontSize: 32, fill: c.text });
    this.coefText = makeText(this.theme, 'bodyMuted', `× ${params.coefficient.toFixed(1)}`);
    this.creditedLabel = new LocalizedText(this.theme, 'eyebrow', 'results.credited');
    this.creditedValue = makeText(this.theme, 'hudValue', '0', { fontSize: 44 });
    for (const n of [
      this.title,
      this.scoreLabel,
      this.scoreValue,
      this.coefText,
      this.creditedLabel,
      this.creditedValue,
    ])
      n.anchor.set(0.5);

    const lootKey = this.theme.lootKind === 'chest' ? 'loot.chest' : 'loot.container';
    const lootProbe = new LocalizedText(this.theme, 'body', lootKey);
    const lootName = lootProbe.text;
    lootProbe.destroy();
    this.lootHint = new LocalizedText(
      this.theme,
      'caption',
      params.drops.length ? 'results.tapToOpen' : 'results.noLoot',
      { loot: lootName, n: store.getState().settings.lootPerPoints },
      { align: 'center', wordWrap: true, wordWrapWidth: 420 },
    );
    this.lootHint.anchor.set(0.5);

    this.chests = params.drops.map(
      (drop, index) =>
        new LootChest({
          theme: this.theme,
          tweens: this.tweens,
          fx: this.fx,
          size: this.chestSize,
          drop,
          onReveal: (d) => this.applyDrop(d),
          beforeReveal: () => this.runRoulette(drop, index),
        }),
    );

    this.openAllButton = new UiButton({
      theme: this.theme,
      tweens: this.tweens,
      variant: 'ghost',
      label: 'results.openAll',
      height: 44,
      onPress: () => void this.openAll(),
    });
    this.openAllButton.visible = this.chests.length > 1;
    this.playAgainButton = new UiButton({
      theme: this.theme,
      tweens: this.tweens,
      variant: 'primary',
      label: 'results.playAgain',
      pulse: true,
      height: 48,
      onPress: () => this.leave('game'),
    });
    this.continueButton = new UiButton({
      theme: this.theme,
      tweens: this.tweens,
      variant: 'ghost',
      label: 'results.continue',
      height: 48,
      onPress: () => this.leave('menu'),
    });

    this.addChild(
      this.backdrop,
      this.ground,
      this.celebration,
      this.title,
      this.scoreLabel,
      this.scoreValue,
      this.coefText,
      this.creditedLabel,
      this.creditedValue,
      this.lootHint,
      ...this.chests,
      this.fx,
      this.openAllButton,
      this.playAgainButton,
      this.continueButton,
    );
    void scenes;
  }

  override async show(): Promise<void> {
    this.alpha = 1;
    this.backdrop.alpha = 0;
    void this.tweens.to(this.backdrop, { alpha: 1 }, { duration: TIMING.sceneFadeMs * 1.5 });
    const title = popIn(this.tweens, [this.title], { scaleFrom: 0.7 });
    const stats = enter(
      this.tweens,
      [
        this.scoreLabel,
        this.scoreValue,
        this.coefText,
        this.creditedLabel,
        this.creditedValue,
        this.lootHint,
      ],
      { from: 'bottom', distance: 22, stagger: 60, delay: 120 },
    );
    const chests = dropIn(this.tweens, this.chests, { stagger: 90, delay: 420 });
    const buttons = enter(
      this.tweens,
      [this.openAllButton, this.playAgainButton, this.continueButton],
      {
        from: 'bottom',
        delay: 600,
        stagger: 70,
      },
    );
    const count = { v: 0 };
    void this.tweens.to(
      count,
      { v: this.result.score },
      {
        duration: TIMING.countUpMs,
        delay: 250,
        ease: easings.quadOut,
        onUpdate: () => (this.scoreValue.text = formatPoints(count.v)),
      },
    );
    const credited = { v: 0 };
    void this.tweens.to(
      credited,
      { v: this.result.credited },
      {
        duration: TIMING.countUpMs,
        delay: 600,
        ease: easings.quadOut,
        onUpdate: () => (this.creditedValue.text = formatPoints(credited.v)),
      },
    );
    void this.tweens.delay(500).then((ok) => {
      if (ok) void this.celebration.play();
    });
    await Promise.all([title, stats, chests, buttons]);
  }

  layout(vp: Viewport): void {
    this.backdrop.layout(vp);
    this.roulette?.layout(vp);
    const { width: w, height: h, safe } = vp;
    const stripH = Math.round(clamp(h * 0.11, 60, 84));
    this.ground.layout(w, stripH);
    this.ground.position.set(0, h);

    const cx = w / 2;
    let y = safe + 34;
    this.title.position.set(cx, y);
    y += 44;
    this.scoreLabel.position.set(cx, y);
    this.scoreValue.position.set(cx, y + 28);
    this.coefText.position.set(cx, y + 58);
    this.creditedLabel.position.set(cx, y + 86);
    this.creditedValue.position.set(cx, y + 118);
    y += 150;

    // One row of chests sized to fit; each reward card needs room above its chest.
    const n = this.chests.length;
    const gap = 14;
    const maxChest = vp.portrait ? 80 : 96;
    this.chestSize = n
      ? clamp(Math.floor((w - safe * 2 - gap * (n - 1)) / n), 44, maxChest)
      : maxChest;
    const rewardReserve = this.chestSize * 0.9 + 90;
    this.lootHint.style.wordWrapWidth = Math.min(420, w - safe * 2);
    this.lootHint.position.set(cx, y + 6);
    y += 30;
    const rowW = n * this.chestSize + (n - 1) * gap;
    const chestBottom = y + (n ? rewardReserve : 0) + this.chestSize;
    this.chests.forEach((chest, i) => {
      chest.setSize(this.chestSize);
      chest.position.set(
        cx - rowW / 2 + i * (this.chestSize + gap) + this.chestSize / 2,
        chestBottom,
      );
    });
    y = n ? chestBottom + 36 : y + 20;

    if (this.openAllButton.visible) {
      this.openAllButton.position.set(cx, y);
      y += 54;
    }
    y += 10;
    const bw = this.playAgainButton.buttonWidth + 12 + this.continueButton.buttonWidth;
    if (bw <= w - safe * 2) {
      this.playAgainButton.position.set(cx - bw / 2 + this.playAgainButton.buttonWidth / 2, y + 24);
      this.continueButton.position.set(cx + bw / 2 - this.continueButton.buttonWidth / 2, y + 24);
      y += 48;
    } else {
      this.playAgainButton.position.set(cx, y + 24);
      this.continueButton.position.set(cx, y + 80);
      y += 104;
    }

    // Celebration: left column in landscape (the centre is busy); bottom centre in portrait,
    // shrunk if the buttons would otherwise collide with the heart.
    const floorY = h - this.ground.floorOffset;
    const needed = LAYOUT.celebrationHugHeight + LAYOUT.celebrationHeartHeight + 10;
    if (!vp.portrait) {
      this.celebration.scale.set(1);
      this.celebration.layout(w * 0.36, floorY);
      this.celebration.position.set(0, 0);
    } else {
      const room = Math.max(60, floorY - (y + 12));
      const k = clamp(room / needed, 0.5, 1);
      this.celebration.scale.set(k);
      this.celebration.layout(w / k, floorY / k);
      this.celebration.position.set(0, 0);
    }
  }

  override update(ticker: Ticker): void {
    super.update(ticker);
    this.backdrop.update(ticker.deltaMS);
    this.celebration.update(ticker.deltaMS);
    this.fx.update(ticker.deltaMS);
    for (const chest of this.chests) chest.update(ticker.deltaMS);
    this.roulette?.update(ticker.deltaMS);
  }

  /** Dev / e2e + "Open all": open every remaining chest in sequence (fast roulettes). */
  async openAll(): Promise<void> {
    if (this.opening) return;
    this.opening = true;
    this.fastMode = true;
    this.openAllButton.enabled = false;
    for (const chest of this.chests) {
      if (this.isDisposed) return;
      if (chest.state === 'closed') {
        await chest.open();
        if (!(await this.tweens.delay(150))) return;
      }
    }
    this.fastMode = false;
    this.opening = false;
  }

  /** Dev / e2e: open one chest (runs its roulette). */
  openChest(index: number): Promise<void> {
    return this.chests[index]?.open() ?? Promise.resolve();
  }

  /** Modal roulette for one drop; resolves when the player dismisses it. */
  private async runRoulette(drop: DropResult, index: number): Promise<void> {
    if (this.isDisposed || this.roulette) return;
    const s = this.ctx.store.getState();
    const seed = (Math.imul(this.result.credited + 1, 2654435761) + index * 40503) >>> 0;
    const roulette = new Roulette({
      theme: this.theme,
      tweens: this.tweens,
      fx: this.fx,
      world: this.result.world,
      drop,
      seed,
      weights: s.settings.lootWeights,
      bonusPoints: s.settings.lootBonusPoints,
      fast: this.fastMode,
    });
    this.roulette = roulette;
    this.addChild(roulette);
    roulette.layout(this.ctx.viewport);
    await roulette.play();
    if (this.roulette === roulette) this.roulette = null;
    if (!roulette.destroyed) roulette.destroy();
  }

  get drops(): DropResult[] {
    return this.result.drops;
  }

  private applyDrop(drop: DropResult): void {
    const s = this.ctx.store.getState();
    if (drop.kind === 'bonus') s.addPoints(drop.points);
    else if (drop.kind === 'activity') s.unlockActivity(this.result.world, drop.id);
  }

  private leave(target: 'game' | 'menu'): void {
    for (const chest of this.chests) chest.revealInstantly();
    this.celebration.skip();
    void this.ctx.scenes.goTo(target, undefined);
  }
}
