import { ECONOMY, type World } from '../../config';
import type { TranslationKey } from '../../i18n/en';

export interface Activity {
  /** `activity-${index}`; the same 8 activities exist in both worlds with different art. */
  id: string;
  index: number;
  nameKey: TranslationKey;
}

export const activityTextureAlias = (world: World, index: number) => `${world}/activity/${index}`;

export const ACTIVITIES: readonly Activity[] = Array.from(
  { length: ECONOMY.activitiesPerWorld },
  (_, index) => ({
    id: `activity-${index}`,
    index,
    nameKey: `activity.${index}` as TranslationKey,
  }),
);

export const ACTIVITY_IDS: readonly string[] = ACTIVITIES.map((a) => a.id);

export function getActivity(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}
