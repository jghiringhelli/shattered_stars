/**
 * DeterministicRng — Mulberry32 (the same generator as utils/random's
 * createSeededRng) whose internal state can be read and restored, so a
 * resync snapshot carries the RNG exactly where the authority left it.
 * Implements the game's RandomGenerator. Pure.
 */

import type { RandomGenerator } from "../../utils/random";

/** 2^32, to map a 32-bit word to [0, 1). */
const UINT32_RANGE = 4294967296;

export class DeterministicRng implements RandomGenerator {
  private state: number;

  /** @param seed - 32-bit seed (same stream as createSeededRng(seed)). */
  constructor(private readonly seed: number) {
    this.state = seed >>> 0;
  }

  /** @returns A float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  }

  /** @param min - Inclusive lower bound. @param max - Inclusive upper bound. @returns An integer. */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** @param array - Choices. @returns One of them, or undefined when empty. */
  pick<T>(array: readonly T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[Math.floor(this.next() * array.length)];
  }

  /** @param array - Shuffled in place. @returns The same array. */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j]!, array[i]!];
    }
    return array;
  }

  /** @param probability - 0–1. @returns Whether the roll succeeded. */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** @returns The seed it started from. */
  getSeed(): number {
    return this.seed;
  }

  /** @returns The internal state (for snapshots). */
  getState(): number {
    return this.state | 0;
  }

  /** @param state - A state from getState(). */
  setState(state: number): void {
    this.state = state | 0;
  }
}
