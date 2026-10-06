import { Assets, type Texture } from 'pixi.js';
import { Scene } from '../core/Scene';
import { enter } from '../core/anim';
import { TIMING } from '../../config';
import { clamp, type Viewport } from '../core/layout';
import { costumesForWorld, getCostume, type Costume } from '../data/costumes';
import { Heroine } from '../entities/Heroine';
import { Backdrop } from '../ui/Backdrop';
import { Card } from '../ui/Card';
import { GroundStrip } from '../ui/GroundStrip';
import { ScrollGrid } from '../ui/ScrollGrid';
import { LocalizedText } from '../ui/text';
import { TopBar } from '../ui/TopBar';

const CARD_W = 168;
const CARD_H = 250;

/** Costumes for the active world's heroine. Tap a preview to try it on; Buy deducts points. */
export class ShopScene extends Scene {
  private backdrop!: Backdrop;
  private topBar!: TopBar;
  private ground!: GroundStrip;
  private heroine!: Heroine;
  private subtitle!: LocalizedText;
  private grid!: ScrollGrid;
  private cards = new Map<string, Card>();
  private costumes: Costume[] = [];
  /** Costume currently shown on the preview heroine (defaults to the equipped one). */
  private previewId: string | null = null;

  override init(): void {
    const { store, scenes } = this.ctx;
    const state = store.getState();
    this.costumes = costumesForWorld(this.theme.world);

    this.backdrop = new Backdrop({ theme: this.theme, world: this.theme.world, tint: 0.65 });
    this.topBar = new TopBar({
      theme: this.theme,
      tweens: this.tweens,
      store,
      title: 'shop.title',
      onBack: () => void scenes.goTo('menu', undefined),
    });
    this.ground = new GroundStrip(this.theme);
    this.heroine = new Heroine({
      theme: this.theme,
      tweens: this.tweens,
      costume: this.aliasOf(state.equipped[this.theme.world]),
      targetHeight: 280,
      platform: true,
    });
    this.subtitle = new LocalizedText(this.theme, 'eyebrow', 'shop.forHeroine', {
      name: this.heroineName(),
    });
    this.subtitle.anchor.set(0.5);

    this.grid = new ScrollGrid({
      theme: this.theme,
      width: 400,
      height: 400,
      cellWidth: CARD_W,
      cellHeight: CARD_H,
    });
    const cards = this.costumes.map((costume) => {
      const card = new Card({
        theme: this.theme,
        tweens: this.tweens,
        width: CARD_W,
        height: CARD_H,
        preview: Assets.get<Texture>(costume.texture),
        title: costume.nameKey,
        onPreviewTap: () => this.preview(costume),
      });
      this.cards.set(costume.id, card);
      return card;
    });
    this.grid.setCards(cards);
    this.previewId = state.equipped[this.theme.world];
    this.refreshCards();
    this.onDispose(
      store.subscribe(
        (s) => s.ownedCostumes,
        () => this.refreshCards(),
      ),
    );
    this.onDispose(
      store.subscribe(
        (s) => s.wallet.points,
        () => this.refreshCards(),
      ),
    );
    this.onDispose(
      store.subscribe(
        (s) => s.equipped[this.theme.world],
        () => this.refreshCards(),
      ),
    );

    this.addChild(this.backdrop, this.ground, this.heroine, this.subtitle, this.grid, this.topBar);
  }

  override async show(): Promise<void> {
    this.alpha = 1;
    this.backdrop.alpha = 0;
    void this.tweens.to(this.backdrop, { alpha: 1 }, { duration: TIMING.sceneFadeMs * 1.5 });
    const top = enter(this.tweens, [this.topBar], { from: 'top', distance: 20 });
    const side = enter(this.tweens, [this.heroine, this.subtitle], {
      from: 'left',
      distance: 24,
      delay: 80,
      stagger: 40,
    });
    const cards = enter(this.tweens, [...this.cards.values()], {
      from: 'bottom',
      distance: 28,
      delay: 160,
      stagger: 50,
    });
    await Promise.all([top, side, cards]);
  }

