import { ECONOMY, HEROINE_BY_WORLD, WORLDS, type HeroineKey, type World } from '../../config';
import type { TranslationKey } from '../../i18n/en';

export interface Costume {
  /** `${heroine}-${index}`, e.g. `kama-2`. */
  id: string;
  world: World;
  heroine: HeroineKey;
  index: number;
  price: number;
  /** Assets alias of the full-body sprite. */
  texture: string;
  nameKey: TranslationKey;
}

export const costumeTextureAlias = (world: World, index: number) => `${world}/costume/${index}`;

export const COSTUMES: readonly Costume[] = WORLDS.flatMap((world) => {
  const heroine = HEROINE_BY_WORLD[world];
  return Array.from({ length: ECONOMY.costumesPerHeroine }, (_, index) => ({
    id: `${heroine}-${index}`,
    world,
    heroine,
    index,
    price: ECONOMY.costumePrices[index] ?? 0,
    texture: costumeTextureAlias(world, index),
    nameKey: `costume.${heroine}-${index}` as TranslationKey,
  }));
});

const byId = new Map(COSTUMES.map((c) => [c.id, c]));

export function getCostume(id: string): Costume | undefined {
  return byId.get(id);
}

export function costumesForWorld(world: World): Costume[] {
  return COSTUMES.filter((c) => c.world === world);
}

/** The free outfit every heroine starts with. */
export function defaultCostumeId(world: World): string {
  return `${HEROINE_BY_WORLD[world]}-0`;
}
