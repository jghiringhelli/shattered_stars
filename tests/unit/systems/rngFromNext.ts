import type { RandomGenerator } from "../../../src/utils/random";

/**
 * Builds a full RandomGenerator test double whose every method derives from `next`.
 * @param next - Source of floats in [0, 1) (e.g. a scripted sequence)
 * @returns A RandomGenerator driven entirely by `next`
 */
export function rngFromNext(next: () => number): RandomGenerator {
  return {
    next,
    nextInt: (min: number, max: number): number =>
      Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(array: readonly T[]): T | undefined =>
      array.length === 0 ? undefined : array[Math.floor(next() * array.length)],
    shuffle: <T>(array: T[]): T[] => array,
    chance: (probability: number): boolean => next() < probability,
    getSeed: (): number => 0,
  };
}
