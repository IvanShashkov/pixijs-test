import { TIMING } from '../../config';
import { FillGradient, Graphics } from 'pixi.js';
import { enter, popIn } from '../core/anim';
import { easings } from '../theme/ease';
import { rgba } from '../ui/draw';
import { type HeroineKey, type Locale, type World, LOCALES, WORLDS } from '../../config';
import { getCostume } from '../data/costumes';
import { Heroine } from '../entities/Heroine';
import { Scene } from '../core/Scene';
import type { Viewport } from '../core/layout';
import { clamp } from '../core/layout';
import { Backdrop } from '../ui/Backdrop';
import { UiButton } from '../ui/Button';
import { GroundStrip } from '../ui/GroundStrip';
import { Tabs } from '../ui/Tabs';
import { LocalizedText } from '../ui/text';
import { WalletChip } from '../ui/WalletChip';

export class MainMenuScene extends Scene {
  private backdrop!: Backdrop;
  private ground!: GroundStrip;
  private heroine!: Heroine;
  private eyebrow!: LocalizedText;
  private title!: LocalizedText;
  private tagline!: LocalizedText;
  private buttons: UiButton[] = [];
  private worldTabs!: Tabs;
  private langTabs!: Tabs;
  private wallet!: WalletChip;
  private readonly shimmer = new Graphics();
  /** Invisible twin of the title used as the shimmer mask (a mask object is never rendered itself). */
  private shimmerMask!: LocalizedText;

  override init(): void {
    const { store } = this.ctx;
    const state = store.getState();
    const heroineKey: HeroineKey = this.theme.heroine;

    this.backdrop = new Backdrop({ theme: this.theme, world: this.theme.world, tint: 0.5 });
    this.ground = new GroundStrip(this.theme);
    this.heroine = new Heroine({
      theme: this.theme,
      tweens: this.tweens,
      costume: this.costumeAlias(state.equipped[this.theme.world]),
      targetHeight: 300,
      platform: true,
    });
    this.onDispose(
      store.subscribe(
        (s) => s.equipped[this.theme.world],
        (id) => void this.heroine.setCostume(this.costumeAlias(id)),
      ),
    );

    this.eyebrow = new LocalizedText(this.theme, 'eyebrow', `heroine.${heroineKey}`);
    this.title = new LocalizedText(this.theme, 'title', 'app.title');
    this.tagline = new LocalizedText(this.theme, 'bodyMuted', 'menu.tagline');
    this.shimmerMask = new LocalizedText(this.theme, 'title', 'app.title');
    for (const node of [this.eyebrow, this.title, this.tagline, this.shimmerMask])
      node.anchor.set(0.5);

    const nav = this.ctx.scenes;
    const make = (
      label: Parameters<typeof LocalizedText.prototype.setKey>[0],
      primary: boolean,
      onPress: () => void,
    ) =>
      new UiButton({
        theme: this.theme,
        tweens: this.tweens,
        variant: primary ? 'primary' : 'ghost',
        pulse: primary,
        label,
        onPress,
        width: 260,
        height: 50,
      });
    this.buttons = [
      make('menu.play', true, () => void nav.goTo('game', undefined)),
      make('menu.shop', false, () => void nav.goTo('shop', undefined)),
      make('menu.inventory', false, () => void nav.goTo('inventory', undefined)),
      make('menu.collection', false, () => void nav.goTo('collection', undefined)),
      make('menu.settings', false, () => void nav.goTo('settings', undefined)),
    ];

    this.worldTabs = new Tabs({
      theme: this.theme,
      items: WORLDS.map((w) => `world.${w}` as const),
      index: WORLDS.indexOf(state.world),
      onChange: (i) => store.getState().setWorld(WORLDS[i] as World),
    });
    this.langTabs = new Tabs({
      theme: this.theme,
      items: LOCALES.map((l) => `lang.${l}` as const),
      index: LOCALES.indexOf(state.locale),
      onChange: (i) => store.getState().setLocale(LOCALES[i] as Locale),
    });
    this.wallet = new WalletChip(this.theme, store);

    this.addChild(
      this.backdrop,
      this.ground,
      this.heroine,
      this.eyebrow,
      this.title,
      this.shimmerMask,
      this.shimmer,
      this.tagline,
      ...this.buttons,
      this.worldTabs,
      this.langTabs,
      this.wallet,
    );
  }

