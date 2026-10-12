/**
 * Random Number Generator Tests
 *
 * Tests for the seeded and non-seeded random number generators.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createSeededRng,
  createRng,
  setDefaultRng,
  getDefaultRng,
  random,
  type RandomGenerator,
} from "../../../src/utils/random";

describe("Random", () => {
  describe("createSeededRng", () => {
    it("should create a random generator with given seed", () => {
      const rng = createSeededRng(12345);
      expect(rng.getSeed()).toBe(12345);
    });

    it("should produce deterministic results with same seed", () => {
      const rng1 = createSeededRng(42);
      const rng2 = createSeededRng(42);

      const values1 = [rng1.next(), rng1.next(), rng1.next()];
      const values2 = [rng2.next(), rng2.next(), rng2.next()];

      expect(values1).toEqual(values2);
    });

    it("should produce different results with different seeds", () => {
      const rng1 = createSeededRng(1);
      const rng2 = createSeededRng(2);

      const value1 = rng1.next();
      const value2 = rng2.next();

      expect(value1).not.toBe(value2);
    });

    describe("next()", () => {
      it("should return values between 0 and 1", () => {
        const rng = createSeededRng(999);

        for (let i = 0; i < 100; i++) {
          const value = rng.next();
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(1);
        }
      });

      it("should produce varied distribution", () => {
        const rng = createSeededRng(123);
        const values = new Set<number>();

        for (let i = 0; i < 100; i++) {
          values.add(Math.floor(rng.next() * 10));
        }

        // Should hit most buckets 0-9
        expect(values.size).toBeGreaterThan(5);
      });
    });

    describe("nextInt()", () => {
      it("should return integers in range", () => {
        const rng = createSeededRng(456);

        for (let i = 0; i < 100; i++) {
          const value = rng.nextInt(5, 10);
          expect(value).toBeGreaterThanOrEqual(5);
          expect(value).toBeLessThanOrEqual(10);
          expect(Number.isInteger(value)).toBe(true);
        }
      });

      it("should return min when min equals max", () => {
        const rng = createSeededRng(789);
        const value = rng.nextInt(7, 7);
        expect(value).toBe(7);
      });

      it("should cover entire range", () => {
        const rng = createSeededRng(111);
        const values = new Set<number>();

        for (let i = 0; i < 1000; i++) {
          values.add(rng.nextInt(1, 6));
        }

        // Should hit all values 1-6 (like a die)
        expect(values.has(1)).toBe(true);
        expect(values.has(6)).toBe(true);
      });
    });

    describe("pick()", () => {
      it("should return element from array", () => {
        const rng = createSeededRng(222);
        const array = ["a", "b", "c", "d", "e"];

        for (let i = 0; i < 50; i++) {
          const picked = rng.pick(array);
          expect(array).toContain(picked);
        }
      });

      it("should return undefined for empty array", () => {
        const rng = createSeededRng(333);
        const picked = rng.pick([]);
        expect(picked).toBeUndefined();
      });

      it("should pick different elements over time", () => {
        const rng = createSeededRng(444);
        const array = [1, 2, 3, 4, 5];
        const picks = new Set<number>();

        for (let i = 0; i < 100; i++) {
          const picked = rng.pick(array);
          if (picked !== undefined) picks.add(picked);
        }

        // Should pick most elements
        expect(picks.size).toBeGreaterThan(3);
      });
    });

    describe("shuffle()", () => {
      it("should return array with same elements", () => {
        const rng = createSeededRng(555);
        const original = [1, 2, 3, 4, 5];
        const array = [...original];

        rng.shuffle(array);

        expect(array.sort()).toEqual(original.sort());
      });

      it("should shuffle in place", () => {
        const rng = createSeededRng(666);
        const array = [1, 2, 3, 4, 5];
        const result = rng.shuffle(array);

        expect(result).toBe(array);
      });

      it("should produce deterministic shuffle with same seed", () => {
        const rng1 = createSeededRng(777);
        const rng2 = createSeededRng(777);

        const array1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const array2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

        rng1.shuffle(array1);
        rng2.shuffle(array2);

        expect(array1).toEqual(array2);
      });

      it("should handle single element array", () => {
        const rng = createSeededRng(888);
        const array = [42];
        rng.shuffle(array);
        expect(array).toEqual([42]);
      });

      it("should handle empty array", () => {
        const rng = createSeededRng(999);
        const array: number[] = [];
        rng.shuffle(array);
        expect(array).toEqual([]);
      });
    });

    describe("chance()", () => {
      it("should return true for probability 1", () => {
        const rng = createSeededRng(1010);
        expect(rng.chance(1)).toBe(true);
      });

      it("should return false for probability 0", () => {
        const rng = createSeededRng(1111);
        expect(rng.chance(0)).toBe(false);
      });

      it("should respect probability distribution", () => {
        const rng = createSeededRng(1212);
        let trueCount = 0;
        const trials = 1000;

        for (let i = 0; i < trials; i++) {
          if (rng.chance(0.5)) trueCount++;
        }

        // Should be approximately 50%
        expect(trueCount).toBeGreaterThan(trials * 0.4);
        expect(trueCount).toBeLessThan(trials * 0.6);
      });
    });
  });

  describe("createRng", () => {
    it("should create a random generator", () => {
      const rng = createRng();
      expect(typeof rng.next()).toBe("number");
    });

    it("should have a seed", () => {
      const rng = createRng();
      expect(typeof rng.getSeed()).toBe("number");
    });

    it("should produce values between 0 and 1", () => {
      const rng = createRng();

      for (let i = 0; i < 10; i++) {
        const value = rng.next();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it("should have working nextInt", () => {
      const rng = createRng();

      for (let i = 0; i < 10; i++) {
        const value = rng.nextInt(1, 10);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    });

    it("should have working pick", () => {
      const rng = createRng();
      const array = ["x", "y", "z"];

      for (let i = 0; i < 10; i++) {
        const picked = rng.pick(array);
        expect(array).toContain(picked);
      }
    });

    it("should have working shuffle", () => {
      const rng = createRng();
      const array = [1, 2, 3];
      const original = [...array];

      rng.shuffle(array);

      expect(array.sort()).toEqual(original);
    });

    it("should have working chance", () => {
      const rng = createRng();
      expect(rng.chance(1)).toBe(true);
      expect(rng.chance(0)).toBe(false);
    });
  });

  describe("Default RNG", () => {
    let originalRng: RandomGenerator;

    beforeEach(() => {
      originalRng = getDefaultRng();
    });

    afterEach(() => {
      setDefaultRng(originalRng);
    });

    it("should get default RNG", () => {
      const rng = getDefaultRng();
      expect(rng).toBeDefined();
      expect(typeof rng.next).toBe("function");
    });

    it("should set default RNG", () => {
      const customRng = createSeededRng(99999);
      setDefaultRng(customRng);

      expect(getDefaultRng()).toBe(customRng);
    });
  });

  describe("random convenience object", () => {
    let originalRng: RandomGenerator;

    beforeEach(() => {
      originalRng = getDefaultRng();
      // Set a seeded RNG for deterministic tests
      setDefaultRng(createSeededRng(54321));
    });

    afterEach(() => {
      setDefaultRng(originalRng);
    });

    it("should have next()", () => {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });

    it("should have nextInt()", () => {
      const value = random.nextInt(1, 6);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
    });

    it("should have pick()", () => {
      const array = ["a", "b", "c"];
      const picked = random.pick(array);
      expect(array).toContain(picked);
    });

    it("should have shuffle()", () => {
      const array = [1, 2, 3];
      random.shuffle(array);
      expect(array.sort()).toEqual([1, 2, 3]);
    });

    it("should have chance()", () => {
      expect(random.chance(1)).toBe(true);
      expect(random.chance(0)).toBe(false);
    });
  });
});
