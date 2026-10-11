/**
 * Skill gate 1, fast smoke (default unit suite): an expert pilot beats a
 * novice in the hardest fighter matchups found by the full matrix
 * (`SKILL_PAIRS=all npm run test:skill`), including novice ships costing up
 * to +30% more. Fixed seeds: deterministic, so a drop here is a regression
 * in the engine's skill expression (shot levers, flight, combat tempo,
 * ship data), not noise.
 */
import { describe, expect, it } from "vitest";
import {
  GATE1_MIN_EXPERT_WIN_RATE,
  fighterRoster,
  gate1Pairs,
  measureGate1Pair,
} from "../../../../src/simulation/skill";

/** Seeds per pair (pairs dipping below the threshold are re-measured). */
const SMOKE_SEEDS = 20;

/** The thinnest margins of the full gate-1 matrix, plus a mirror. */
const HARDEST_PAIRS: readonly string[] = [
  "confed_owl>ascendant_crusader",
  "confed_raven>ascendant_crusader",
  "corsair_blade>corsair_marauder",
  "corsair_specter>synth_predator",
  "corsair_talon>synth_hunter",
  "synth_interceptor_drone>synth_stalker",
  "synth_stalker>synth_ravager",
  "terran_viper>terran_viper",
];

describe("skill gate 1 smoke — expert beats novice in the hardest fighter pairs", () => {
  const all = gate1Pairs(fighterRoster().fighters);
  const pairs = HARDEST_PAIRS.map((key) =>
    all.find((p) => `${p.expertShip}>${p.noviceShip}` === key),
  );

  it("covers_pairs_that_the_gate_rules_still_admit", () => {
    expect(pairs.every((pair) => pair !== undefined)).toBe(true);
  });

  for (const [index, key] of HARDEST_PAIRS.entries()) {
    it(`expert_wins_at_least_85_percent_${key.replace(">", "_vs_")}`, () => {
      const pair = pairs[index];
      if (!pair)
        throw new Error(`pair ${key} is no longer in the gate-1 matrix`);
      const { summary } = measureGate1Pair(pair, SMOKE_SEEDS);
      expect(summary.winRate).toBeGreaterThanOrEqual(GATE1_MIN_EXPERT_WIN_RATE);
    });
  }
});
