import { Container, Graphics, Rectangle, Sprite, type Texture } from 'pixi.js';
import type { TranslationKey } from '../../i18n';
import { Component } from '../core/Component';
import { fitContain } from '../core/layout';
import type { TweenGroup } from '../core/Tween';
import type { ThemeConfig } from '../theme';
import { easings } from '../theme/ease';
import { UiButton } from './Button';
import { drawGlyph, drawPanel } from './draw';
import { LocalizedText, makeText } from './text';

export interface CardOptions {
  theme: ThemeConfig;
  tweens: TweenGroup;
  width: number;
  height: number;
  preview?: Texture;
  /** Portion of the card height reserved for the preview (default 0.56). */
  previewRatio?: number;
  title: TranslationKey;
  titleParams?: Record<string, string | number>;
  onPress?: () => void;
  onPreviewTap?: () => void;
}

export type CardBadge =
  { kind: 'text'; text: string; accent?: boolean } | { kind: 'locked' } | null;

/**
 * Shop / inventory / collection card: panel, preview sprite fitted in the top area, title,
 * a badge line (price / state) and an optional action button. Origin top-left.
 */
export class Card extends Component {
  readonly cardWidth: number;
  readonly cardHeight: number;
  private readonly theme: ThemeConfig;
  private readonly bg = new Graphics();
  private readonly preview: Sprite | null = null;
  private readonly previewArea: Container;
  private readonly lockIcon = new Graphics();
  private readonly title: LocalizedText;
  private badgeText;
  private button: UiButton | null = null;
  private buttonKey = '';
  private buttonHandler: (() => void) | null = null;
  private readonly tweens: TweenGroup;

  constructor(opts: CardOptions) {
    super();
    this.theme = opts.theme;
    this.tweens = opts.tweens;
    this.cardWidth = opts.width;
    this.cardHeight = opts.height;
    const pad = 12;
    const previewH = Math.round(opts.height * (opts.previewRatio ?? 0.56));

    drawPanel(this.bg, opts.theme, opts.width, opts.height, { raised: false });
    this.addChild(this.bg);

    this.previewArea = new Container();
    this.previewArea.position.set(opts.width / 2, pad + previewH / 2);
    this.addChild(this.previewArea);
    if (opts.preview) {
      this.preview = new Sprite(opts.preview);
      this.preview.anchor.set(0.5);
      const s = fitContain(opts.preview.width, opts.preview.height, opts.width - pad * 2, previewH);
      this.preview.scale.set(s);
      this.previewArea.addChild(this.preview);
    }
    drawGlyph(this.lockIcon, 'lock', 28, opts.theme.colors.textMuted);
    this.lockIcon.visible = false;
    this.previewArea.addChild(this.lockIcon);

    this.title = new LocalizedText(opts.theme, 'body', opts.title, opts.titleParams, {
      fontSize: 15,
      wordWrap: true,
      wordWrapWidth: opts.width - pad * 2,
      align: 'center',
    });
    this.title.anchor.set(0.5, 0);
    this.title.position.set(opts.width / 2, pad + previewH + 8);
    this.addChild(this.title);

    this.badgeText = makeText(opts.theme, 'price', '');
    this.badgeText.anchor.set(0.5, 0);
    this.badgeText.position.set(opts.width / 2, this.title.y + this.title.height + 4);
    this.addChild(this.badgeText);

    // Hover lift (desktop); touch devices just tap.
    this.eventMode = 'static';
    this.hitArea = new Rectangle(0, 0, opts.width, opts.height);
    let lifted = false;
    let baseY = 0;
    this.listen(this, 'pointerover', () => {
      if (lifted) return;
      lifted = true;
      baseY = this.y;
      void this.tweens.to(
        this as Container,
        { y: baseY - 5 },
        { duration: 160, ease: easings.quadOut },
      );
    });
    this.listen(this, 'pointerout', () => {
      if (!lifted) return;
      lifted = false;
      void this.tweens.to(
        this as Container,
        { y: baseY },
        { duration: 200, ease: easings.quadOut },
      );
    });

    if (opts.onPreviewTap) {
      // The whole card is the try-on target (the action button sits on top and also bubbles).
      this.cursor = 'pointer';
      const onTap = opts.onPreviewTap;
      this.listen(this, 'pointertap', () => onTap());
    }
  }

  /**
   * Set the action button. The instance is reused when only `enabled` / the handler change, so
   * a hovered button is never destroyed under the pointer.
   */
  setButton(
    config: {
      label: TranslationKey;
      primary?: boolean;
      enabled?: boolean;
      onPress: () => void;
    } | null,
  ): void {
    if (!config) {
      this.button?.destroy();
      this.button = null;
      this.buttonKey = '';
      this.buttonHandler = null;
      return;
    }
    const key = `${config.label}|${config.primary ? 1 : 0}`;
    this.buttonHandler = config.onPress;
    if (!this.button || this.buttonKey !== key) {
      this.button?.destroy();
      this.buttonKey = key;
      this.button = new UiButton({
        theme: this.theme,
        tweens: this.tweens,
        variant: config.primary ? 'primary' : 'ghost',
        label: config.label,
        height: 36,
        width: this.cardWidth - 28,
        onPress: () => this.buttonHandler?.(),
      });
      this.button.position.set(this.cardWidth / 2, this.cardHeight - 14 - 18);
      this.addChild(this.button);
    }
    this.button.enabled = config.enabled ?? true;
  }

  setBadge(badge: CardBadge): void {
    const c = this.theme.colors;
    this.lockIcon.visible = badge?.kind === 'locked';
    if (this.preview) {
      const locked = badge?.kind === 'locked';
      this.preview.tint = locked ? 0x000000 : 0xffffff;
      this.preview.alpha = locked ? 0.45 : 1;
    }
    if (badge?.kind === 'text') {
      this.badgeText.text = badge.text;
      this.badgeText.style.fill = badge.accent ? c.accentBright : c.textMuted;
      this.badgeText.visible = true;
    } else {
      this.badgeText.visible = false;
    }
  }

  setHighlighted(on: boolean): void {
    drawPanel(this.bg, this.theme, this.cardWidth, this.cardHeight, { raised: on, glow: on });
  }
}
