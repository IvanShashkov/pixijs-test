import { Slider } from '@pixi/ui';
import { Graphics } from 'pixi.js';
import { Component } from '../core/Component';
import type { ThemeConfig } from '../theme';
import { goldGradient } from './draw';
import { makeText } from './text';

export interface SliderRowOptions {
  theme: ThemeConfig;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  /** Track width (default 180). */
  width?: number;
}

/** @pixi/ui Slider with theme-drawn track / fill / handle and a value label. Origin top-left; height 40. */
export class SliderRow extends Component {
  readonly rowWidth: number;
  readonly rowHeight = 40;
  private readonly slider: Slider;
  private readonly valueText;

  constructor(opts: SliderRowOptions) {
    super();
    const trackW = opts.width ?? 180;
    const valueW = 64;
    this.rowWidth = trackW + 12 + valueW;
    const c = opts.theme.colors;
    const r = 3;
    const handleR = 11;

    const bg = new Graphics()
      .roundRect(0, 0, trackW, 6, r)
      .fill({ color: c.surfaceRaised, alpha: 1 });
    bg.roundRect(0, 0, trackW, 6, r).stroke({
      width: 1,
      color: c.border,
      alpha: c.borderAlpha * 2,
    });
    const fill = new Graphics().roundRect(0, 0, trackW, 6, r).fill({ color: c.accent });
    const handle = new Graphics().circle(0, 0, handleR).fill({ color: c.surfaceRaised });
    handle.circle(0, 0, handleR).stroke({
      width: 2,
      alignment: 1,
      ...(opts.theme.shape.buttonBorder === 'gradient'
        ? { fill: goldGradient(opts.theme) }
        : { color: c.accentBright }),
    });
    handle.circle(0, 0, 4).fill({ color: c.accentBright });

    this.slider = new Slider({
      bg,
      fill,
      slider: handle,
      min: opts.min,
      max: opts.max,
      step: opts.step,
      value: opts.value,
      showValue: false,
    });
    this.slider.position.set(0, (this.rowHeight - 6) / 2);
    this.addChild(this.slider);

    this.valueText = makeText(opts.theme, 'price', opts.format(opts.value), { fill: c.text });
    this.valueText.anchor.set(1, 0.5);
    this.valueText.position.set(this.rowWidth, this.rowHeight / 2);
    this.addChild(this.valueText);

    const decimals = opts.step < 1 ? (String(opts.step).split('.')[1]?.length ?? 1) : 0;
    const round = (v: number) => Number(v.toFixed(decimals));
    this.connect(this.slider.onUpdate, (v) => {
      this.valueText.text = opts.format(round(v));
    });
    this.connect(this.slider.onChange, (v) => {
      const value = round(v);
      this.valueText.text = opts.format(value);
      opts.onChange(value);
    });
  }

  setValue(value: number): void {
    this.slider.value = value;
  }
}
