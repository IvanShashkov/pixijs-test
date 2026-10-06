import { Graphics, type Ticker } from 'pixi.js';
import { LAYOUT, TIMING } from '../../config';
import { createBoard, DEFAULT_RULES, mulberry32 } from '../board';
import { Scene } from '../core/Scene';
import { clamp, formatPoints, formatTime, rect, type Viewport } from '../core/layout';
import { TweenGroup } from '../core/Tween';
import { enter } from '../core/anim';
import { getCostume } from '../data/costumes';
import { ACTIVITY_IDS } from '../data/activities';
import { BoardView } from '../entities/BoardView';
import { Heroine } from '../entities/Heroine';
import { computeDropCount, rollDrops } from '../loot';
import { easings } from '../theme/ease';
import type { GameParams, RoundResult } from '../types';
import { Backdrop } from '../ui/Backdrop';
import { UiButton } from '../ui/Button';
import { drawPanel } from '../ui/draw';
import { GroundStrip } from '../ui/GroundStrip';
import { Panel } from '../ui/Panel';
import { LocalizedText, makeText } from '../ui/text';

type Phase = 'intro' | 'playing' | 'paused' | 'ending' | 'ended';

export interface GameDebugState {
  phase: Phase;
  remainingMs: number;
  score: number;
  busy: boolean;
}

/**
 * The match-3 round: HUD (timer / score / pause), the board, the heroine behind it and a pause
 * overlay. Round end waits for the board to go idle, credits points and opens Results.
 */
export class GameScene extends Scene<GameParams | undefined> {
  private backdrop!: Backdrop;
  private ground!: GroundStrip;
  private heroine!: Heroine;
  private board!: BoardView;
  private readonly boardTweens = new TweenGroup();
  private hudBg = new Graphics();
  private timerLabel!: LocalizedText;
  private timerValue!: ReturnType<typeof makeText>;
  private scoreLabel!: LocalizedText;
  private scoreValue!: ReturnType<typeof makeText>;
  private pauseButton!: UiButton;
  private dim = new Graphics();
  private pausePanel!: Panel;
  private pauseButtons: UiButton[] = [];

  private phase: Phase = 'intro';
  private idleMs = 0;
  private remainingMs = 0;
  private score = 0;
  private shownSecond = -1;
  private lootSeed = 0;

  override init(params: GameParams | undefined): void {
    const { store, app } = this.ctx;
    const state = store.getState();
    const seed = params?.seed ?? Date.now() >>> 0;
    const seconds = params?.seconds ?? state.settings.roundSeconds;
    this.remainingMs = seconds * 1000;
    this.lootSeed = (seed ^ 0x9e3779b9) >>> 0;
    const boardRng = mulberry32(seed);

    this.backdrop = new Backdrop({ theme: this.theme, world: this.theme.world, tint: 0.6 });
    this.ground = new GroundStrip(this.theme);
    this.heroine = new Heroine({
      theme: this.theme,
      tweens: this.tweens,
      costume: this.costumeAlias(state.equipped[this.theme.world]),
      targetHeight: LAYOUT.heroineHeight,
    });
    this.onDispose(
      store.subscribe(
        (s) => s.equipped[this.theme.world],
        (id) => void this.heroine.setCostume(this.costumeAlias(id)),
      ),
    );
    this.board = new BoardView({
      theme: this.theme,
      tweens: this.boardTweens,
      renderer: app.renderer,
      rules: DEFAULT_RULES,
      rng: boardRng,
      board: createBoard(DEFAULT_RULES, boardRng),
      onScore: (delta, comboIndex) => this.addScore(delta, comboIndex),
      onInput: () => {
        this.idleMs = 0;
      },
    });
    this.onDispose(() => this.boardTweens.killAll());

    const c = this.theme.colors;
    this.timerLabel = new LocalizedText(this.theme, 'hudLabel', 'hud.time');
    this.timerValue = makeText(this.theme, 'hudValue', formatTime(seconds));
    this.scoreLabel = new LocalizedText(this.theme, 'hudLabel', 'hud.score');
    this.scoreValue = makeText(this.theme, 'hudValue', '0');
    for (const n of [this.timerLabel, this.scoreLabel]) n.anchor.set(0.5, 0);
    for (const n of [this.timerValue, this.scoreValue]) n.anchor.set(0.5, 0);
    this.pauseButton = new UiButton({
      theme: this.theme,
      tweens: this.tweens,
      variant: 'icon',
      glyph: 'pause',
      onPress: () => this.pause(),
    });

    this.dim.eventMode = 'static';
    this.dim.visible = false;
    this.pausePanel = new Panel({
      theme: this.theme,
      width: 320,
      height: 250,
      title: 'pause.title',
      raised: true,
    });
    this.pausePanel.visible = false;
    const btn = (
      label: Parameters<LocalizedText['setKey']>[0],
      primary: boolean,
      onPress: () => void,
    ) =>
      new UiButton({
        theme: this.theme,
        tweens: this.tweens,
        variant: primary ? 'primary' : 'ghost',
        label,
        width: 240,
        height: 44,
        onPress,
      });
    this.pauseButtons = [
      btn('pause.resume', true, () => this.resume()),
      btn('pause.restart', false, () => void this.ctx.scenes.goTo('game', undefined)),
      btn('pause.menu', false, () => void this.ctx.scenes.goTo('menu', undefined)),
    ];
    this.pauseButtons.forEach((b, i) => {
      b.position.set(this.pausePanel.innerWidth / 2, 22 + i * 56);
      this.pausePanel.content.addChild(b);
    });
    void c;

    this.addChild(
      this.backdrop,
      this.ground,
      this.heroine,
      this.board,
      this.hudBg,
      this.timerLabel,
      this.timerValue,
      this.scoreLabel,
      this.scoreValue,
      this.pauseButton,
      this.dim,
      this.pausePanel,
    );
    this.listenDom(document, 'visibilitychange', () => {
      if (document.hidden && this.phase === 'playing') this.pause();
    });
  }

