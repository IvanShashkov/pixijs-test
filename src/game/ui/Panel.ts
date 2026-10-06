import { Container, Graphics } from 'pixi.js';
import type { TranslationKey } from '../../i18n';
import { Component } from '../core/Component';
import type { ThemeConfig } from '../theme';
import { drawCorners, drawDivider, drawPanel, type PanelDrawOptions } from './draw';
import { LocalizedText } from './text';

export interface PanelOptions extends PanelDrawOptions {
  theme: ThemeConfig;
  width: number;
  height: number;
  title?: TranslationKey;
  titleParams?: Record<string, string | number>;
  /** Draw corner ornaments (default true). */
  corners?: boolean;
  padding?: number;
}

/** Themed surface with optional title + divider; children go into `content` (inset by padding). */
export class Panel extends Component {
  readonly content = new Container();
  readonly title: LocalizedText | null = null;
  private readonly bg = new Graphics();
  private readonly ornaments = new Graphics();
  private readonly divider = new Graphics();
  private readonly theme: ThemeConfig;
  private readonly opts: PanelOptions;
  panelWidth: number;
  panelHeight: number;
  readonly padding: number;

  constructor(opts: PanelOptions) {
    super();
    this.theme = opts.theme;
    this.opts = opts;
    this.padding = opts.padding ?? 20;
    this.panelWidth = opts.width;
    this.panelHeight = opts.height;
    this.addChild(this.bg, this.ornaments);
    if (opts.title) {
      this.title = new LocalizedText(opts.theme, 'heading', opts.title, opts.titleParams);
      this.title.anchor.set(0.5, 0);
      this.addChild(this.title, this.divider);
    }
    this.addChild(this.content);
    this.resize(opts.width, opts.height);
  }

  /** Height consumed by the title block (0 when there is none). */
  get headerHeight(): number {
    return this.title ? this.title.height + 30 : 0;
  }

  resize(width: number, height: number): void {
    this.panelWidth = width;
    this.panelHeight = height;
    drawPanel(this.bg, this.theme, width, height, this.opts);
    this.ornaments.clear();
    if (this.opts.corners !== false) drawCorners(this.ornaments, this.theme, width, height);
    if (this.title) {
      this.title.position.set(width / 2, this.padding * 0.8);
      drawDivider(this.divider, this.theme, Math.min(width - this.padding * 2, 320));
      this.divider.position.set(width / 2, this.padding * 0.8 + this.title.height + 14);
    }
    this.content.position.set(this.padding, this.padding + this.headerHeight);
  }

  /** Inner width available to content. */
  get innerWidth(): number {
    return this.panelWidth - this.padding * 2;
  }

  get innerHeight(): number {
    return this.panelHeight - this.padding * 2 - this.headerHeight;
  }
}
