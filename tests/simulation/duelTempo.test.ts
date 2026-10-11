/**
 * Duel tempo — headless specification of the X-Wing round tempo in the duel
 * scenes: an attacker never damages the same target twice within a maneuver
 * cycle, no ship attacks more than once per cycle, and a duel between equal
 * pilots lasts many cycles instead of the old 1–2 s trade.
 */

import { describe, it, expect } from "vitest";
import { CYCLE_DURATION_MS } from "../../src/config";
import {
  DUEL_BANNER_MS,
  DUEL_ROUND_LIMIT_MS,
  medianDurationMs,
  simulateDuelRound,
  type DuelTempoConfig,
  type DuelTempoResult,
} from "../../src/simulation/DuelTempoSim";

/** Floating-point slack on the fixed logic step. */
const STEP_EPSILON_MS = 1e-6;
/** Seeds per measured matchup. */
const SEEDS = 15;
/** A duel between equal pilots must last at least this long (ms). */
const MIN_EQUAL_DUEL_MEDIAN_MS = 10_000;

const FALCON_MIRROR: Omit<DuelTempoConfig, "seed"> = {
  side1: ["confed_falcon"],
  side2: ["confed_falcon"],
};

function rounds(base: Omit<DuelTempoConfig, "seed">): DuelTempoResult[] {
  return Array.from({ length: SEEDS }, (_, i) =>
    simulateDuelRound({ ...base, seed: 100 + i }),
  );
}

describe("duel round tempo (headless)", () => {
  const falconRounds = rounds(FALCON_MIRROR);

  it("never lets an attacker damage the same target twice within a cycle", () => {
    for (const round of falconRounds) {
      for (const times of round.hitTimes.values()) {
        for (let i = 1; i < times.length; i++) {
          expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(
            CYCLE_DURATION_MS - STEP_EPSILON_MS,
          );
        }
      }
    }
  });

  it("never lets a ship attack more than once per maneuver cycle", () => {
    for (const round of falconRounds) {
      const elapsedMs = round.durationMs ?? DUEL_ROUND_LIMIT_MS;
      const maxAttacks = Math.ceil(elapsedMs / CYCLE_DURATION_MS) + 1;
      expect(round.attacks[1]).toBeLessThanOrEqual(maxAttacks);
      expect(round.attacks[2]).toBeLessThanOrEqual(maxAttacks);
    }
  });

  it("is deterministic for a seed", () => {
    const again = simulateDuelRound({ ...FALCON_MIRROR, seed: 100 });
    expect(again.durationMs).toBe(falconRounds[0]!.durationMs);
    expect(again.winner).toBe(falconRounds[0]!.winner);
  });

  it("holds fire through the ROUND banner", () => {
    for (const round of falconRounds) {
      for (const times of round.hitTimes.values()) {
        expect(times[0]!).toBeGreaterThan(DUEL_BANNER_MS);
      }
    }
  });

  it("makes a duel between equal pilots last many maneuver cycles", () => {
    expect(medianDurationMs(falconRounds)).toBeGreaterThanOrEqual(
      MIN_EQUAL_DUEL_MEDIAN_MS,
    );
  });
});

describe("medianDurationMs", () => {
  const round = (durationMs: number | null): DuelTempoResult => ({
    durationMs,
    winner: durationMs === null ? null : 1,
    attacks: { 1: 0, 2: 0 },
    hitTimes: new Map(),
  });

  it("ignores timed-out rounds", () => {
    expect(medianDurationMs([round(1000), round(null), round(3000)])).toBe(
      2000,
    );
  });

  it("is null when every round timed out", () => {
    expect(medianDurationMs([round(null)])).toBeNull();
  });

  it("takes the middle value of an odd count", () => {
    expect(medianDurationMs([round(5), round(1), round(3)])).toBe(3);
  });
});
