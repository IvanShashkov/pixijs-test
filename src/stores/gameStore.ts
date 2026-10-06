import { create, type Mutate, type StoreApi, type UseBoundStore } from 'zustand';
import {
  createJSONStorage,
  persist,
  subscribeWithSelector,
  type StateStorage,
} from 'zustand/middleware';
import {
  DEFAULT_LOCALE,
  DEFAULT_SETTINGS,
  DEFAULT_WORLD,
  ECONOMY,
  LOCALES,
  SAVE_VERSION,
  SETTINGS_LIMITS,
  STORAGE_KEY,
  WORLDS,
  type Locale,
  type LootWeights,
  type Settings,
  type World,
} from '../config';
import { ACTIVITY_IDS } from '../game/data/activities';
import { defaultCostumeId, getCostume } from '../game/data/costumes';

/**
 * The single source of truth for everything that outlives a scene: world, language, settings,
 * wallet, owned/equipped costumes and the activity collection. Persisted to localStorage.
 *
 * Pixi code reads it with `gameStore.getState()` and `gameStore.subscribe(selector, cb)`.
 * React never reads it (React is only the canvas mount shell).
 */
export interface GameData {
  world: World;
  locale: Locale;
  settings: Settings;
  wallet: { points: number };
  ownedCostumes: string[];
  equipped: Record<World, string | null>;
  collection: Record<World, string[]>;
}

export interface GameActions {
  setWorld: (world: World) => void;
  setLocale: (locale: Locale) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  addPoints: (delta: number) => void;
  /** Returns false (and changes nothing) when the wallet cannot cover `amount`. */
  spendPoints: (amount: number) => boolean;
  /** Buys a costume by id; false if unknown, already owned or unaffordable. */
  buyCostume: (id: string) => boolean;
  /** Equips an owned costume on its heroine; false if not owned. */
  equipCostume: (id: string) => boolean;
  unequipCostume: (world: World) => void;
  /** Adds an activity to a world's collection; false if unknown or already unlocked. */
  unlockActivity: (world: World, id: string) => boolean;
  resetProgress: () => void;
}

export type GameState = GameData & GameActions;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const snapTo = (value: number, { min, max, step }: { min: number; max: number; step: number }) => {
  const snapped = Math.round((value - min) / step) * step + min;
  // Avoid 0.1 + 0.2 style noise for fractional steps.
  const decimals = step < 1 ? (String(step).split('.')[1]?.length ?? 1) : 0;
  return Number(clamp(snapped, min, max).toFixed(decimals));
};

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Clamp every settings field to its configured range; invalid values fall back to the current ones. */
export function sanitizeSettings(current: Settings, patch: Partial<Settings>): Settings {
  const next: Settings = { ...current, lootWeights: { ...current.lootWeights } };
  if (isFiniteNumber(patch.roundSeconds))
    next.roundSeconds = snapTo(patch.roundSeconds, SETTINGS_LIMITS.roundSeconds);
  if (isFiniteNumber(patch.scoreCoefficient))
    next.scoreCoefficient = snapTo(patch.scoreCoefficient, SETTINGS_LIMITS.scoreCoefficient);
  if (isFiniteNumber(patch.lootPerPoints))
    next.lootPerPoints = snapTo(patch.lootPerPoints, SETTINGS_LIMITS.lootPerPoints);
  if (isFiniteNumber(patch.lootCap)) next.lootCap = snapTo(patch.lootCap, SETTINGS_LIMITS.lootCap);
  if (isFiniteNumber(patch.lootBonusPoints))
    next.lootBonusPoints = snapTo(patch.lootBonusPoints, SETTINGS_LIMITS.lootBonusPoints);
  if (patch.lootWeights) {
    for (const key of Object.keys(next.lootWeights) as (keyof LootWeights)[]) {
      const v = patch.lootWeights[key];
      if (isFiniteNumber(v)) next.lootWeights[key] = snapTo(v, SETTINGS_LIMITS.lootWeight);
    }
    // At least one outcome must be possible.
    const { bonus, nothing, activity } = next.lootWeights;
    if (bonus + nothing + activity === 0) next.lootWeights = { ...DEFAULT_SETTINGS.lootWeights };
  }
  return next;
}

export function initialGameData(): GameData {
  return {
    world: DEFAULT_WORLD,
    locale: DEFAULT_LOCALE,
    settings: { ...DEFAULT_SETTINGS, lootWeights: { ...DEFAULT_SETTINGS.lootWeights } },
    wallet: { points: ECONOMY.startingPoints },
    ownedCostumes: WORLDS.map(defaultCostumeId),
    equipped: { horizon: defaultCostumeId('horizon'), wow: defaultCostumeId('wow') },
    collection: { horizon: [], wow: [] },
  };
}

/**
 * Migrates a persisted blob from `version` to the current schema. Unknown or older shapes are
 * merged over fresh defaults field by field, so adding a field only needs a default here.
 */
