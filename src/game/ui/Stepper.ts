import { Graphics } from 'pixi.js';
import { Component } from '../core/Component';
import type { TweenGroup } from '../core/Tween';
import type { ThemeConfig } from '../theme';
import { UiButton } from './Button';
import { makeText } from './text';

export interface StepperOptions {
  theme: ThemeConfig;
  tweens: TweenGroup;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  /** Total width (default 196). */
  width?: number;
}

/** `[−] value [+]` control. Origin top-left; height 40. */
export class Stepper extends Component {
  readonly stepperWidth: number;
  readonly stepperHeight = 40;
  private readonly minus: UiButton;
  private readonly plus: UiButton;
  private readonly valueText;
  private readonly opts: StepperOptions;
  private value: number;

  constructor(opts: StepperOptions) {
    super();
    this.opts = opts;
    this.value = opts.value;
    const w = opts.width ?? 196;
    this.stepperWidth = w;
    const h = this.stepperHeight;
    const c = opts.theme.colors;

    const track = new Graphics()
      .roundRect(h / 2, 6, w - h, h - 12, opts.theme.shape.radius)
      .fill({ color: c.surface, alpha: c.surfaceAlpha });
    this.addChild(track);

    this.minus = new UiButton({
      theme: opts.theme,
      tweens: opts.tweens,
      variant: 'icon',
      glyph: 'minus',
      height: h,
      onPress: () => this.change(-1),
    });
    this.plus = new UiButton({
      theme: opts.theme,
      tweens: opts.tweens,
      variant: 'icon',
      glyph: 'plus',
      height: h,
      onPress: () => this.change(1),
    });
    this.minus.position.set(h / 2, h / 2);
    this.plus.position.set(w - h / 2, h / 2);

    this.valueText = makeText(opts.theme, 'price', opts.format(opts.value), { fill: c.text });
    this.valueText.anchor.set(0.5);
    this.valueText.position.set(w / 2, h / 2);
    this.addChild(this.valueText, this.minus, this.plus);
    this.refresh();
  }

  setValue(value: number): void {
    this.value = value;
    this.refresh();
  }

  private change(direction: number): void {
    const decimals = this.opts.step < 1 ? (String(this.opts.step).split('.')[1]?.length ?? 1) : 0;
    const next = Number((this.value + direction * this.opts.step).toFixed(decimals));
    if (next < this.opts.min - 1e-9 || next > this.opts.max + 1e-9) return;
    this.value = next;
    this.refresh();
    this.opts.onChange(next);
  }

  private refresh(): void {
    this.valueText.text = this.opts.format(this.value);
    this.minus.enabled = this.value > this.opts.min + 1e-9;
    this.plus.enabled = this.value < this.opts.max - 1e-9;
  }
}