  layout(vp: Viewport): void {
    this.backdrop.layout(vp);
    const { width: w, height: h, safe } = vp;
    const hudH = Math.round(clamp(h * 0.09, 56, 72));
    const stripH = Math.round(clamp(h * 0.1, 56, LAYOUT.groundStripHeight));
    this.ground.layout(w, stripH);
    this.ground.position.set(0, h);

    drawPanel(this.hudBg, this.theme, w - safe * 2, hudH, { alpha: 0.78, raised: true });
    this.hudBg.position.set(safe, safe);
    const hudY = safe;
    this.timerLabel.position.set(safe + 70, hudY + 9);
    this.timerValue.position.set(safe + 70, hudY + 22);
    this.scoreLabel.position.set(w / 2, hudY + 9);
    this.scoreValue.position.set(w / 2, hudY + 22);
    this.pauseButton.position.set(w - safe - 22 - 8, hudY + hudH / 2);

    const top = safe + hudH + 12;
    if (!vp.portrait) {
      const heroCol = clamp(w * 0.28, 200, 420);
      const avail = rect(heroCol + 16, top, w - heroCol - 16 - safe, h - top - stripH * 0.6);
      this.board.layout(avail);
      this.heroine.setTargetHeight(clamp(h * 0.6, 220, 560));
      this.heroine.position.set(heroCol / 2, h - this.ground.floorOffset);
      this.heroine.alpha = 1;
    } else {
      const heroBand = clamp(h * 0.18, 100, 240);
      const avail = rect(safe, top, w - safe * 2, h - top - heroBand - safe);
      this.board.layout(avail);
      this.heroine.setTargetHeight(heroBand * 1.6);
      this.heroine.position.set(w * 0.5, h - this.ground.floorOffset);
      this.heroine.alpha = 0.45;
    }
    this.dim.clear().rect(0, 0, w, h).fill({ color: this.theme.colors.bgTo, alpha: 0.68 });
    const panelW = Math.min(320, w - safe * 2);
    this.pausePanel.resize(panelW, 250);
    this.pauseButtons.forEach((b) => (b.x = this.pausePanel.innerWidth / 2));
    this.pausePanel.position.set((w - panelW) / 2, (h - 250) / 2);
  }

  override update(ticker: Ticker): void {
    super.update(ticker);
    this.backdrop.update(ticker.deltaMS);
    this.heroine.update(ticker.deltaMS);
    if (this.phase === 'paused' || this.phase === 'ended') return;
    this.boardTweens.update(ticker.deltaMS);
    this.board.update(ticker);
    if (this.phase !== 'playing') return;
    if (!this.board.busy) {
      this.idleMs += ticker.deltaMS;
      if (this.idleMs >= TIMING.hintIdleMs) {
        this.idleMs = 0;
        void this.board.hintMove();
      }
    }
    this.remainingMs = Math.max(0, this.remainingMs - ticker.deltaMS);
    const sec = Math.ceil(this.remainingMs / 1000);
    if (sec !== this.shownSecond) {
      this.shownSecond = sec;
      this.timerValue.text = formatTime(sec);
      const urgent = sec <= 10;
      this.timerValue.style.fill = urgent
        ? this.theme.colors.danger
        : this.theme.colors.accentBright;
      if (urgent && sec > 0) {
        this.timerValue.scale.set(1.25);
        void this.tweens.to(
          this.timerValue.scale,
          { x: 1, y: 1 },
          { duration: 300, ease: easings.quadOut },
        );
      }
    }
    if (this.remainingMs <= 0) void this.endRound();
  }

