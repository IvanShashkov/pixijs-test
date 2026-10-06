import { describe, expect, it } from 'vitest';
import { en, type TranslationKey } from './en';
import { getLocale, onLocaleChange, setLocale, t, tIn, translationKeys } from './index';
import { ru } from './ru';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  it('ru has exactly the en keys', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
  });

  it('has no empty strings', () => {
    for (const k of translationKeys) {
      expect(en[k].trim().length, k).toBeGreaterThan(0);
      expect(ru[k].trim().length, k).toBeGreaterThan(0);
    }
  });

  it('uses identical placeholders per key', () => {
    for (const k of translationKeys) expect(placeholders(ru[k]), k).toEqual(placeholders(en[k]));
  });

  it('covers all activities and costumes', () => {
    for (let i = 0; i < 8; i++) expect(en[`activity.${i}` as TranslationKey]).toBeTruthy();
    for (const h of ['kama', 'lisa']) {
      for (let i = 0; i < 4; i++) expect(en[`costume.${h}-${i}` as TranslationKey]).toBeTruthy();
    }
  });
});

describe('t()', () => {
  it('substitutes params and leaves unknown placeholders', () => {
    setLocale('en');
    expect(t('hud.combo', { n: 3 })).toBe('Combo ×3');
    expect(t('results.lootCount', { loot: 'Chests' })).toBe('Chests: {n}');
  });

  it('switches locale and notifies listeners', () => {
    setLocale('en');
    const seen: string[] = [];
    const off = onLocaleChange((l) => seen.push(l));
    setLocale('ru');
    setLocale('ru');
    expect(seen).toEqual(['ru']);
    expect(getLocale()).toBe('ru');
    expect(t('menu.play')).toBe('Играть');
    off();
    setLocale('en');
    expect(seen).toEqual(['ru']);
  });

  it('tIn translates without changing the current locale', () => {
    setLocale('en');
    expect(tIn('ru', 'menu.shop')).toBe('Магазин');
    expect(getLocale()).toBe('en');
    expect(t('menu.shop')).toBe('Shop');
  });
});
