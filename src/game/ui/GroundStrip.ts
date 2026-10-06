import { Assets, FillGradient, Graphics, TilingSprite, type Texture } from 'pixi.js';
import { LAYOUT } from '../../config';
import { Component } from '../core/Component';
import type { ThemeConfig } from '../theme';
import { rgba } from './draw';

/**
 * The tileable pixel-art ground strip from the sibling's hero intro, with faded edges.
 * Origin: bottom-left of the strip. `floorY` (negative) is where feet should stand.
 */
export class GroundStrip extends Component {
  private readonly tiling: TilingSprite;
  private readonly fadeLeft = new Graphics();
  private readonly fadeRight = new Graphics();
  private readonly theme: ThemeConfig;
  stripHeight: number;

  constructor(theme: ThemeConfig, height = LAYOUT.groundStripHeight) {
    super();
    this.theme = theme;
    this.stripHeight = height;
    const texture = Assets.get<Texture>(theme.assets.ground);
    this.tiling = new TilingSprite({ texture, width: 10, height });
    this.tiling.tileScale.set(height / texture.height);
    this.addChild(this.tiling, this.fadeLeft, this.fadeRight);
    this.eventMode = 'none';
  }

  /** Vertical offset (from the strip's top) where characters' feet rest. */
  get floorOffset(): number {
    return this.stripHeight * 0.5;
  }

  layout(width: number, height = this.stripHeight): void {
    this.stripHeight = height;
    this.tiling.height = height;
    this.tiling.width = width;
    this.tiling.tileScale.set(height / this.tiling.texture.height);
    this.tiling.position.set(0, -height);
    const fadeW = Math.min(width * 0.25, 260);
    const bg = this.theme.colors.bgTo;
    const grad = (dir: 1 | -1) =>
      new FillGradient({
        type: 'linear',
        start: { x: dir === 1 ? 0 : 1, y: 0 },
        end: { x: dir === 1 ? 1 : 0, y: 0 },
        colorStops: [
          { offset: 0, color: rgba(bg, 0.95) },
          { offset: 0.5, color: rgba(bg, 0.45) },
          { offset: 1, color: rgba(bg, 0) },
        ],
        textureSpace: 'local',
      });
    this.fadeLeft.clear().rect(0, -height, fadeW, height).fill(grad(1));
    this.fadeRight
      .clear()
      .rect(width - fadeW, -height, fadeW, height)
      .fill(grad(-1));
  }
}
