import { EN_MESSAGES, type MessageCatalog, type MessageKey } from "./messages.en";

/** Locales the game ships. Add a code here together with its catalog in `CATALOGS`. */
export const SUPPORTED_LOCALES = ["en"] as const;

/** A shipped locale code (BCP 47 primary language subtag). */
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** The source language; every other locale falls back to it key by key. */
export const SOURCE_LOCALE: Locale = "en";

/** Placeholder names in a message literal: `"Saved {fileName}"` gives `"fileName"`. */
type PlaceholderNames<S extends string> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | PlaceholderNames<Rest>
  : never;

/** Values a message needs: nothing, or exactly its `{placeholders}`. */
export type MessageParams<K extends MessageKey> = [PlaceholderNames<(typeof EN_MESSAGES)[K]>] extends [never]
  ? []
  : [params: Readonly<Record<PlaceholderNames<(typeof EN_MESSAGES)[K]>, string | number>>];

/** Keys of messages without placeholders (safe to pass around as plain keys, e.g. in tables). */
export type PlainMessageKey = {
  [K in MessageKey]: [PlaceholderNames<(typeof EN_MESSAGES)[K]>] extends [never] ? K : never;
}[MessageKey];

/** Looks up and interpolates messages for one locale. */
export interface Translator {
  readonly locale: Locale;
  /** @returns The message in the locale (or English), with `{name}` placeholders filled in. */
  t<K extends MessageKey>(key: K, ...params: MessageParams<K>): string;
}

/** Translations by locale; a missing locale or key falls back to English. */
export type Catalogs = Readonly<Partial<Record<Locale, Partial<MessageCatalog>>>>;

/** Every catalog the game ships (English is the source and always complete). */
export const CATALOGS: Catalogs = { en: EN_MESSAGES };

/**
 * Fills `{name}` placeholders; an unknown placeholder is left as written so the gap is visible.
 *
 * @param template - Message text.
 * @param params - Values by placeholder name.
 * @returns The interpolated text.
 */
export function interpolate(template: string, params: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

/**
 * @param locale - Active locale.
 * @param catalogs - Available translations.
 * @returns A translator for that locale.
 */
export function createTranslator(locale: Locale, catalogs: Catalogs = CATALOGS): Translator {
  const localized: Partial<MessageCatalog> = catalogs[locale] ?? {};
  return {
    locale,
    t: (key, ...params) => {
      const template = localized[key] ?? EN_MESSAGES[key];
      const values = (params[0] ?? {}) as Readonly<Record<string, string | number>>;
      return interpolate(template, values);
    },
  };
}

/**
 * Picks the first supported locale among the candidates (exact code, then primary subtag).
 *
 * @param candidates - In priority order: explicit choice (`?lang=`, setting), then browser languages.
 * @param supported - Locales the game ships.
 * @returns A supported locale; the source locale when nothing matches.
 */
export function resolveLocale(
  candidates: ReadonlyArray<string | null | undefined>,
  supported: readonly Locale[] = SUPPORTED_LOCALES,
): Locale {
  for (const candidate of candidates) {
    const primary = candidate?.trim().toLowerCase().split(/[-_]/)[0];
    const match = supported.find((locale) => locale === primary);
    if (match) return match;
  }
  return SOURCE_LOCALE;
}