export function migrateSave(persisted: unknown, version: number): GameData {
  const base = initialGameData();
  if (!persisted || typeof persisted !== 'object') return base;
  const raw = persisted as Partial<GameData>;
  // version 0 → 1: nothing to transform yet; keep this switch as the place for future steps.
  void version;
  const world = WORLDS.includes(raw.world as World) ? (raw.world as World) : base.world;
  const locale = LOCALES.includes(raw.locale as Locale) ? (raw.locale as Locale) : base.locale;
  const owned = Array.isArray(raw.ownedCostumes)
    ? raw.ownedCostumes.filter((id): id is string => typeof id === 'string' && !!getCostume(id))
    : [];
  const ownedSet = new Set([...base.ownedCostumes, ...owned]);
  const equipped = { ...base.equipped };
  for (const w of WORLDS) {
    const id = raw.equipped?.[w];
    const valid = typeof id === 'string' && ownedSet.has(id) && getCostume(id)?.world === w;
    equipped[w] = id === null ? null : valid ? id : base.equipped[w];
  }
  const collection = { ...base.collection };
  for (const w of WORLDS) {
    const ids = raw.collection?.[w];
    collection[w] = Array.isArray(ids)
      ? [...new Set(ids.filter((id): id is string => ACTIVITY_IDS.includes(id as string)))]
      : [];
  }
  return {
    world,
    locale,
    settings: sanitizeSettings(base.settings, raw.settings ?? {}),
    wallet: {
      points: isFiniteNumber(raw.wallet?.points) ? Math.max(0, Math.floor(raw.wallet.points)) : 0,
    },
    ownedCostumes: [...ownedSet],
    equipped,
    collection,
  };
}

export interface CreateGameStoreOptions {
  /** Storage backend; defaults to localStorage. Pass an in-memory one in tests. */
  storage?: StateStorage;
  /** Skip persistence entirely (unit tests of pure transitions). */
  persist?: boolean;
}

export type GameStore = UseBoundStore<
  Mutate<StoreApi<GameState>, [['zustand/subscribeWithSelector', never]]>
>;

const actions = (
  set: (fn: (state: GameState) => Partial<GameState>) => void,
  get: () => GameState,
): GameActions => ({
  setWorld: (world) => {
    if (WORLDS.includes(world)) set(() => ({ world }));
  },
  setLocale: (locale) => {
    if (LOCALES.includes(locale)) set(() => ({ locale }));
  },
  updateSettings: (patch) => set((s) => ({ settings: sanitizeSettings(s.settings, patch) })),
  addPoints: (delta) => {
    if (!isFiniteNumber(delta) || delta <= 0) return;
    set((s) => ({ wallet: { points: s.wallet.points + Math.floor(delta) } }));
  },
  spendPoints: (amount) => {
    if (!isFiniteNumber(amount) || amount < 0 || get().wallet.points < amount) return false;
    set((s) => ({ wallet: { points: s.wallet.points - Math.floor(amount) } }));
    return true;
  },
  buyCostume: (id) => {
    const costume = getCostume(id);
    const state = get();
    if (!costume || state.ownedCostumes.includes(id)) return false;
    if (state.wallet.points < costume.price) return false;
    set((s) => ({
      wallet: { points: s.wallet.points - costume.price },
      ownedCostumes: [...s.ownedCostumes, id],
    }));
    return true;
  },
  equipCostume: (id) => {
    const costume = getCostume(id);
    if (!costume || !get().ownedCostumes.includes(id)) return false;
    set((s) => ({ equipped: { ...s.equipped, [costume.world]: id } }));
    return true;
  },
  unequipCostume: (world) => set((s) => ({ equipped: { ...s.equipped, [world]: null } })),
  unlockActivity: (world, id) => {
    if (!ACTIVITY_IDS.includes(id) || get().collection[world].includes(id)) return false;
    set((s) => ({ collection: { ...s.collection, [world]: [...s.collection[world], id] } }));
    return true;
  },
  resetProgress: () =>
    set((s) => {
      const fresh = initialGameData();
      // Keep the player's language and world; wipe progress and settings.
      return { ...fresh, world: s.world, locale: s.locale };
    }),
});

export function createGameStore(options: CreateGameStoreOptions = {}): GameStore {
  const initializer = subscribeWithSelector<GameState>((set, get) => ({
    ...initialGameData(),
    ...actions(set, get),
  }));
  if (options.persist === false) return create<GameState>()(initializer);
  return create<GameState>()(
    // prettier-ignore

    persist(initializer, {
      name: STORAGE_KEY,
      version: SAVE_VERSION,
      storage: createJSONStorage(() => options.storage ?? localStorage),
      partialize: (state): GameData => ({
        world: state.world,
        locale: state.locale,
        settings: state.settings,
        wallet: state.wallet,
        ownedCostumes: state.ownedCostumes,
        equipped: state.equipped,
        collection: state.collection,
      }),
      migrate: (persisted, version) => migrateSave(persisted, version) as unknown as GameState,
      merge: (persisted, current) => ({
        ...current,
        ...migrateSave(persisted, SAVE_VERSION),
      }),
    }),
  );
}

/** The app-wide store. Imperative name: this is read from Pixi code, never as a React hook. */
export const gameStore: GameStore = createGameStore();
