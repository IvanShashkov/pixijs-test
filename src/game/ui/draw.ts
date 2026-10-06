import { Color, FillGradient, Graphics, type StrokeInput } from 'pixi.js';
import type { ThemeConfig } from '../theme';

/** CSS rgba string from a hex number — gradients need alpha inside the colour. */
export function rgba(color: number, alpha: number): string {
  const c = new Color(color);
  const [r, g, b] = c.toUint8RgbArray();
  return `rgba(${r},${g},${b},${alpha})`;
}

export type ShapeKind = 'chamfer' | 'rounded' | 'pill';

/**
 * Outline path for the three silhouettes used across the UI.
 * `chamfer` cuts the top-left and bottom-right corners (Horizon HUD plates).
 */
export function shapePath(
  g: Graphics,
  kind: ShapeKind,
  w: number,
  h: number,
  size: number,
): Graphics {
  if (kind === 'chamfer') {
    const s = Math.min(size, h / 2, w / 2);
    return g.poly([s, 0, w, 0, w, h - s, w - s, h, 0, h, 0, s], true);
  }
  if (kind === 'pill') return g.roundRect(0, 0, w, h, h / 2);
  return g.roundRect(0, 0, w, h, Math.min(size, h / 2));
}

export function panelShape(theme: ThemeConfig): { kind: ShapeKind; size: number } {
  return theme.shape.panel === 'chamfer'
    ? { kind: 'chamfer', size: theme.shape.chamfer }
    : { kind: 'rounded', size: theme.shape.radius * 2 };
}

export function buttonShape(theme: ThemeConfig): { kind: ShapeKind; size: number } {
  return theme.shape.button === 'chamfer'
    ? { kind: 'chamfer', size: theme.shape.chamfer }
    : { kind: 'pill', size: 0 };
}

/** WoW gold filigree gradient (135°) — also used for dividers and highlights. */
export function goldGradient(theme: ThemeConfig): FillGradient {
  const c = theme.colors;
  return new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    colorStops: [
      { offset: 0, color: c.accentDeep },
      { offset: 0.45, color: c.accentBright },
      { offset: 0.55, color: c.accentBright },
      { offset: 1, color: c.accentDeep },
    ],
    textureSpace: 'local',
  });
}

export interface PanelDrawOptions {
  raised?: boolean;
  /** Override surface alpha. */
  alpha?: number;
  /** Draw the themed border (default true). */
  border?: boolean;
  /** Add the accent glow halo (default false). */
  glow?: boolean;
}

/** Panel surface: glow halo → fill → border, in the world's silhouette. */
export function drawPanel(
  g: Graphics,
  theme: ThemeConfig,
  w: number,
  h: number,
  opts: PanelDrawOptions = {},
): Graphics {
  const { kind, size } = panelShape(theme);
  const c = theme.colors;
  const fillColor = opts.raised ? c.surfaceRaised : c.surface;
  const fillAlpha = opts.alpha ?? (opts.raised ? c.surfaceRaisedAlpha : c.surfaceAlpha);
  g.clear();
  if (opts.glow) {
    const pad = 6;
    g.translateTransform(-pad, -pad);
    shapePath(g, kind, w + pad * 2, h + pad * 2, size + pad).fill({
      color: c.glow,
      alpha: c.glowAlpha * 0.35,
    });
    g.translateTransform(pad, pad);
  }
  shapePath(g, kind, w, h, size).fill({ color: fillColor, alpha: fillAlpha });
  if (opts.border !== false) {
    shapePath(g, kind, w, h, size).stroke({
      width: theme.shape.borderWidth,
      alignment: 1,
      ...(theme.shape.buttonBorder === 'gradient'
        ? { fill: goldGradient(theme), alpha: 0.9 }
        : { color: c.border, alpha: Math.min(1, c.borderAlpha * 2) }),
    });
  }
  return g;
}

export type ButtonState = 'idle' | 'hover' | 'pressed' | 'disabled';
export type ButtonVariant = 'primary' | 'ghost' | 'icon';