  layout(vp: Viewport): void {
    this.backdrop.layout(vp);
    const { width: w, height: h, safe } = vp;
    const stripH = Math.round(clamp(h * 0.1, 60, 84));
    this.ground.layout(w, stripH);
    this.ground.position.set(0, h);
    this.wallet.position.set(
      w - safe - this.wallet.chipWidth / 2,
      safe + this.wallet.chipHeight / 2,
    );

    const gapBtn = 12;
    const btnH = 50;
    const stackH = this.buttons.length * btnH + (this.buttons.length - 1) * gapBtn;

    if (!vp.portrait) {
      const col = clamp(w * 0.38, 240, 520);
      const heroH = clamp(h * 0.62, 220, 520);
      this.heroine.setTargetHeight(heroH);
      this.heroine.position.set(col / 2, h - this.ground.floorOffset);
      const cx = col + (w - col) / 2;
      const titleBlockH = 120;
      const total = titleBlockH + 24 + stackH + 24 + 36;
      let y = Math.max(safe + 56, (h - total) / 2);
      this.eyebrow.position.set(cx, y);
      this.title.position.set(cx, y + 42);
      this.shimmerMask.position.set(cx, y + 42);
      this.tagline.position.set(cx, y + 86);
      y += titleBlockH + 24;
      for (const b of this.buttons) {
        b.position.set(cx, y + btnH / 2);
        y += btnH + gapBtn;
      }
      y += 24;
      const tabsGap = 16;
      const tabsW = this.worldTabs.tabsWidth + tabsGap + this.langTabs.tabsWidth;
      this.worldTabs.position.set(cx - tabsW / 2, y);
      this.langTabs.position.set(cx - tabsW / 2 + this.worldTabs.tabsWidth + tabsGap, y);
      return;
    }
    // Portrait: title top, heroine middle, buttons bottom, tabs last.
    const cx = w / 2;
    this.eyebrow.position.set(cx, safe + 64);
    this.title.position.set(cx, safe + 104);
    this.shimmerMask.position.set(cx, safe + 104);
    this.tagline.position.set(cx, safe + 142);
    const bottomBlock = stackH + 24 + 36 + safe;
    const tabsY = h - safe - 36;
    const tabsGap = 12;
    const tabsW = this.worldTabs.tabsWidth + tabsGap + this.langTabs.tabsWidth;
    if (tabsW <= w - safe * 2) {
      this.worldTabs.position.set(cx - tabsW / 2, tabsY);
      this.langTabs.position.set(cx - tabsW / 2 + this.worldTabs.tabsWidth + tabsGap, tabsY);
    } else {
      this.worldTabs.position.set(cx - this.worldTabs.tabsWidth / 2, tabsY - 44);
      this.langTabs.position.set(cx - this.langTabs.tabsWidth / 2, tabsY);
    }
    let y = h - bottomBlock - (tabsW > w - safe * 2 ? 44 : 0);
    for (const b of this.buttons) {
      b.position.set(cx, y + btnH / 2);
      y += btnH + gapBtn;
    }
    const heroTop = safe + 170;
    const heroBottom = h - bottomBlock - 24 - (tabsW > w - safe * 2 ? 44 : 0);
    const heroH = clamp(heroBottom - heroTop - 30, 120, 360);
    this.heroine.setTargetHeight(heroH);
    this.heroine.position.set(cx, heroBottom);
  }

  override update(ticker: Parameters<Scene['update']>[0]): void {
    super.update(ticker);
    this.backdrop.update(ticker.deltaMS);
    this.heroine.update(ticker.deltaMS);
  }

  override async show(): Promise<void> {
    this.alpha = 1;
    this.backdrop.alpha = 0;
    void this.tweens.to(this.backdrop, { alpha: 1 }, { duration: TIMING.sceneFadeMs * 1.5 });
    this.heroine.alpha = 0;
    void this.tweens.to(this.heroine, { alpha: 1 }, { duration: 420, delay: 120 });
    const titleBlock = popIn(this.tweens, [this.eyebrow, this.title, this.tagline], {
      stagger: 70,
      scaleFrom: 0.8,
    });
    const buttons = enter(this.tweens, this.buttons, { from: 'bottom', delay: 160 });
    const chip = popIn(this.tweens, [this.wallet], { delay: 200, scaleFrom: 0.9 });
    const tabRow = enter(this.tweens, [this.worldTabs, this.langTabs], {
      from: 'bottom',
      delay: 420,
      distance: 20,
    });
    void this.loopTitleShimmer();
    await Promise.all([titleBlock, buttons, chip, tabRow]);
  }

  /** Periodic highlight sweep across the title (the sibling's gold shimmer / cyan power-up). */
  private async loopTitleShimmer(): Promise<void> {
    this.shimmer.blendMode = 'add';
    this.shimmer.eventMode = 'none';
    this.shimmer.mask = this.shimmerMask;
    while (!this.isDisposed) {
      if (!(await this.tweens.delay(3600))) return;
      const w = this.title.width;
      const h = this.title.height;
      const barW = Math.max(40, w * 0.28);
      this.shimmer
        .clear()
        .poly([0, 0, barW, 0, barW - h * 0.35, h, -h * 0.35, h], true)
        .fill(
          new FillGradient({
            type: 'linear',
            start: { x: 0, y: 0.5 },
            end: { x: 1, y: 0.5 },
            colorStops: [
              { offset: 0, color: rgba(0xffffff, 0) },
              { offset: 0.5, color: rgba(0xffffff, 0.75) },
              { offset: 1, color: rgba(0xffffff, 0) },
            ],
            textureSpace: 'local',
          }),
        );
      this.shimmer.position.set(this.title.x - w / 2 - barW, this.title.y - h / 2);
      const swept = await this.tweens.to(
        this.shimmer,
        { x: this.title.x + w / 2 + h * 0.35 },
        { duration: 900, ease: easings.cubicInOut },
      );
      if (!swept) return;
      this.shimmer.clear();
    }
  }

  private costumeAlias(id: string | null): string | null {
    return id ? (getCostume(id)?.texture ?? null) : null;
  }
}
