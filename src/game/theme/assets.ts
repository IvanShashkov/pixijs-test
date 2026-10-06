import { BOARD, ECONOMY, type World } from '../../config';
import type { ThemeAssets } from './types';

/**
 * Alias naming convention shared by the manifest (`src/assets/manifest.ts`) and the themes.
 * Everything a scene needs for a world is reachable from `theme.assets`.
 */
export const alias = {
  background: (world: World, orientation: 'landscape' | 'portrait') => `${world}/bg/${orientation}`,
  ground: (world: World) => `${world}/ground`,
  platform: (world: World) => `${world}/platform`,
  heroineRun: (world: World) => `${world}/run`,
  gem: (world: World, index: number) => `${world}/gem/${index}`,
  loot: (world: World, state: 'closed' | 'open') => `${world}/loot/${state}`,
  activity: (world: World, index: number) => `${world}/activity/${index}`,
  costume: (world: World, index: number) => `${world}/costume/${index}`,
  fx: (name: 'whirl' | 'hug' | 'heart') => `fx/${name}`,
} as const;

export function worldAssets(world: World): ThemeAssets {
  return {
    background: {
      landscape: alias.background(world, 'landscape'),
      portrait: alias.background(world, 'portrait'),
    },
    ground: alias.ground(world),
    platform: alias.platform(world),
    heroineRun: alias.heroineRun(world),
    gems: Array.from({ length: BOARD.gemCount }, (_, i) => alias.gem(world, i)),
    loot: { closed: alias.loot(world, 'closed'), open: alias.loot(world, 'open') },
    activities: Array.from({ length: ECONOMY.activitiesPerWorld }, (_, i) =>
      alias.activity(world, i),
    ),
    costumes: Array.from({ length: ECONOMY.costumesPerHeroine }, (_, i) => alias.costume(world, i)),
  };
}
