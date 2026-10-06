import type { HeroineKey, World } from '../../config';

/** Colours are 0xRRGGBB numbers; alphas live next to the colours that need them. */
export interface ThemeColors {
  bg: number;
  bgFrom: number;
  bgMid: number;
  bgTo: number;
  surface: number;
  surfaceAlpha: number;
  surfaceRaised: number;
  surfaceRaisedAlpha: number;
  border: number;
  borderAlpha: number;
  text: number;
  textMuted: number;
  textOnAccent: number;
  accent: number;
  accentBright: number;
  accentDeep: number;
  accentSoftAlpha: number;
  secondary: number;
  /** Magical / active glow (fel green for WoW, cyan for Horizon). */
  glow: number;
  glowAlpha: number;
  danger: number;
  /** Colours used by particle bursts, ornament dots and star fields. */
  particles: number[];
  /** Per-gem tint used for match burst particles and combo popups (index = gem id). */
  gems: number[];
}

export interface ThemeFonts {
  /** Font stacks; the first entry is the primary face, the rest are per-glyph fallbacks. */
  heading: string[];
  body: string[];
  headingUppercase: boolean;
  headingLetterSpacing: number;
  headingWeight: 'bold' | 'normal';
}

export interface ThemeShape {
  radius: number;
  /** Panel silhouette: chamfered HUD plate (Horizon) or rounded card (WoW). */
  panel: 'chamfer' | 'rounded';
  chamfer: number;
  button: 'chamfer' | 'pill';
  /** Corner ornament drawn on panels. */
  corner: 'bracket' | 'flourish';
  divider: 'dots' | 'diamond';
  borderWidth: number;
  /** Buttons: gradient border (WoW) or hairline (Horizon). */
  buttonBorder: 'gradient' | 'hairline';
}

export interface ThemeAssets {
  background: { landscape: string; portrait: string };
  ground: string;
  platform: string;
  heroineRun: string;
  gems: string[];
  loot: { closed: string; open: string };
  activities: string[];
  costumes: string[];
}

export interface ThemeConfig {
  world: World;
  heroine: HeroineKey;
  lootKind: 'chest' | 'container';
  backdrop: 'glows' | 'stars';
  colors: ThemeColors;
  fonts: ThemeFonts;
  shape: ThemeShape;
  assets: ThemeAssets;
  /** World-flavoured easing (0..1 → 0..1). */
  ease: (t: number) => number;
}
