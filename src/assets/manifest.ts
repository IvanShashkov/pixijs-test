import type { AssetsManifest, UnresolvedAsset } from 'pixi.js';
import { BOARD, ECONOMY, WORLDS, type World } from '../config';
import { alias } from '../game/theme/assets';

/**
 * Every asset the game loads. Files live in `public/assets/**` and are referenced relative to
 * Vite's base URL. Bundles:
 *  - `fonts`             — web fonts, loaded first so the first Text renders with the right face
 *  - `shared`            — effects + both heroines' run frames (the results celebration needs both)
 *  - `wow` / `horizon`   — everything specific to one world except the big backdrops
 *  - `{world}/bg/{orientation}` — one 2752×1536 backdrop each; only the current orientation loads
 */
const base = `${import.meta.env.BASE_URL}assets/`;

export type Orientation = 'landscape' | 'portrait';

export const BUNDLES = {
  fonts: 'fonts',
  shared: 'shared',
  horizon: 'horizon',
  wow: 'wow',
  'horizon/bg/landscape': 'horizon/bg/landscape',
  'horizon/bg/portrait': 'horizon/bg/portrait',
  'wow/bg/landscape': 'wow/bg/landscape',
  'wow/bg/portrait': 'wow/bg/portrait',
} as const;

export type BundleName = (typeof BUNDLES)[keyof typeof BUNDLES];

export const worldBundle = (world: World): BundleName => BUNDLES[world];
export const backgroundBundle = (world: World, orientation: Orientation): BundleName =>
  `${world}/bg/${orientation}` as BundleName;

/**
 * Self-hosted Google Fonts (OFL), one woff2 per family / weight / subset. `unicodeRange` is
 * forwarded to `FontFace`, so the browser picks the Cyrillic file per glyph and falls back to
 * the next family in the stack for faces that have no Cyrillic at all (Cinzel, Chakra Petch, Sora).
 */
const LATIN =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const CYRILLIC = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';

interface FontSpec {
  family: string;
  weight: '400' | '600' | '700';
  subsets: Array<'latin' | 'cyrillic'>;
}

const FONTS: FontSpec[] = [
  { family: 'Chakra Petch', weight: '700', subsets: ['latin'] },
  { family: 'Exo 2', weight: '700', subsets: ['latin', 'cyrillic'] },
  { family: 'Sora', weight: '400', subsets: ['latin'] },
  { family: 'Sora', weight: '600', subsets: ['latin'] },
  { family: 'Inter', weight: '400', subsets: ['latin', 'cyrillic'] },
  { family: 'Inter', weight: '600', subsets: ['latin', 'cyrillic'] },
  { family: 'Cinzel', weight: '700', subsets: ['latin'] },
  { family: 'Cormorant Garamond', weight: '700', subsets: ['latin', 'cyrillic'] },
  { family: 'Spectral', weight: '400', subsets: ['latin', 'cyrillic'] },
  { family: 'Spectral', weight: '600', subsets: ['latin', 'cyrillic'] },
];

const fontAssets: UnresolvedAsset[] = FONTS.flatMap((f) =>
  f.subsets.map((subset) => {
    const slug = f.family.toLowerCase().replace(/ /g, '-');
    return {
      alias: `font/${slug}-${f.weight}-${subset}`,
      src: `${base}fonts/${slug}-${f.weight}-${subset}.woff2`,
      data: {
        family: f.family,
        weights: [f.weight],
        unicodeRange: subset === 'latin' ? LATIN : CYRILLIC,
      },
    };
  }),
);

/** Pixel-art strips keep hard pixels; everything else is filtered. */
const pixelArt = { scaleMode: 'nearest' as const };
/** SVGs are rasterised on load; `resolution` 2 keeps gems/loot crisp on HiDPI. */
const svgData = { resolution: 2 };

const sharedAssets: UnresolvedAsset[] = [
  { alias: alias.fx('whirl'), src: `${base}shared/animations/whirl.webp` },
  { alias: alias.fx('hug'), src: `${base}shared/animations/hug.webp` },
  { alias: alias.fx('heart'), src: `${base}shared/animations/heart.webp` },
  ...WORLDS.map((world) => ({
    alias: alias.heroineRun(world),
    src: `${base}${world}/heroine/run.webp`,
  })),
];

function worldAssetList(world: World): UnresolvedAsset[] {
  const heroineFile = world === 'horizon' ? 'kama' : 'lisa';
  const dir = `${base}${world}/`;
  return [
    { alias: alias.ground(world), src: `${dir}animations/ground.webp`, data: pixelArt },
    { alias: alias.platform(world), src: `${dir}costumes/platform.webp` },
    { alias: alias.loot(world, 'closed'), src: `${dir}loot/closed.svg`, data: svgData },
    { alias: alias.loot(world, 'open'), src: `${dir}loot/open.svg`, data: svgData },
    ...Array.from({ length: BOARD.gemCount }, (_, i) => ({
      alias: alias.gem(world, i),
      src: `${dir}gems/${i}.svg`,
      data: svgData,
    })),
    ...Array.from({ length: ECONOMY.activitiesPerWorld }, (_, i) => ({
      alias: alias.activity(world, i),
      src: `${dir}activities/${i}.webp`,
    })),
    ...Array.from({ length: ECONOMY.costumesPerHeroine }, (_, i) => ({
      alias: alias.costume(world, i),
      src: `${dir}costumes/${heroineFile}-${i}.webp`,
    })),
  ];
}

const orientations: Orientation[] = ['landscape', 'portrait'];

export const manifest: AssetsManifest = {
  bundles: [
    { name: BUNDLES.fonts, assets: fontAssets },
    { name: BUNDLES.shared, assets: sharedAssets },
    ...WORLDS.map((world) => ({ name: worldBundle(world), assets: worldAssetList(world) })),
    ...WORLDS.flatMap((world) =>
      orientations.map((orientation) => ({
        name: backgroundBundle(world, orientation),
        assets: [
          {
            alias: alias.background(world, orientation),
            src: `${base}${world}/backgrounds/${orientation}.webp`,
          },
        ],
      })),
    ),
  ],
};
