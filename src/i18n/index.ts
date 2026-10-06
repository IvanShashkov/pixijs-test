import { DEFAULT_LOCALE, type Locale } from '../config';
import { en, type TranslationKey } from './en';
import { ru } from './ru';

export type { TranslationKey } from './en';

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, ru };

type Params = Record<string, string | number>;
type Listener = (locale: Locale) => void;

let current: Locale = DEFAULT_LOCALE;
const listeners = new Set<Listener>();

/** Current locale. The store is the source of truth; `bootGame` mirrors it here. */
export function getLocale(): Locale {
  return current;
}

/** Switch locale and notify every registered listener (LocalizedText nodes, scenes). */
export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  for (const listener of listeners) listener(locale);
}

/** Subscribe to locale changes. Returns an unsubscribe function. */
export function onLocaleChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Translate `key` in the current locale, substituting `{param}` placeholders. */
export function t(key: TranslationKey, params?: Params): string {
  const template = dictionaries[current][key] ?? dictionaries.en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Translate in an explicit locale (tests, previews). */
export function tIn(locale: Locale, key: TranslationKey, params?: Params): string {
  const previous = current;
  current = locale;
  try {
    return t(key, params);
  } finally {
    current = previous;
  }
}

export const translationKeys = Object.keys(en) as TranslationKey[];
