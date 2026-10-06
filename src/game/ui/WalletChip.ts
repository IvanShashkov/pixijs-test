import { Graphics } from 'pixi.js';
import type { GameStore } from '../../stores/gameStore';
import { Component } from '../core/Component';
import { formatPoints } from '../core/layout';
import type { ThemeConfig } from '../theme';
import { drawPanel } from './draw';
import { makeText } from './text';

/** `◆ 1 250` pill bound to the wallet. Origin = centre. */
export class WalletChip extends Component {
  private readonly bg = new Graphics();
  private readonly text;
  private readonly theme: ThemeConfig;
  chipWidth = 0;
  readonly chipHeight = 34;

  constructor(theme: ThemeConfig, store: GameStore) {
    super();
    this.theme = theme;
    this.text = makeText(theme, 'price', '');
    this.text.anchor.set(0.5);
    this.addChild(this.bg, this.text);
    const update = (points: number) => {
      this.text.text = `◆ ${formatPoints(points)}`;
      this.chipWidth = Math.ceil(this.text.width) + 28;
      drawPanel(this.bg, this.theme, this.chipWidth, this.chipHeight, { raised: true });
      this.bg.position.set(-this.chipWidth / 2, -this.chipHeight / 2);
    };
    update(store.getState().wallet.points);
    this.onDispose(store.subscribe((s) => s.wallet.points, update));
  }
}
