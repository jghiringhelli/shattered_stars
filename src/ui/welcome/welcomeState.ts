/**
 * Welcome-screen state: whether the tester welcome was already shown. One
 * key in the (never-throwing) browser store; automated browsers skip the
 * auto-open so it never blocks a scripted run, unless `?welcome=1` asks.
 */

import { browserStore, type KeyValueStore } from "../../systems/keyValueStore";

/** Storage key of the "seen" flag. */
export const WELCOME_SEEN_KEY = "ss_beta_welcome_v1";
const SEEN_VALUE = "1";

/** What decides whether the welcome opens by itself. */
export interface WelcomeEnvironment {
  readonly store: KeyValueStore;
  /** True in Playwright/WebDriver. */
  readonly automated: boolean;
  /** The page's query string. */
  readonly search: string;
}

/** @returns The environment of the running page. */
export function pageWelcomeEnvironment(): WelcomeEnvironment {
  return {
    store: browserStore(),
    automated: typeof navigator !== "undefined" && navigator.webdriver === true,
    search: typeof window === "undefined" ? "" : window.location.search,
  };
}

/**
 * @param env - Store, automation flag and query string.
 * @returns True when the welcome should open on its own.
 */
export function shouldAutoOpenWelcome(env: WelcomeEnvironment): boolean {
  if (new URLSearchParams(env.search).get("welcome") === "1") return true;
  if (env.automated) return false;
  return env.store.getItem(WELCOME_SEEN_KEY) !== SEEN_VALUE;
}

/**
 * Remember that the welcome was shown.
 *
 * @param store - Where flags live.
 */
export function markWelcomeSeen(store: KeyValueStore = browserStore()): void {
  store.setItem(WELCOME_SEEN_KEY, SEEN_VALUE);
}
