import {
  createTranslator,
  resolveLocale,
  SOURCE_LOCALE,
  type Locale,
  type MessageParams,
  type Translator,
} from "./translator";
import type { MessageKey } from "./messages.en";

export { EN_MESSAGES, type MessageCatalog, type MessageKey } from "./messages.en";
export { SUPPORTED_LOCALES, type Locale, type PlainMessageKey, type Translator } from "./translator";

/**
 * The active translator. This is the one deliberate module-level state of the layer (like
 * `browserStore()`): UI code calls `t()` everywhere and must not thread a translator through
 * every constructor. Tests swap it with `setLocale` / `resetLocale`.
 */
let active: Translator = createTranslator(SOURCE_LOCALE);

/**
 * Translates a message of the active locale.
 *
 * @param key - Catalog key (typed: a typo does not compile).
 * @param params - Exactly the `{placeholders}` of the message, when it has any.
 * @returns The player-facing text.
 */
export function t<K extends MessageKey>(key: K, ...params: MessageParams<K>): string {
  return active.t(key, ...params);
}

/**
 * @param locale - Locale to activate.
 */
export function setLocale(locale: Locale): void {
  active = createTranslator(locale);
}

/** @returns The active locale. */
export function getLocale(): Locale {
  return active.locale;
}

/** Back to the source locale (tests). */
export function resetLocale(): void {
  active = createTranslator(SOURCE_LOCALE);
}

/** The slice of `window` the locale detection reads. */
export interface LocaleEnvironment {
  readonly navigator: { readonly languages?: readonly string[]; readonly language?: string };
  readonly location: { readonly search: string };
  readonly document: { readonly documentElement: { lang: string } };
}

/**
 * Chooses the locale once at boot: `?lang=xx` (testing), then the browser languages. Sets
 * `<html lang>` for screen readers and spell checkers.
 *
 * @param env - The window (injectable).
 * @returns The chosen locale.
 */
export function initLocale(env: LocaleEnvironment): Locale {
  const requested = new URLSearchParams(env.location.search).get("lang");
  const browser = env.navigator.languages ?? [env.navigator.language];
  const locale = resolveLocale([requested, ...browser]);
  setLocale(locale);
  env.document.documentElement.lang = locale;
  return locale;
}
