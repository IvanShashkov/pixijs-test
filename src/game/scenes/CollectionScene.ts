import { Assets, type Texture } from 'pixi.js';
import { ECONOMY } from '../../config';
import { Scene } from '../core/Scene';
import { enter } from '../core/anim';
import { TIMING } from '../../config';
import type { Viewport } from '../core/layout';
import { ACTIVITIES } from '../data/activities';
import { Backdrop } from '../ui/Backdrop';
import { Card } from '../ui/Card';
import { ScrollGrid } from '../ui/ScrollGrid';
import { LocalizedText } from '../ui/text';
import { TopBar } from '../ui/TopBar';

const CARD_W = 160;
const CARD_H = 210;

/** The eight activities of the active world, locked until found in loot. */
export class CollectionScene extends Scene {
  private backdrop!: Backdrop;
  private topBar!: TopBar;
  private progress!: LocalizedText;
  private hint!: LocalizedText;
  private grid!: ScrollGrid;
  private cards: Card[] = [];

  override init(): void {
    const { store, scenes } = this.ctx;
    this.backdrop = new Backdrop({ theme: this.theme, world: this.theme.world, tint: 0.65 });
    this.topBar = new TopBar({
      theme: this.theme,
      tweens: this.tweens,
      store,
      title: 'collection.title',
      onBack: () => void scenes.goTo('menu', undefined),
    });
    this.progress = new LocalizedText(this.theme, 'eyebrow', 'collection.progress', {
      n: 0,
      total: ECONOMY.activitiesPerWorld,
    });
    this.progress.anchor.set(0.5);
    const lootKey = this.theme.lootKind === 'chest' ? 'loot.chest' : 'loot.container';
    const lootProbe = new LocalizedText(this.theme, 'body', lootKey);
    this.hint = new LocalizedText(
      this.theme,
      'caption',
      'collection.hint',
      { loot: lootProbe.text },
      { align: 'center', wordWrap: true, wordWrapWidth: 420 },
    );
    lootProbe.destroy();
    this.hint.anchor.set(0.5);

    this.grid = new ScrollGrid({
      theme: this.theme,
      width: 400,
      height: 400,
      cellWidth: CARD_W,
      cellHeight: CARD_H,
    });
    this.cards = ACTIVITIES.map(
      (activity) =>
        new Card({
          theme: this.theme,
          tweens: this.tweens,
          width: CARD_W,
          height: CARD_H,
          preview: Assets.get<Texture>(this.theme.assets.activities[activity.index]),
          previewRatio: 0.62,
          title: activity.nameKey,
        }),
    );
    this.grid.setCards(this.cards);
    this.refresh();
    this.onDispose(
      store.subscribe(
        (s) => s.collection[this.theme.world],
        () => this.refresh(),
      ),
    );
    this.addChild(this.backdrop, this.progress, this.hint, this.grid, this.topBar);
  }

  override async show(): Promise<void> {
    this.alpha = 1;
    this.backdrop.alpha = 0;
    void this.tweens.to(this.backdrop, { alpha: 1 }, { duration: TIMING.sceneFadeMs * 1.5 });
    const top = enter(this.tweens, [this.topBar], { from: 'top', distance: 20 });
    const side = enter(this.tweens, [this.progress, this.hint], {
      from: 'left',
      distance: 24,
      delay: 80,
      stagger: 40,
    });
    const cards = enter(this.tweens, this.cards, {
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
    const top = this.topBar.bottom + 10;
    this.progress.position.set(w / 2, top + 10);
    this.hint.style.wordWrapWidth = Math.min(420, w - safe * 2);
    this.hint.position.set(w / 2, top + 34);
    const gridTop = top + 60;
    const gridW = Math.min(w - safe * 2, 4 * CARD_W + 3 * 16);
    this.grid.position.set((w - gridW) / 2, gridTop);
    const cardW = vp.portrait ? Math.min(CARD_W, (w - safe * 2 - 16) / 2) : CARD_W;
    this.grid.resize(gridW, h - gridTop - safe, cardW, Math.round(cardW * (CARD_H / CARD_W)));
  }

  override update(ticker: Parameters<Scene['update']>[0]): void {
    super.update(ticker);
    this.backdrop.update(ticker.deltaMS);
  }

  private refresh(): void {
    const unlocked = this.ctx.store.getState().collection[this.theme.world];
    this.progress.setParams({ n: unlocked.length, total: ECONOMY.activitiesPerWorld });
    const lockedProbe = new LocalizedText(this.theme, 'body', 'collection.locked');
    ACTIVITIES.forEach((activity, i) => {
      const card = this.cards[i];
      const isUnlocked = unlocked.includes(activity.id);
      card.setHighlighted(isUnlocked);
      card.setBadge(isUnlocked ? null : { kind: 'locked' });
      card.setButton(null);
      if (!isUnlocked) card.setBadge({ kind: 'locked' });
    });
    lockedProbe.destroy();
  }
}
