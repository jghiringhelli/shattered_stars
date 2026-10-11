/**
 * Survival roguelite — deterministic run randomness (pure).
 *
 * A run has ONE seed. Every random decision (map layout, node contents,
 * drafts, shop stock, event gambles, wave rosters) draws from its own RNG
 * derived from the seed plus a stable purpose key, so resuming a saved
 * run replays exactly the same choices without storing RNG state.
 */

import { createSeededRng, type RandomGenerator } from "../../utils/random";

/** FNV-1a 32-bit offset basis and prime. */
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Seed codes are base-36, upper-case, at most this long (uint32 fits in 7). */
export const SEED_CODE_LENGTH = 7;

/** Base of seed codes. */
const SEED_RADIX = 36;

/**
 * @param seed - The run seed.
 * @param parts - Purpose key parts (e.g. "draft", nodeId, rerollIndex).
 * @returns A uint32 seed unique to that purpose.
 */
export function deriveSeed(
  seed: number,
  ...parts: readonly (string | number)[]
): number {
  const key = [seed >>> 0, ...parts].join("|");
  let hash = FNV_OFFSET;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * @param seed - The run seed.
 * @param parts - Purpose key parts.
 * @returns A fresh seeded RNG for that purpose.
 */
export function rngFor(
  seed: number,
  ...parts: readonly (string | number)[]
): RandomGenerator {
  return createSeededRng(deriveSeed(seed, ...parts));
}

/**
 * @param seed - A uint32 seed.
 * @returns Its shareable code, e.g. "1A2B3C".
 */
export function seedToCode(seed: number): string {
  return (seed >>> 0).toString(SEED_RADIX).toUpperCase();
}

/**
 * @param code - A typed seed code (case-insensitive, base-36).
 * @returns The seed, or null when the code is empty or invalid.
 */
export function codeToSeed(code: string): number | null {
  const clean = code.trim().toLowerCase();
  if (clean.length === 0 || clean.length > SEED_CODE_LENGTH) return null;
  if (!/^[0-9a-z]+$/.test(clean)) return null;
  const value = parseInt(clean, SEED_RADIX);
  if (!Number.isFinite(value) || value > 0xffffffff) return null;
  return value >>> 0;
}

/**
 * @param entropy - Any number (e.g. Date.now() mixed with Math.random()).
 * @returns A uint32 seed.
 */
export function seedFromEntropy(entropy: number): number {
  return deriveSeed(Math.floor(entropy) >>> 0, "entropy");
}
