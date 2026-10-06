import type { StateStorage } from 'zustand/middleware';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_LIMITS } from '../config';
import { createGameStore, initialGameData, migrateSave, sanitizeSettings } from './gameStore';

const memoryStorage = (): StateStorage & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
};

const pure = () => createGameStore({ persist: false });

describe('sanitizeSettings', () => {
  it('clamps and snaps to range', () => {
    const s = sanitizeSettings(DEFAULT_SETTINGS, {
      roundSeconds: 10,
      lootPerPoints: 99999,
      lootCap: 3.7,
    });
    expect(s.roundSeconds).toBe(SETTINGS_LIMITS.roundSeconds.min);
    expect(s.lootPerPoints).toBe(SETTINGS_LIMITS.lootPerPoints.max);
    expect(s.lootCap).toBe(4);
  });

  it('snaps the fractional coefficient step without float noise', () => {
    expect(sanitizeSettings(DEFAULT_SETTINGS, { scoreCoefficient: 1.26 }).scoreCoefficient).toBe(
      1.3,
    );
    expect(sanitizeSettings(DEFAULT_SETTINGS, { scoreCoefficient: 0.1 }).scoreCoefficient).toBe(
      0.5,
    );
    expect(sanitizeSettings(DEFAULT_SETTINGS, { scoreCoefficient: 7 }).scoreCoefficient).toBe(3);
  });

  it('ignores invalid values', () => {
    const s = sanitizeSettings(DEFAULT_SETTINGS, {
      roundSeconds: Number.NaN,
      scoreCoefficient: undefined,
    });
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it('clamps weights and restores defaults when all are zero', () => {
    const s = sanitizeSettings(DEFAULT_SETTINGS, {
      lootWeights: { bonus: 200, nothing: -5, activity: 12 },
    });
    expect(s.lootWeights).toEqual({ bonus: 100, nothing: 0, activity: 10 });
    const z = sanitizeSettings(DEFAULT_SETTINGS, {
      lootWeights: { bonus: 0, nothing: 0, activity: 0 },
    });
    expect(z.lootWeights).toEqual(DEFAULT_SETTINGS.lootWeights);
  });

  it('does not mutate the input', () => {
    const base = { ...DEFAULT_SETTINGS, lootWeights: { ...DEFAULT_SETTINGS.lootWeights } };
    sanitizeSettings(base, { lootWeights: { bonus: 5 } as never, roundSeconds: 90 });
    expect(base).toEqual(DEFAULT_SETTINGS);
  });
});

describe('wallet actions', () => {
  it('addPoints ignores negative and NaN', () => {
    const s = pure();
    s.getState().addPoints(-5);
    s.getState().addPoints(Number.NaN);
    expect(s.getState().wallet.points).toBe(0);
    s.getState().addPoints(10.9);
    expect(s.getState().wallet.points).toBe(10);
  });

  it('spendPoints refuses overdraft', () => {
    const s = pure();
    s.getState().addPoints(100);
    expect(s.getState().spendPoints(150)).toBe(false);
    expect(s.getState().wallet.points).toBe(100);
    expect(s.getState().spendPoints(100)).toBe(true);
    expect(s.getState().wallet.points).toBe(0);
    expect(s.getState().spendPoints(-1)).toBe(false);
  });
});

describe('costume actions', () => {
  it('starts with the default costumes owned and equipped', () => {
    const s = pure().getState();
    expect(s.ownedCostumes).toEqual(['kama-0', 'lisa-0']);
    expect(s.equipped).toEqual({ horizon: 'kama-0', wow: 'lisa-0' });
  });

  it('buyCostume requires funds and refuses re-buys/unknown ids', () => {
    const s = pure();
    expect(s.getState().buyCostume('kama-1')).toBe(false);
    s.getState().addPoints(600);
    expect(s.getState().buyCostume('nope')).toBe(false);
    expect(s.getState().buyCostume('kama-1')).toBe(true);
    expect(s.getState().wallet.points).toBe(0);
    expect(s.getState().ownedCostumes).toContain('kama-1');
    s.getState().addPoints(600);
    expect(s.getState().buyCostume('kama-1')).toBe(false);
    expect(s.getState().wallet.points).toBe(600);
  });

  it('equip requires ownership and is per world', () => {
    const s = pure();
    expect(s.getState().equipCostume('lisa-2')).toBe(false);
    s.getState().addPoints(5000);
    s.getState().buyCostume('lisa-2');
    expect(s.getState().equipCostume('lisa-2')).toBe(true);
    expect(s.getState().equipped.wow).toBe('lisa-2');
    expect(s.getState().equipped.horizon).toBe('kama-0');
    s.getState().unequipCostume('wow');
    expect(s.getState().equipped.wow).toBeNull();
  });
});

describe('collection and reset', () => {
  it('unlockActivity is idempotent and per world', () => {
    const s = pure();
    expect(s.getState().unlockActivity('wow', 'activity-3')).toBe(true);
    expect(s.getState().unlockActivity('wow', 'activity-3')).toBe(false);
    expect(s.getState().unlockActivity('wow', 'bogus')).toBe(false);
    expect(s.getState().collection.wow).toEqual(['activity-3']);
    expect(s.getState().collection.horizon).toEqual([]);
  });

  it('resetProgress keeps world and locale', () => {
    const s = pure();
    s.getState().setWorld('wow');
    s.getState().setLocale('ru');
    s.getState().addPoints(999);
    s.getState().unlockActivity('horizon', 'activity-1');
    s.getState().updateSettings({ roundSeconds: 120 });
    s.getState().resetProgress();
    const st = s.getState();
    expect(st.world).toBe('wow');
    expect(st.locale).toBe('ru');
    expect(st.wallet.points).toBe(0);
    expect(st.collection.horizon).toEqual([]);
    expect(st.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('rejects unknown worlds/locales', () => {
    const s = pure();
    s.getState().setWorld('mars' as never);
    s.getState().setLocale('de' as never);
    expect(s.getState().world).toBe('horizon');
    expect(s.getState().locale).toBe('en');
  });
});

describe('migrateSave', () => {
  it('returns defaults for garbage', () => {
    expect(migrateSave(null, 0)).toEqual(initialGameData());
    expect(migrateSave('junk', 0)).toEqual(initialGameData());
  });

  it('merges partial/invalid data over defaults', () => {
    const out = migrateSave(
      {
        world: 'wow',
        locale: 'xx',
        wallet: { points: 12.7 },
        ownedCostumes: ['lisa-3', 'ghost'],
        equipped: { wow: 'lisa-3', horizon: 'lisa-3' },
        collection: { wow: ['activity-1', 'activity-1', 'zzz'] },
        settings: { roundSeconds: 999 },
      },
      0,
    );
    expect(out.world).toBe('wow');
    expect(out.locale).toBe('en');
    expect(out.wallet.points).toBe(12);
    expect(out.ownedCostumes.sort()).toEqual(['kama-0', 'lisa-0', 'lisa-3']);
    expect(out.equipped).toEqual({ wow: 'lisa-3', horizon: 'kama-0' });
    expect(out.collection).toEqual({ wow: ['activity-1'], horizon: [] });
    expect(out.settings.roundSeconds).toBe(SETTINGS_LIMITS.roundSeconds.max);
  });

  it('respects an explicit null equip', () => {
    expect(migrateSave({ equipped: { wow: null } }, 1).equipped.wow).toBeNull();
  });
});

describe('persistence', () => {
  it('writes only data fields and hydrates from storage', () => {
    const storage = memoryStorage();
    const a = createGameStore({ storage });
    a.getState().addPoints(321);
    a.getState().setLocale('ru');
    const raw = JSON.parse([...storage.map.values()][0]!) as { state: Record<string, unknown> };
    expect(Object.keys(raw.state).sort()).toEqual(
      ['collection', 'equipped', 'locale', 'ownedCostumes', 'settings', 'wallet', 'world'].sort(),
    );
    const b = createGameStore({ storage });
    expect(b.getState().wallet.points).toBe(321);
    expect(b.getState().locale).toBe('ru');
    expect(typeof b.getState().addPoints).toBe('function');
  });

  it('sanitises a tampered save on hydration', () => {
    const storage = memoryStorage();
    storage.setItem(
      'wow-horizon-save',
      JSON.stringify({
        state: { wallet: { points: -50 }, settings: { lootCap: 500 } },
        version: 1,
      }),
    );
    const s = createGameStore({ storage });
    expect(s.getState().wallet.points).toBe(0);
    expect(s.getState().settings.lootCap).toBe(SETTINGS_LIMITS.lootCap.max);
  });
});