/** Padding reserved around every button view so all states share identical bounds. */
export const BUTTON_PAD = 6;

/**
 * Button surface for one state. Every state is drawn on the same padded canvas
 * (−PAD … w+PAD) so FancyButton never re-centres a view when swapping states.
 */
export function drawButton(
  g: Graphics,
  theme: ThemeConfig,
  variant: ButtonVariant,
  state: ButtonState,
  w: number,
  h: number,
): Graphics {
  const c = theme.colors;
  const { kind, size } = variant === 'icon' ? panelShape(theme) : buttonShape(theme);
  const pad = BUTTON_PAD;
  g.clear();
  // Invisible frame that fixes the bounds for all states. It starts at (0,0) and the shape is
  // drawn `pad` further in, because FancyButton centres a view by its bounds *size* only.
  g.rect(0, 0, w + pad * 2, h + pad * 2).fill({ color: 0xffffff, alpha: 0.001 });
  g.translateTransform(pad, pad);
  const path = () => shapePath(g, kind, w, h, size);
  const halo = (grow: number, color: number, alpha: number) => {
    g.translateTransform(-grow, -grow);
    shapePath(g, kind, w + grow * 2, h + grow * 2, size + grow).fill({ color, alpha });
    g.translateTransform(grow, grow);
  };
  if (variant === 'primary') {
    const fill =
      state === 'disabled'
        ? { color: c.accentDeep, alpha: 0.5 }
        : state === 'pressed'
          ? { color: c.accentDeep, alpha: 1 }
          : state === 'hover'
            ? { color: c.accentBright, alpha: 1 }
            : { color: c.accent, alpha: 1 };
    if (state === 'hover') halo(4, c.accent, 0.3);
    path().fill(fill);
    path().stroke({
      width: 1,
      alignment: 1,
      color: c.accentBright,
      alpha: state === 'disabled' ? 0.2 : 0.8,
    });
    return g;
  }
  // ghost / icon
  const gradient = theme.shape.buttonBorder === 'gradient';
  const surfaceAlpha =
    state === 'pressed'
      ? 0.96
      : state === 'hover'
        ? 0.92
        : state === 'disabled'
          ? 0.35
          : c.surfaceAlpha;
  const surface = state === 'hover' || state === 'pressed' ? c.surfaceRaised : c.surface;
  if (state === 'hover') halo(3, c.glow, c.glowAlpha * 0.45);
  path().fill({ color: surface, alpha: surfaceAlpha });
  if (state === 'hover' || state === 'pressed') {
    // WoW: crimson wash (sibling arrow hover); Horizon: cyan wash.
    const wash = gradient ? c.secondary : c.accent;
    path().fill({
      color: wash,
      alpha: state === 'pressed' ? 0.45 : gradient ? 0.42 : c.accentSoftAlpha,
    });
  }
  const border: StrokeInput = gradient
    ? {
        width: theme.shape.borderWidth,
        alignment: 1,
        alpha: state === 'disabled' ? 0.3 : 1,
        fill: goldGradient(theme),
      }
    : {
        width: theme.shape.borderWidth,
        alignment: 1,
        alpha: state === 'disabled' ? 0.3 : state === 'idle' ? 0.7 : 1,
        color: state === 'idle' ? c.accent : c.accentBright,
      };
  path().stroke(border);
  return g;
}

/** Soft glow plate drawn behind a pulsing primary button (alpha is animated by the owner). */
export function drawButtonGlow(
  g: Graphics,
  theme: ThemeConfig,
  variant: ButtonVariant,
  w: number,
  h: number,
): Graphics {
  const { kind, size } = variant === 'icon' ? panelShape(theme) : buttonShape(theme);
  const grow = 10;
  g.clear();
  g.translateTransform(-grow, -grow);
  shapePath(g, kind, w + grow * 2, h + grow * 2, size + grow).fill({
    color: theme.colors.accent,
    alpha: 0.35,
  });
  g.translateTransform(grow, grow);
  return g;
}