  override async show(): Promise<void> {
    this.alpha = 1;
    this.backdrop.alpha = 0;
    void this.tweens.to(this.backdrop, { alpha: 1 }, { duration: TIMING.sceneFadeMs * 1.5 });
    const heroAlpha = this.heroine.alpha;
    this.heroine.alpha = 0;
    void this.tweens.to(this.heroine, { alpha: heroAlpha }, { duration: 420, delay: 150 });
    this.board.alpha = 0;
    void this.tweens.to(this.board, { alpha: 1 }, { duration: 260 });
    const hud = enter(
      this.tweens,
      [
        this.hudBg,
        this.timerLabel,
        this.timerValue,
        this.scoreLabel,
        this.scoreValue,
        this.pauseButton,
      ],
      { from: 'top', distance: 24, stagger: 30 },
    );
    this.board.setInputEnabled(false);
    await this.board.playIntro();
    await hud;
    if (this.isDisposed) return;
    if (this.phase === 'intro') {
      this.phase = 'playing';
      this.idleMs = 0;
      this.board.setInputEnabled(true);
    }
  }

  pause(): void {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.board.setInputEnabled(false);
    this.dim.visible = true;
    this.pausePanel.visible = true;
    this.dim.alpha = 0;
    this.pausePanel.alpha = 0;
    this.pausePanel.scale.set(0.96);
    void this.tweens.to(this.dim, { alpha: 1 }, { duration: TIMING.sceneFadeMs * 0.6 });
    void this.tweens.to(this.pausePanel, { alpha: 1 }, { duration: TIMING.sceneFadeMs * 0.6 });
    void this.tweens.to(
      this.pausePanel.scale,
      { x: 1, y: 1 },
      { duration: TIMING.sceneFadeMs * 0.6, ease: easings.backOut },
    );
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.phase = 'playing';
    this.board.setInputEnabled(true);
    this.dim.visible = false;
    this.pausePanel.visible = false;
  }

  /** Dev / e2e: force the round to end with a given score. */
  async debugEndRound(score?: number): Promise<void> {
    if (this.phase === 'intro') {
      await this.board.whenIdle();
      this.phase = 'playing';
      this.board.setInputEnabled(true);
    }
    if (score !== undefined) {
      this.score = score;
      this.scoreValue.text = formatPoints(score);
    }
    if (this.phase === 'paused') this.resume();
    this.remainingMs = 0;
    await this.endRound();
  }

  playFirstValidMove(): Promise<boolean> {
    return this.board.playFirstValidMove();
  }

  get debugState(): GameDebugState {
    return {
      phase: this.phase,
      remainingMs: this.remainingMs,
      score: this.score,
      busy: this.board.busy,
    };
  }

  private addScore(delta: number, comboIndex = 0): void {
    this.idleMs = 0;
    if (comboIndex >= 2) void this.heroine.cheer();
    this.score += delta;
    this.scoreValue.text = formatPoints(this.score);
    this.scoreValue.scale.set(1.15);
    void this.tweens.to(
      this.scoreValue.scale,
      { x: 1, y: 1 },
      { duration: 160, ease: easings.quadOut },
    );
  }

  private async endRound(): Promise<void> {
    if (this.phase !== 'playing') return;
    this.phase = 'ending';
    this.board.setInputEnabled(false);
    await this.board.whenIdle();
    if (this.isDisposed) return;
    const { store, scenes } = this.ctx;
    const s = store.getState();
    const credited = Math.round(this.score * s.settings.scoreCoefficient);
    const count = computeDropCount(credited, s.settings.lootPerPoints, s.settings.lootCap);
    const locked = ACTIVITY_IDS.filter((id) => !s.collection[this.theme.world].includes(id));
    const drops = rollDrops(
      count,
      s.settings.lootWeights,
      mulberry32(this.lootSeed),
      locked,
      s.settings.lootBonusPoints,
    );
    s.addPoints(credited);
    this.phase = 'ended';
    const result: RoundResult = {
      world: this.theme.world,
      score: this.score,
      coefficient: s.settings.scoreCoefficient,
      credited,
      drops,
    };
    await scenes.goTo('results', result);
  }

  private costumeAlias(id: string | null): string | null {
    return id ? (getCostume(id)?.texture ?? null) : null;
  }
}
