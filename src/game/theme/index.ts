import type { World } from '../../config';
import { horizonTheme } from './horizon';
import type { ThemeConfig } from './types';
import { wowTheme } from './wow';

export type { ThemeAssets, ThemeColors, ThemeConfig, ThemeFonts, ThemeShape } from './types';
export { alias } from './assets';
export { easings, cubicBezier, type Easing } from './ease';

const themes: Record<World, ThemeConfig> = { horizon: horizonTheme, wow: wowTheme };

export function getTheme(world: World): ThemeConfig {
  return themes[world];
}
