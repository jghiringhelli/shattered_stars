/**
 * AIDifficulty — specification: every difficulty has a display name and a
 * description that speaks of pilot skill, not stat bonuses.
 */

import { describe, it, expect } from "vitest";
import {
  DIFFICULTY_DESCRIPTIONS,
  DIFFICULTY_NAMES,
  type AIDifficultyLevel,
} from "../../../src/ai/AIDifficulty";

const LEVELS: readonly AIDifficultyLevel[] = [
  "easy",
  "normal",
  "hard",
  "brutal",
];

describe("AIDifficulty", () => {
  it("names every difficulty", () => {
    for (const level of LEVELS) expect(DIFFICULTY_NAMES[level]).toBeTruthy();
  });

  it("describes every difficulty by its pilots", () => {
    for (const level of LEVELS)
      expect(DIFFICULTY_DESCRIPTIONS[level]).toMatch(/pilots/i);
  });
});
