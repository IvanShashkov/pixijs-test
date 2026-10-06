import { FancyButton } from '@pixi/ui';
import { Container, Graphics } from 'pixi.js';
import type { TranslationKey } from '../../i18n';
import { TIMING } from '../../config';
import { loopPulse } from '../core/anim';
import { Component } from '../core/Component';
import type { TweenGroup } from '../core/Tween';
import type { ThemeConfig } from '../theme';
import { easings } from '../theme/ease';
import {
  buttonMask,
  drawButton,
  drawButtonGlow,
  drawGlyph,
  drawSheen,
  type ButtonState,
  type ButtonVariant,
  type GlyphName,
} from './draw';
import { LocalizedText, makeText } from './text';

export interface UiButtonOptions {
  theme: ThemeConfig;
  tweens: TweenGroup;
  variant?: ButtonVariant;
  /** Label key; `labels` lists every key the button may show so its width fits all of them. */
  label?: TranslationKey;
  labelParams?: Record<string, string | number>;
  labels?: TranslationKey[];
  /** Raw text instead of a key (prices, numbers). */
  text?: string;
  glyph?: GlyphName;
  width?: number;
  height?: number;
  minWidth?: number;
  /** Breathing glow + periodic sheen (the sibling's hero CTA). */
  pulse?: boolean;
  onPress?: () => void;
}

const STATES: ButtonState[] = ['idle', 'hover', 'pressed', 'disabled'];

/**
 * Themed button on top of @pixi/ui FancyButton. Views are Graphics drawn from the theme for
 * each state on an identical padded canvas (so state swaps never shift the shape); hover adds a
 * sheen sweep and a small scale tween from the scene's group. Origin is the button centre.
 */
export class UiButton extends Component {
  readonly fancy: FancyButton;
  readonly buttonWidth: number;
  readonly buttonHeight: number;
  private readonly labelText: LocalizedText | null;
  private readonly tweens: TweenGroup;
  private readonly sheen = new Graphics();
  private readonly sheenMask = new Graphics();
  private readonly glow: Graphics | null = null;
  private scaleTarget = 1;
  private sheenRunning = false;

  constructor(opts: UiButtonOptions) {
    super();
    const theme = opts.theme;
    const variant = opts.variant ?? 'ghost';
    this.tweens = opts.tweens;

    const textVariant = variant === 'primary' ? 'buttonOnAccent' : 'button';
    let labelNode: LocalizedText | null = null;
    let content: Container | undefined;
    let contentWidth = 0;
    if (opts.glyph) {
      const size = (opts.height ?? 44) * 0.45;
      const color = variant === 'primary' ? theme.colors.textOnAccent : theme.colors.accentBright;
      content = drawGlyph(new Graphics(), opts.glyph, size, color, true);
      contentWidth = size;
    } else if (opts.label) {
      labelNode = new LocalizedText(theme, textVariant, opts.label, opts.labelParams);
      content = labelNode;
      const probe = new LocalizedText(theme, textVariant, opts.label, opts.labelParams);
      for (const key of opts.labels ?? [opts.label]) {
        probe.setKey(key, opts.labelParams);
        contentWidth = Math.max(contentWidth, probe.width);
      }
      probe.destroy();
    } else if (opts.text !== undefined) {
      content = makeText(theme, textVariant, opts.text);
      contentWidth = content.width;
    }
    this.labelText = labelNode;

    const height = opts.height ?? (variant === 'icon' ? 44 : 48);
    const paddingX = variant === 'icon' ? 0 : 26;
    const width =
      opts.width ??
      Math.max(
        opts.minWidth ?? (variant === 'icon' ? height : 120),
        Math.ceil(contentWidth + paddingX * 2),
      );
    this.buttonWidth = width;
    this.buttonHeight = height;

    if (opts.pulse) {
      this.glow = drawButtonGlow(new Graphics(), theme, variant, width, height);
      this.glow.position.set(-width / 2, -height / 2);
      this.glow.alpha = 0.25;
      this.addChild(this.glow);
      void loopPulse(
        this.tweens,
        this.glow,
        'alpha',
        0.2,
        0.75,
        TIMING.pulseMs * 2,
        () => !this.isDisposed,
      );
    }

    const views = Object.fromEntries(
      STATES.map((state) => [
        state,
        drawButton(new Graphics(), theme, variant, state, width, height),
      ]),
    ) as Record<ButtonState, Graphics>;

    this.fancy = new FancyButton({
      defaultView: views.idle,
      hoverView: views.hover,
      pressedView: views.pressed,
      disabledView: views.disabled,
      ...(content
        ? labelNode || !opts.glyph
          ? { text: content as LocalizedText }
          : { icon: content }
        : {}),
      anchor: 0.5,
      padding: 0,
      textOffset: { default: { y: variant === 'icon' ? 0 : 1 } },
    });
    this.fancy.eventMode = 'static';
    this.fancy.cursor = 'pointer';
    this.addChild(this.fancy);

    // Sheen: a diagonal highlight bar clipped to the button shape, swept on hover.
    drawSheen(this.sheen, theme, variant, width, height);
    buttonMask(this.sheenMask, theme, variant, width, height);
    this.sheenMask.position.set(-width / 2, -height / 2);
    this.sheen.mask = this.sheenMask;
    this.sheen.visible = false;
    this.sheen.blendMode = 'add';
    this.sheen.eventMode = 'none';
    this.addChild(this.sheenMask, this.sheen);

    this.connect(this.fancy.onHover, () => {
      this.animateScale(1.04);
      void this.playSheen();
    });
    this.connect(this.fancy.onOut, () => this.animateScale(1));
    this.connect(this.fancy.onDown, () => this.animateScale(0.96));
    this.connect(this.fancy.onUp, () => this.animateScale(1.04));
    this.connect(this.fancy.onUpOut, () => this.animateScale(1));
    if (opts.onPress) {
      const onPress = opts.onPress;
      this.connect(this.fancy.onPress, () => {
        if (this.fancy.enabled) onPress();
      });
    }
    if (opts.pulse) void this.loopSheen();
  }

  get enabled(): boolean {
    return this.fancy.enabled;
  }

  set enabled(value: boolean) {
    this.fancy.enabled = value;
    this.fancy.cursor = value ? 'pointer' : 'default';
    if (!value) this.scale.set(1);
  }

  setLabel(key: TranslationKey, params?: Record<string, string | number>): void {
    this.labelText?.setKey(key, params);
  }

  /** One sweep of the highlight bar across the button. */
  async playSheen(): Promise<void> {
    if (this.sheenRunning || this.isDisposed || !this.fancy.enabled) return;
    this.sheenRunning = true;
    const w = this.buttonWidth;
    const h = this.buttonHeight;
    this.sheen.visible = true;
    this.sheen.position.set(-w / 2 - w * 0.5, -h / 2);
    await this.tweens.to(
      this.sheen,
      { x: w / 2 + h * 0.4 },
      { duration: TIMING.sheenMs, ease: easings.cubicInOut },
    );
    if (this.isDisposed) return;
    this.sheen.visible = false;
    this.sheenRunning = false;
  }

  private async loopSheen(): Promise<void> {
    while (!this.isDisposed) {
      if (!(await this.tweens.delay(3200))) return;
      await this.playSheen();
    }
  }

  private animateScale(target: number): void {
    if (!this.fancy.enabled || this.isDisposed || this.scaleTarget === target) return;
    this.scaleTarget = target;
    void this.tweens.to(
      this.scale,
      { x: target, y: target },
      { duration: TIMING.sceneFadeMs * 0.5, ease: easings.quadOut },
    );
  }
}