/** Mask + diagonal highlight bar used for the hover sheen sweep. */
export function drawSheen(
  g: Graphics,
  theme: ThemeConfig,
  variant: ButtonVariant,
  w: number,
  h: number,
): Graphics {
  const barW = Math.max(28, w * 0.35);
  const color = variant === 'primary' ? 0xffffff : theme.colors.accentBright;
  g.clear();
  g.poly([0, 0, barW, 0, barW - h * 0.4, h, -h * 0.4, h], true).fill(
    new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0.5 },
      end: { x: 1, y: 0.5 },
      colorStops: [
        { offset: 0, color: rgba(color, 0) },
        { offset: 0.5, color: rgba(color, variant === 'primary' ? 0.55 : 0.35) },
        { offset: 1, color: rgba(color, 0) },
      ],
      textureSpace: 'local',
    }),
  );
  return g;
}

export function buttonMask(
  g: Graphics,
  theme: ThemeConfig,
  variant: ButtonVariant,
  w: number,
  h: number,
): Graphics {
  const { kind, size } = variant === 'icon' ? panelShape(theme) : buttonShape(theme);
  g.clear();
  shapePath(g, kind, w, h, size).fill({ color: 0xffffff });
  return g;
}

/** Corner ornaments: Horizon L-brackets with a pip, WoW gold flourishes with a ruby dot. */
export function drawCorners(g: Graphics, theme: ThemeConfig, w: number, h: number): Graphics {
  const c = theme.colors;
  const inset = 8;
  const size = 18;
  const corners: Array<[number, number, number, number]> = [
    [inset, inset, 1, 1],
    [w - inset, inset, -1, 1],
    [inset, h - inset, 1, -1],
    [w - inset, h - inset, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    const p = (px: number, py: number): [number, number] => [
      x + px * sx * (size / 24),
      y + py * sy * (size / 24),
    ];
    if (theme.shape.corner === 'bracket') {
      g.moveTo(...p(2, 10))
        .lineTo(...p(2, 2))
        .lineTo(...p(10, 2));
      g.stroke({ width: 1.2, color: c.accent, alpha: 0.95 });
      g.circle(...p(2, 2), 1.4).fill({ color: c.accent });
    } else {
      g.moveTo(...p(2, 12)).quadraticCurveTo(...p(2, 2), ...p(12, 2));
      g.stroke({ width: 1.2, color: c.accent, alpha: 0.95 });
      g.moveTo(...p(5, 12)).quadraticCurveTo(...p(5, 5), ...p(12, 5));
      g.stroke({ width: 0.6, color: c.accentBright, alpha: 0.7 });
      g.circle(...p(2, 2), 1.6).fill({ color: c.danger });
      g.circle(...p(2, 2), 0.6).fill({ color: c.accentBright });
    }
  }
  return g;
}

/** Horizontal divider centred on (0,0) spanning `w`: Horizon dots or WoW ruby diamond. */
export function drawDivider(g: Graphics, theme: ThemeConfig, w: number): Graphics {
  const c = theme.colors;
  const half = w / 2;
  g.clear();
  if (theme.shape.divider === 'dots') {
    g.moveTo(-half, 0).lineTo(-16, 0).moveTo(16, 0).lineTo(half, 0);
    g.stroke({ width: 1, color: c.accent, alpha: 0.4 });
    g.circle(-9, 0, 2).fill({ color: c.accent });
    g.circle(0, 0, 3).fill({ color: c.accentBright });
    g.circle(9, 0, 2).fill({ color: c.accent });
    g.circle(-9, 0, 4).fill({ color: c.glow, alpha: 0.25 });
    g.circle(9, 0, 4).fill({ color: c.glow, alpha: 0.25 });
    return g;
  }
  const line = new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0.5 },
    end: { x: 1, y: 0.5 },
    colorStops: [
      { offset: 0, color: rgba(c.accent, 0) },
      { offset: 0.5, color: rgba(c.accent, 0.9) },
      { offset: 1, color: rgba(c.accent, 0) },
    ],
    textureSpace: 'local',
  });
  g.rect(-half, -0.5, half - 14, 1).fill(line);
  g.rect(14, -0.5, half - 14, 1).fill(line);
  g.circle(0, 0, 11).fill({ color: c.accent, alpha: 0.18 });
  g.poly([0, -8, 8, 0, 0, 8, -8, 0], true).fill(goldGradient(theme));
  g.circle(0, 0, 3).fill({ color: c.danger });
  g.circle(-1, -1, 1).fill({ color: 0xff9a9a, alpha: 0.9 });
  return g;
}

