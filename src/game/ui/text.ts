import { Text, type TextStyleOptions } from 'pixi.js';
import { t, type TranslationKey } from '../../i18n';
import type { ThemeConfig } from '../theme';

export type TextVariant =
  | 'title'
  | 'heading'
  | 'eyebrow'
  | 'body'
  | 'bodyMuted'
  | 'button'
  | 'buttonOnAccent'
  | 'hudLabel'
  | 'hudValue'
  | 'caption'
  | 'price'
  | 'small'
  | 'popup';

const HEADING_VARIANTS: ReadonlySet<TextVariant> = new Set([
  'title',
  'heading',
  'eyebrow',
  'button',
  'buttonOnAccent',
  'hudValue',
  'price',
  'popup',
]);

/** TextStyle options for a semantic variant in a world. Every Text in the game goes through here. */
export function textStyle(
  theme: ThemeConfig,
  variant: TextVariant,
  overrides: Partial<TextStyleOptions> = {},
): TextStyleOptions {
  const { colors: c, fonts } = theme;
  const heading = { fontFamily: fonts.heading, fontWeight: fonts.headingWeight };
  const body = { fontFamily: fonts.body, fontWeight: 'normal' as const };
  const shadow = { alpha: 0.6, angle: Math.PI / 2, blur: 4, color: 0x000000, distance: 2 };
  const base: Record<TextVariant, TextStyleOptions> = {
    title: {
      ...heading,
      fontSize: 42,
      fill: c.accentBright,
      letterSpacing: fonts.headingLetterSpacing * 2,
      dropShadow: shadow,
    },
    heading: { ...heading, fontSize: 24, fill: c.text, letterSpacing: fonts.headingLetterSpacing },
    eyebrow: { ...heading, fontSize: 11, fill: c.accent, letterSpacing: 4 },
    body: { ...body, fontSize: 16, fill: c.text },
    bodyMuted: { ...body, fontSize: 15, fill: c.textMuted },
    button: { ...heading, fontSize: 15, fill: c.text, letterSpacing: fonts.headingLetterSpacing },
    buttonOnAccent: {
      ...heading,
      fontSize: 15,
      fill: c.textOnAccent,
      letterSpacing: fonts.headingLetterSpacing,
    },
    hudLabel: { ...body, fontSize: 11, fill: c.textMuted, letterSpacing: 2 },
    hudValue: { ...heading, fontSize: 26, fill: c.accentBright },
    caption: { ...body, fontSize: 13, fill: c.textMuted },
    price: { ...heading, fontSize: 16, fill: c.accent },
    small: { ...body, fontSize: 12, fill: c.textMuted },
    popup: { ...heading, fontSize: 28, fill: c.accentBright, dropShadow: shadow },
  };
  return { ...base[variant], ...overrides };
}

export function transformText(theme: ThemeConfig, variant: TextVariant, raw: string): string {
  const uppercase =
    variant === 'eyebrow' || (HEADING_VARIANTS.has(variant) && theme.fonts.headingUppercase);
  return uppercase ? raw.toUpperCase() : raw;
}

/** A Text for a raw string (numbers, formatted values). */
export function makeText(
  theme: ThemeConfig,
  variant: TextVariant,
  raw: string,
  overrides?: Partial<TextStyleOptions>,
): Text {
  return new Text({
    text: transformText(theme, variant, raw),
    style: textStyle(theme, variant, overrides),
  });
}

/**
 * Text bound to an i18n key. Locale switches rebuild the whole scene, so this only needs to
 * know its key/params to produce the right string for the scene's lifetime; `setParams` covers
 * dynamic values ("Score: {n}").
 */
export class LocalizedText extends Text {
  private readonly theme: ThemeConfig;
  private readonly variant: TextVariant;
  private key: TranslationKey;
  private params: Record<string, string | number> | undefined;

  constructor(
    theme: ThemeConfig,
    variant: TextVariant,
    key: TranslationKey,
    params?: Record<string, string | number>,
    overrides?: Partial<TextStyleOptions>,
  ) {
    super({ text: '', style: textStyle(theme, variant, overrides) });
    this.theme = theme;
    this.variant = variant;
    this.key = key;
    this.params = params;
    this.refresh();
  }

  setKey(key: TranslationKey, params?: Record<string, string | number>): void {
    this.key = key;
    this.params = params;
    this.refresh();
  }

  setParams(params: Record<string, string | number>): void {
    this.params = params;
    this.refresh();
  }

  refresh(): void {
    this.text = transformText(this.theme, this.variant, t(this.key, this.params));
  }
}
