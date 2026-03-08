/**
 * Seeded random number generator for deterministic testing
 * Uses Mulberry32 algorithm
 */

export interface RandomGenerator {
  /** Returns a random float between 0 (inclusive) and 1 (exclusive) */
  next(): number;

  /** Returns a random integer between min (inclusive) and max (inclusive) */
  nextInt(min: number, max: number): number;

  /** Returns a random element from an array */
  pick<T>(array: readonly T[]): T | undefined;

  /** Shuffles an array in place and returns it */
  shuffle<T>(array: T[]): T[];

  /** Returns true with the given probability (0-1) */
  chance(probability: number): boolean;

  /** Get current seed for reproduction */
  getSeed(): number;
}

/**
 * Create a seeded random generator (deterministic)
 */
export function createSeededRng(seed: number): RandomGenerator {
  let state = seed >>> 0; // Ensure unsigned 32-bit

  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,

    nextInt(min: number, max: number): number {
      return Math.floor(next() * (max - min + 1)) + min;
    },

    pick<T>(array: readonly T[]): T | undefined {
      if (array.length === 0) return undefined;
      return array[Math.floor(next() * array.length)];
    },

    shuffle<T>(array: T[]): T[] {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [array[i], array[j]] = [array[j]!, array[i]!];
      }
      return array;
    },

    chance(probability: number): boolean {
      return next() < probability;
    },

    getSeed(): number {
      return seed;
    },
  };
}

/**
 * Create a random generator using Math.random (non-deterministic)
 */
export function createRng(): RandomGenerator {
  const seed = Math.floor(Math.random() * 4294967296);

  return {
    next: Math.random,

    nextInt(min: number, max: number): number {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    pick<T>(array: readonly T[]): T | undefined {
      if (array.length === 0) return undefined;
      return array[Math.floor(Math.random() * array.length)];
    },

    shuffle<T>(array: T[]): T[] {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j]!, array[i]!];
      }
      return array;
    },

    chance(probability: number): boolean {
      return Math.random() < probability;
    },

    getSeed(): number {
      return seed;
    },
  };
}

// Default RNG instance (can be replaced for testing)
let defaultRng: RandomGenerator = createRng();

export function setDefaultRng(rng: RandomGenerator): void {
  defaultRng = rng;
}

export function getDefaultRng(): RandomGenerator {
  return defaultRng;
}

/**
 * Quick access to default RNG methods
 */
export const random = {
  next: () => defaultRng.next(),
  nextInt: (min: number, max: number) => defaultRng.nextInt(min, max),
  pick: <T>(array: readonly T[]) => defaultRng.pick(array),
  shuffle: <T>(array: T[]) => defaultRng.shuffle(array),
  chance: (probability: number) => defaultRng.chance(probability),
};
