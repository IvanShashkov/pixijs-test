import { ButtonContainer } from '@pixi/ui';
import { Graphics } from 'pixi.js';
import type { TranslationKey } from '../../i18n';
import { Component } from '../core/Component';
import type { ThemeConfig } from '../theme';
import { buttonShape, shapePath } from './draw';
import { LocalizedText } from './text';

export interface TabsOptions {
  theme: ThemeConfig;
  items: TranslationKey[];
  index: number;
  onChange: (index: number) => void;
  /** Total width; defaults to fit the labels. */
  width?: number;
  height?: number;
}

/**
 * Segmented control (world / language / heroine switch): a pill or HUD plate holding N tabs,
 * the active one filled with the accent. Origin is the top-left corner.
 */
export class Tabs extends Component {
  readonly tabsWidth: number;
  readonly tabsHeight: number;
  private readonly theme: ThemeConfig;
  private readonly frame = new Graphics();
  private readonly fills: Graphics[] = [];
  private readonly labels: LocalizedText[] = [];
  private index: number;

  constructor(opts: TabsOptions) {
    super();
    this.theme = opts.theme;
    this.index = opts.index;
    const h = opts.height ?? 36;
    const probes = opts.items.map(
      (key) => new LocalizedText(opts.theme, 'button', key, undefined, { fontSize: 13 }),
    );
    const segW = Math.max(80, ...probes.map((p) => Math.ceil(p.width) + 28));
    const w = opts.width ?? segW * opts.items.length + 8;
    const seg = (w - 8) / opts.items.length;
    this.tabsWidth = w;
    this.tabsHeight = h;

    const { kind, size } = buttonShape(opts.theme);
    shapePath(this.frame, kind, w, h, size).fill({
      color: opts.theme.colors.surface,
      alpha: opts.theme.colors.surfaceAlpha,
    });
    shapePath(this.frame, kind, w, h, size).stroke({
      width: 1,
      alignment: 1,
      color: opts.theme.colors.border,
      alpha: Math.min(1, opts.theme.colors.borderAlpha * 2),
    });
    this.addChild(this.frame);

    opts.items.forEach((_key, i) => {
      const fill = new Graphics();
      fill.position.set(4 + i * seg, 4);
      this.fills.push(fill);
      const label = probes[i];
      label.anchor.set(0.5);
      label.position.set(4 + i * seg + seg / 2, h / 2 + 0.5);
      this.labels.push(label);

      const hit = new Graphics().rect(0, 0, seg, h).fill({ color: 0xffffff, alpha: 0.001 });
      const button = new ButtonContainer(hit);
      button.position.set(4 + i * seg, 0);
      button.eventMode = 'static';
      button.cursor = 'pointer';
      this.connect(button.onPress, () => {
        if (i === this.index) return;
        this.setIndex(i);
        opts.onChange(i);
      });
      this.addChild(fill, label, button);
    });
    this.redraw(seg, h);
  }

  get activeIndex(): number {
    return this.index;
  }

  setIndex(i: number): void {
    this.index = i;
    this.redraw((this.tabsWidth - 8) / this.fills.length, this.tabsHeight);
  }

  private redraw(seg: number, h: number): void {
    const c = this.theme.colors;
    const { kind, size } = buttonShape(this.theme);
    this.fills.forEach((fill, i) => {
      fill.clear();
      if (i !== this.index) return;
      shapePath(fill, kind, seg, h - 8, Math.max(0, size - 4)).fill({ color: c.accent });
      shapePath(fill, kind, seg, h - 8, Math.max(0, size - 4)).stroke({
        width: 1,
        alignment: 1,
        color: c.accentBright,
        alpha: 0.8,
      });
    });
    this.labels.forEach((label, i) => {
      label.style.fill = i === this.index ? c.textOnAccent : c.textMuted;
    });
  }
}