  layout(vp: Viewport): void {
    this.backdrop.layout(vp);
    this.topBar.layout(vp);
    const { width: w, height: h, safe } = vp;
    const top = this.topBar.bottom + 12;
    if (!vp.portrait) {
      const col = clamp(w * 0.32, 220, 380);
      const stripH = 72;
      this.ground.layout(col + 80, stripH);
      this.ground.position.set(-40, h);
      const heroH = clamp(h * 0.5, 180, 420);
      this.heroine.setTargetHeight(heroH);
      this.heroine.position.set(col / 2, h - this.ground.floorOffset);
      this.subtitle.position.set(
        col / 2,
        Math.max(top + 12, h - this.ground.floorOffset - heroH - 36),
      );
      const gridX = col + 12;
      this.grid.position.set(gridX, top + 36);
      this.grid.resize(w - gridX - safe, h - top - 36 - safe);
      return;
    }
    const stripH = 56;
    const previewH = h < 640 ? 0 : clamp(h * 0.26, 140, 220);
    this.ground.visible = this.heroine.visible = previewH > 0;
    this.ground.layout(w, stripH);
    this.ground.position.set(0, top + previewH);
    this.heroine.setTargetHeight(Math.max(100, previewH - 10));
    this.heroine.position.set(w / 2, top + previewH - this.ground.floorOffset);
    this.subtitle.position.set(w / 2, top + previewH + 16);
    const gridTop = top + previewH + 34;
    this.grid.position.set(safe, gridTop);
    const cardW = Math.min(CARD_W, (w - safe * 2 - 16) / 2);
    this.grid.resize(
      w - safe * 2,
      h - gridTop - safe,
      cardW,
      Math.round(cardW * (CARD_H / CARD_W)),
    );
  }

  override update(ticker: Parameters<Scene['update']>[0]): void {
    super.update(ticker);
    this.backdrop.update(ticker.deltaMS);
    this.heroine.update(ticker.deltaMS);
  }

  private refreshCards(): void {
    const { store, toasts } = this.ctx;
    const s = store.getState();
    for (const costume of this.costumes) {
      const card = this.cards.get(costume.id);
      if (!card) continue;
      const owned = s.ownedCostumes.includes(costume.id);
      const equipped = s.equipped[costume.world] === costume.id;
      card.setHighlighted(costume.id === this.previewId || equipped);
      if (equipped) {
        card.setBadge({ kind: 'text', text: this.text('shop.equipped'), accent: true });
        card.setButton(null);
      } else if (owned) {
        card.setBadge({ kind: 'text', text: this.text('shop.owned') });
        card.setButton({
          label: 'inventory.equip',
          onPress: () => store.getState().equipCostume(costume.id),
        });
      } else {
        card.setBadge({
          kind: 'text',
          text:
            costume.price === 0
              ? this.text('shop.free')
              : this.text('shop.price', { n: costume.price }),
          accent: true,
        });
        card.setButton({
          label: 'shop.buy',
          primary: true,
          enabled: s.wallet.points >= costume.price,
          onPress: () => {
            if (store.getState().buyCostume(costume.id)) {
              // A fresh purchase goes straight on: the heroine wears it in the menu and in game.
              store.getState().equipCostume(costume.id);
              toasts.show('shop.bought');
              this.preview(costume);
            } else {
              toasts.show('shop.notEnough');
            }
          },
        });
      }
    }
  }

  /** Put a costume on the preview heroine immediately and mark its card. */
  private preview(costume: Costume): void {
    if (this.previewId === costume.id) return;
    this.previewId = costume.id;
    void this.heroine.setCostume(costume.texture, 'instant');
    this.refreshCards();
  }

  private text(
    key: Parameters<LocalizedText['setKey']>[0],
    params?: Record<string, string | number>,
  ): string {
    const probe = new LocalizedText(this.theme, 'body', key, params);
    const value = probe.text;
    probe.destroy();
    return value;
  }

  private heroineName(): string {
    return this.text(`heroine.${this.theme.heroine}`);
  }

  private aliasOf(id: string | null): string | null {
    return id ? (getCostume(id)?.texture ?? null) : null;
  }
}