export type GlyphName =
  'back' | 'pause' | 'play' | 'plus' | 'minus' | 'lock' | 'check' | 'gear' | 'close';

/** Simple vector glyphs so icon buttons need no icon font. Drawn centred on (0,0). */
export function drawGlyph(
  g: Graphics,
  name: GlyphName,
  size: number,
  color: number,
  framed = false,
): Graphics {
  const s = size / 2;
  const stroke = {
    width: Math.max(2, size * 0.14),
    color,
    cap: 'round' as const,
    join: 'round' as const,
  };
  g.clear();
  if (framed) {
    // FancyButton pivots an icon by half its bounds *size*; an invisible frame starting at (0,0)
    // with the glyph centred inside makes that pivot land on the glyph's visual centre.
    const box = size + 6;
    g.rect(0, 0, box, box).fill({ color: 0xffffff, alpha: 0.001 });
    g.translateTransform(box / 2, box / 2);
  }
  switch (name) {
    case 'back':
      g.moveTo(s * 0.4, -s * 0.8)
        .lineTo(-s * 0.5, 0)
        .lineTo(s * 0.4, s * 0.8)
        .stroke(stroke);
      break;
    case 'close':
      g.moveTo(-s * 0.6, -s * 0.6)
        .lineTo(s * 0.6, s * 0.6)
        .moveTo(s * 0.6, -s * 0.6)
        .lineTo(-s * 0.6, s * 0.6)
        .stroke(stroke);
      break;
    case 'pause':
      g.roundRect(-s * 0.65, -s * 0.7, s * 0.45, s * 1.4, 2).fill({ color });
      g.roundRect(s * 0.2, -s * 0.7, s * 0.45, s * 1.4, 2).fill({ color });
      break;
    case 'play':
      g.poly([-s * 0.5, -s * 0.75, s * 0.7, 0, -s * 0.5, s * 0.75], true).fill({ color });
      break;
    case 'plus':
      g.moveTo(-s * 0.7, 0)
        .lineTo(s * 0.7, 0)
        .moveTo(0, -s * 0.7)
        .lineTo(0, s * 0.7)
        .stroke(stroke);
      break;
    case 'minus':
      g.moveTo(-s * 0.7, 0)
        .lineTo(s * 0.7, 0)
        .stroke(stroke);
      break;
    case 'check':
      g.moveTo(-s * 0.7, 0)
        .lineTo(-s * 0.15, s * 0.55)
        .lineTo(s * 0.75, -s * 0.6)
        .stroke(stroke);
      break;
    case 'lock':
      g.roundRect(-s * 0.6, -s * 0.1, s * 1.2, s * 1.0, s * 0.15).fill({ color });
      g.moveTo(-s * 0.35, -s * 0.1)
        .lineTo(-s * 0.35, -s * 0.5)
        .arc(0, -s * 0.5, s * 0.35, Math.PI, 0)
        .lineTo(s * 0.35, -s * 0.1)
        .stroke({ ...stroke, width: Math.max(2, size * 0.12) });
      break;
    case 'gear': {
      const teeth = 8;
      const pts: number[] = [];
      for (let i = 0; i < teeth * 2; i++) {
        const a = (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? s * 0.9 : s * 0.65;
        pts.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.poly(pts, true).fill({ color });
      g.circle(0, 0, s * 0.3).cut();
      break;
    }
  }
  return g;
}
