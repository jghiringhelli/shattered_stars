/**
 * Which map a battle asks for — pure: seed and theme from the data a scene
 * was started with.
 */

import { type MapTheme, resolveMapTheme } from "./mapThemes";

const SEED_RANGE = 2 ** 32;

/** The look a battle asks for. */
export interface MapRequest {
  readonly seed: number;
  readonly theme: MapTheme;
}

interface MapSource {
  readonly online?: unknown;
  readonly seed?: unknown;
  readonly mapTheme?: unknown;
  /** Offline fixed seed (e.g. a Survival sector). */
  readonly mapSeed?: unknown;
}

/**
 * Decide seed and theme from the sources a scene was started with (scene
 * start data, `battleConfig`). Online battles take the shared match seed and
 * ignore any local theme choice, so both clients show the same map.
 *
 * @param sources - Candidate objects (anything; non-objects are skipped).
 * @param random - Source of randomness for offline battles (0 ≤ r < 1).
 * @returns Seed and theme.
 */
export function resolveMapRequest(
  sources: readonly unknown[],
  random: () => number,
): MapRequest {
  const objects = sources.filter(
    (source): source is MapSource =>
      typeof source === "object" && source !== null,
  );
  const online = objects.find(
    (source) => Boolean(source.online) && typeof source.seed === "number",
  );
  if (online) {
    const seed = online.seed as number;
    return { seed, theme: resolveMapTheme(undefined, seed) };
  }
  const choice = objects
    .map((source) => source.mapTheme)
    .find((value): value is string => typeof value === "string");
  const fixed = objects
    .map((source) => source.mapSeed)
    .find((value): value is number => typeof value === "number");
  const seed = fixed ?? Math.floor(random() * SEED_RANGE);
  return { seed, theme: resolveMapTheme(choice, seed) };
}
