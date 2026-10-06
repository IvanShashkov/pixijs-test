import type { TranslationKey } from '../../i18n';
import type { GameStore } from '../../stores/gameStore';
import { Component } from '../core/Component';
import type { Viewport } from '../core/layout';
import type { TweenGroup } from '../core/Tween';
import type { ThemeConfig } from '../theme';
import { UiButton } from './Button';
import { LocalizedText } from './text';
import { WalletChip } from './WalletChip';

export interface TopBarOptions {
  theme: ThemeConfig;
  tweens: TweenGroup;
  store: GameStore;
  title: TranslationKey;
  onBack: () => void;
  /** Show the wallet chip (default true). */
  wallet?: boolean;
}

/** Back button · centred title · wallet chip. Call `layout(vp)` from the scene. */
export class TopBar extends Component {
  readonly barHeight = 56;
  private readonly back: UiButton;
  private readonly title: LocalizedText;
  private readonly wallet: WalletChip | null = null;

  constructor(opts: TopBarOptions) {
    super();
    this.back = new UiButton({
      theme: opts.theme,
      tweens: opts.tweens,
      variant: 'icon',
      glyph: 'back',
      onPress: opts.onBack,
    });
    this.title = new LocalizedText(opts.theme, 'heading', opts.title);
    this.title.anchor.set(0.5);
    this.addChild(this.back, this.title);
    if (opts.wallet !== false) {
      this.wallet = new WalletChip(opts.theme, opts.store);
      this.addChild(this.wallet);
    }
  }

  /** Bottom edge of the bar in screen space (after layout). */
  get bottom(): number {
    return this.y + this.barHeight;
  }

  layout(vp: Viewport): void {
    this.position.set(0, vp.safe);
    const y = this.barHeight / 2;
    this.back.position.set(vp.safe + this.back.buttonWidth / 2, y);
    this.title.position.set(vp.width / 2, y);
    this.wallet?.position.set(vp.width - vp.safe - this.wallet.chipWidth / 2, y);
  }
}
