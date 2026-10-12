/**
 * AI difficulty curve — the average "player" bot against each difficulty
 * label in Dogfight (the default pairing, both seats, fixed seeds) on the
 * real duel engine. Every step up must be harder than the last, Easy must
 * be comfortably winnable and Brutal must be a real challenge. Targets
 * (Easy ~80, Normal ~50, Hard ~25–30, Brutal ~10–15 %) are measured per
 * mode by `npm run balance:report`.
 */

import { describe, it, expect } from "vitest";
import {
  DIFFICULTY_LABELS,
  playerVersusDifficulty,
} from "../../src/simulation/balance/difficultyCurve";
import { shareInterval } from "../../src/simulation/balance/balanceStats";
import { seedRange } from "../../src/simulation/skill";

const SEEDS = seedRange(10, 8000);
/** Easy must be at least this winnable for the average player bot. */
const EASY_FLOOR = 0.65;
/** Brutal must be at most this winnable. */
const BRUTAL_CEILING = 0.3;

describe("AI difficulty curve (Dogfight, average player bot)", () => {
  const shares = DIFFICULTY_LABELS.map(
    (label) =>
      shareInterval(playerVersusDifficulty("dogfight", label, SEEDS)).share,
  );

  it("gets harder at every step", () => {
    for (let i = 1; i < shares.length; i++)
      expect(shares[i]!).toBeLessThan(shares[i - 1]!);
  });

  it("keeps Easy winnable and Brutal a challenge", () => {
    expect(shares[0]!).toBeGreaterThanOrEqual(EASY_FLOOR);
    expect(shares[shares.length - 1]!).toBeLessThanOrEqual(BRUTAL_CEILING);
  });
});
