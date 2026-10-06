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

/** Owned costumes for the active world's heroine; equip / unequip, live preview. */
export class InventoryScene extends Scene {
  private backdrop!: Backdrop;
  private topBar!: TopBar;
  private ground!: GroundStrip;
  private heroine!: Heroine;
  private hint!: LocalizedText;
  private grid!: ScrollGrid;
  private cards = new Map<string, Card>();
  private owned: Costume[] = [];

  override init(): void {
    const { store, scenes } = this.ctx;
    const state = store.getState();
    this.owned = costumesForWorld(this.theme.world).filter((c) =>
      state.ownedCostumes.includes(c.id),
    );

    this.backdrop = new Backdrop({ theme: this.theme, world: this.theme.world, tint: 0.65 });
    this.topBar = new TopBar({
      theme: this.theme,
      tweens: this.tweens,
      store,
      title: 'inventory.title',
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
    this.hint = new LocalizedText(
      this.theme,
      'caption',
      this.owned.length ? 'inventory.hint' : 'inventory.none',
      undefined,
      { align: 'center', wordWrap: true, wordWrapWidth: 320 },
    );
    this.hint.anchor.set(0.5);

    this.grid = new ScrollGrid({
      theme: this.theme,
      width: 400,
      height: 400,
      cellWidth: CARD_W,
      cellHeight: CARD_H,
    });
    this.grid.setCards(
      this.owned.map((costume) => {
        const card = new Card({
          theme: this.theme,
          tweens: this.tweens,
          width: CARD_W,
          height: CARD_H,
          preview: Assets.get<Texture>(costume.texture),
          title: costume.nameKey,
          onPreviewTap: () => store.getState().equipCostume(costume.id),
        });
        this.cards.set(costume.id, card);
        return card;
      }),
    );
    this.refreshCards();
    this.onDispose(
      store.subscribe(
        (s) => s.equipped[this.theme.world],
        (id) => {
          void this.heroine.setCostume(this.aliasOf(id));
          this.refreshCards();
        },
      ),
    );
    this.addChild(this.backdrop, this.ground, this.heroine, this.hint, this.grid, this.topBar);
  }

  override async show(): Promise<void> {
    this.alpha = 1;
    this.backdrop.alpha = 0;
    void this.tweens.to(this.backdrop, { alpha: 1 }, { duration: TIMING.sceneFadeMs * 1.5 });
    const top = enter(this.tweens, [this.topBar], { from: 'top', distance: 20 });
    const side = enter(this.tweens, [this.heroine, this.hint], {
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
      this.ground.layout(col + 80, 72);
      this.ground.position.set(-40, h);
      const heroH = clamp(h * 0.5, 180, 420);
      this.heroine.setTargetHeight(heroH);
      this.heroine.position.set(col / 2, h - this.ground.floorOffset);
      this.hint.style.wordWrapWidth = col - 32;
      this.hint.position.set(col / 2, Math.max(top + 20, h - this.ground.floorOffset - heroH - 40));
      const gridX = col + 12;
      this.grid.position.set(gridX, top + 36);
      this.grid.resize(w - gridX - safe, h - top - 36 - safe);
      return;
    }
    const previewH = h < 640 ? 0 : clamp(h * 0.26, 140, 220);
    this.ground.visible = this.heroine.visible = previewH > 0;
    this.ground.layout(w, 56);
    this.ground.position.set(0, top + previewH);
    this.heroine.setTargetHeight(Math.max(100, previewH - 10));
    this.heroine.position.set(w / 2, top + previewH - this.ground.floorOffset);
    this.hint.style.wordWrapWidth = w - safe * 2;
    this.hint.position.set(w / 2, top + previewH + 18);
    const gridTop = top + previewH + 38;
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
    const { store } = this.ctx;
    const s = store.getState();
    for (const costume of this.owned) {
      const card = this.cards.get(costume.id);
      if (!card) continue;
      const equipped = s.equipped[costume.world] === costume.id;
      card.setHighlighted(equipped);
      if (equipped) {
        card.setBadge({ kind: 'text', text: this.text('inventory.equipped'), accent: true });
        card.setButton({
          label: 'inventory.unequip',
          onPress: () => store.getState().unequipCostume(costume.world),
        });
      } else {
        card.setBadge(null);
        card.setButton({
          label: 'inventory.equip',
          primary: true,
          onPress: () => store.getState().equipCostume(costume.id),
        });
      }
    }
  }

  private text(key: Parameters<LocalizedText['setKey']>[0]): string {
    const probe = new LocalizedText(this.theme, 'body', key);
    const value = probe.text;
    probe.destroy();
    return value;
  }

  private aliasOf(id: string | null): string | null {
    return id ? (getCostume(id)?.texture ?? null) : null;
  }
}
