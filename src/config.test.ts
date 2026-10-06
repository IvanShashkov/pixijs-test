import { describe, expect, it } from 'vitest';
import { BOARD, DEFAULT_SETTINGS, ECONOMY, SETTINGS_LIMITS } from './config';
import { getTheme } from './game/theme';

describe('config invariants', () => {
  it('board has enough gem kinds and size', () => {
    expect(BOARD.gemCount).toBeGreaterThanOrEqual(BOARD.minGemCount);
    expect(BOARD.rows).toBeGreaterThanOrEqual(3);
    expect(BOARD.cols).toBeGreaterThanOrEqual(3);
  });

  it('default loot weights are pickable and in range', () => {
    const w = DEFAULT_SETTINGS.lootWeights;
    expect(w.bonus + w.nothing + w.activity).toBeGreaterThan(0);
    for (const v of Object.values(w)) {
      expect(v).toBeGreaterThanOrEqual(SETTINGS_LIMITS.lootWeight.min);
      expect(v).toBeLessThanOrEqual(SETTINGS_LIMITS.lootWeight.max);
    }
  });

  it('defaults sit inside their limits', () => {
    expect(DEFAULT_SETTINGS.roundSeconds).toBeGreaterThanOrEqual(SETTINGS_LIMITS.roundSeconds.min);
    expect(DEFAULT_SETTINGS.roundSeconds).toBeLessThanOrEqual(SETTINGS_LIMITS.roundSeconds.max);
    expect(DEFAULT_SETTINGS.lootCap).toBeLessThanOrEqual(SETTINGS_LIMITS.lootCap.max);
  });

  it('costume prices match the catalog size and the first is free', () => {
    expect(ECONOMY.costumePrices).toHaveLength(ECONOMY.costumesPerHeroine);
    expect(ECONOMY.costumePrices[0]).toBe(0);
  });

  it('themes expose one gem alias and colour per gem kind', () => {
    for (const world of ['wow', 'horizon'] as const) {
      const theme = getTheme(world);
      expect(theme.assets.gems).toHaveLength(BOARD.gemCount);
      expect(theme.colors.gems).toHaveLength(BOARD.gemCount);
      expect(new Set(theme.colors.gems).size).toBe(BOARD.gemCount);
    }
  });
});
