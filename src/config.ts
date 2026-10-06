/**
 * Every tunable in one place. Scenes, systems and the store import from here;
 * nothing else should carry magic numbers.
 */

export type World = 'wow' | 'horizon';
export type Locale = 'en' | 'ru';
export type HeroineKey = 'kama' | 'lisa';

export const WORLDS = ['horizon', 'wow'] as const satisfies readonly World[];
export const LOCALES = ['en', 'ru'] as const satisfies readonly Locale[];
export const HEROINE_BY_WORLD: Record<World, HeroineKey> = { horizon: 'kama', wow: 'lisa' };

export const DEFAULT_LOCALE: Locale = 'en';
export const DEFAULT_WORLD: World = 'horizon';

/** Board geometry and rules. */
export const BOARD = {
  rows: 8,
  cols: 8,
  gemCount: 6,
  /** `createBoard` needs at least 4 gem kinds to avoid initial matches reliably. */
  minGemCount: 4,
  minMatch: 3,
  /** Attempts before `reshuffle` gives up permuting and generates a fresh board. */
  reshuffleAttempts: 50,
} as const;

/** Scoring: per cleared tile, bonuses for long matches, cascade multiplier. */
export const SCORING = {
  baseTile: 10,
  bonus4: 20,
  bonus5: 60,
  /** multiplier = min(comboMax, 1 + comboStep × cascadeIndex); cascadeIndex 0 = the player's swap. */
  comboStep: 1,
  comboMax: 5,
} as const;

/** Animation timings in milliseconds. */
export const TIMING = {
  swapMs: 160,
  clearMs: 220,
  fallMsPerCell: 80,
  fallMsMin: 120,
  fallMsMax: 420,
  stepGapMs: 40,
  /** Drag distance (in cells) before a pressed tile swaps toward the drag direction. */
  dragThresholdCells: 0.25,
  selectPulseMs: 900,
  comboPopupMs: 800,
  reshuffleMs: 500,
  sceneFadeMs: 260,
  whirlMs: 600,
  whirlFlipMs: 110,
  idleBobMs: 2200,
  countUpMs: 900,
  toastMs: 1800,
  lootShakeMs: 320,
  /** Button hover sheen sweep and the primary-button glow pulse. */
  sheenMs: 650,
  pulseMs: 1300,
  /** Scene entrance choreography. */
  entrance: { durationMs: 420, staggerMs: 55, distance: 36 },
  /** Board intro cascade, idle move hint and invalid-swap shake. */
  boardIntroStaggerMs: 28,
  hintIdleMs: 5000,
  shakeMs: 60,
  /** Case-opening roulette. */
  roulette: {
    cells: 48,
    winnerIndex: 40,
    spinMs: 3400,
    fastSpinMs: 1500,
    settleMs: 260,
    holdMs: 1100,
  },
  chestBobMs: 2400,
  chestSparkleMs: 2600,
  celebration: {
    runMs: 2400,
    bobMs: 340,
    hugPopMs: 250,
    hugToHeartMs: 350,
    heartMs: 1700,
    holdMs: 1100,
  },
} as const;

/** Settings ranges used by the Settings scene steppers/sliders and by store validation. */
export const SETTINGS_LIMITS = {
  roundSeconds: { min: 30, max: 180, step: 15 },
  scoreCoefficient: { min: 0.5, max: 3, step: 0.1 },
  lootPerPoints: { min: 100, max: 2000, step: 100 },
  lootCap: { min: 1, max: 10, step: 1 },
  lootWeight: { min: 0, max: 100, step: 5 },
  lootBonusPoints: { min: 50, max: 500, step: 50 },
} as const;

export interface LootWeights {
  bonus: number;
  nothing: number;
  activity: number;
}

export interface Settings {
  roundSeconds: number;
  scoreCoefficient: number;
  lootPerPoints: number;
  lootCap: number;
  lootWeights: LootWeights;
  lootBonusPoints: number;
}

export const DEFAULT_SETTINGS: Settings = {
  roundSeconds: 60,
  scoreCoefficient: 1,
  lootPerPoints: 500,
  lootCap: 5,
  lootWeights: { bonus: 40, nothing: 35, activity: 25 },
  lootBonusPoints: 150,
};

export const ECONOMY = {
  startingPoints: 0,
  /** Price by costume index; index 0 is the free default outfit. */
  costumePrices: [0, 600, 900, 1400],
  costumesPerHeroine: 4,
  activitiesPerWorld: 8,
} as const;

/** Layout constants (CSS pixels at the reference 800 px viewport height; scaled by scenes). */
export const LAYOUT = {
  referenceHeight: 800,
  heroineHeight: 340,
  platformFeetOffset: 0.55,
  margin: 16,
  topBarHeight: 56,
  hudHeight: 64,
  tileMin: 28,
  tileMax: 84,
  boardPadding: 10,
  groundStripHeight: 84,
  celebrationRunnerHeight: 112,
  celebrationHugHeight: 128,
  celebrationHeartHeight: 40,
} as const;

export const STORAGE_KEY = 'wow-horizon-save';
export const SAVE_VERSION = 1;
