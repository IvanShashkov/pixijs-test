import { ScrollBox } from '@pixi/ui';
import { Container, Graphics } from 'pixi.js';
import { Component } from '../core/Component';
import type { ThemeConfig } from '../theme';

export interface ScrollGridOptions {
  theme: ThemeConfig;
  width: number;
  height: number;
  cellWidth: number;
  cellHeight: number;
  gap?: number;
}

/**
 * Vertical @pixi/ui ScrollBox holding rows of equally sized cards. Cards are plain containers
 * owned by the caller for layout purposes but destroyed with the grid. `resize` re-flows the
 * same card instances into a new column count. Origin top-left.
 */
export class ScrollGrid extends Component {
  private box: ScrollBox | null = null;
  private rows: Container[] = [];
  private cards: Container[] = [];
  private opts: ScrollGridOptions;
  gridWidth: number;
  gridHeight: number;
  columns = 1;

  constructor(opts: ScrollGridOptions) {
    super();
    this.opts = opts;
    this.gridWidth = opts.width;
    this.gridHeight = opts.height;
    this.onDispose(() => {
      for (const card of this.cards) card.destroy({ children: true });
      this.cards = [];
    });
  }

  setCards(cards: Container[]): void {
    this.cards = cards;
    this.rebuild();
  }

  resize(
    width: number,
    height: number,
    cellWidth = this.opts.cellWidth,
    cellHeight = this.opts.cellHeight,
  ): void {
    this.gridWidth = width;
    this.gridHeight = height;
    this.opts = { ...this.opts, cellWidth, cellHeight };
    this.rebuild();
  }

  private rebuild(): void {
    const gap = this.opts.gap ?? 16;
    const scrollTop = this.box?.scrollY ?? 0;
    // Detach cards so destroying rows / box never destroys them.
    if (this.box) {
      for (const card of this.cards) card.parent?.removeChild(card);
      this.box.removeItems();
      for (const row of this.rows) row.destroy();
      this.rows = [];
      this.box.destroy({ children: true });
      this.box = null;
    }
    // n cells + (n-1) gaps must fit: n ≤ (width + gap) / (cell + gap).
    this.columns = Math.max(1, Math.floor((this.gridWidth + gap) / (this.opts.cellWidth + gap)));
    const rowWidth = this.columns * this.opts.cellWidth + (this.columns - 1) * gap;
    const offsetX = Math.max(0, (this.gridWidth - rowWidth) / 2);

    const box = new ScrollBox({
      width: this.gridWidth,
      height: this.gridHeight,
      type: 'vertical',
      elementsMargin: gap,
      padding: 0,
      disableEasing: false,
      dragTrashHold: 10,
      globalScroll: false,
    });
    this.box = box;
    this.addChild(box);

    for (let i = 0; i < this.cards.length; i += this.columns) {
      const row = new Container();
      // The ScrollBox list re-positions each row so its bounds start at x = 0, which would undo
      // the centring below. An invisible full-width spacer pins the row's bounds to the grid.
      row.addChild(
        new Graphics()
          .rect(0, 0, this.gridWidth, this.opts.cellHeight)
          .fill({ color: 0xffffff, alpha: 0.001 }),
      );
      for (let j = 0; j < this.columns && i + j < this.cards.length; j++) {
        const card = this.cards[i + j];
        card.position.set(offsetX + j * (this.opts.cellWidth + gap), 0);
        row.addChild(card);
      }
      this.rows.push(row);
      box.addItem(row);
    }
    if (scrollTop) box.scrollY = Math.min(scrollTop, box.scrollHeight);
  }
}
