/**
 * Ace Duel balance — guardrail on the real duel engine (DuelTempoSim: the
 * scenes' BotPilots, default quick builds with their secondaries, the aces'
 * sheet and ad-hoc abilities). Every preset is played from both seats at
 * the average tier (Normal) with fixed seeds, so the result is
 * deterministic: a drop here is a regression in ships, builds, abilities or
 * combat, not noise.
 *
 * The CI band (30–70 % at 24 rounds) is the 40–60 % target widened by the
 * sample's interval; `npm run balance:report` measures every preset at
 * average and expert with 120 rounds (docs/balance/latest.md).
 */

import { describe, it, expect } from "vitest";
import { ACE_MATCHUPS } from "../../src/data/AceMatchups";
import { findAceMatchupIssues } from "../../src/simulation/DuelBalance";
import {
  aceSides,
  runDuelSeries,
} from "../../src/simulation/balance/duelBalance";
import { shareInterval } from "../../src/simulation/balance/balanceStats";
import { seedRange } from "../../src/simulation/skill";

/** Seeds per preset (each flown from both seats). */
const SEEDS = seedRange(12, 4000);
/** CI band around the 40–60 % target. */
const CI_LOW = 0.3;
const CI_HIGH = 0.7;
/** A preset's median round must stay a duel, not a stalemate (ms). */
const MAX_MEDIAN_ROUND_MS = 90_000;
const AVERAGE = { tier: "average", reactionScale: 1 } as const;

describe("Ace Duel preset structure", () => {
  it("has at least the shipped roster of matchups", () => {
    expect(ACE_MATCHUPS.length).toBeGreaterThanOrEqual(6);
  });

  it("references only real ships and abilities, with unique ids and non-empty sides", () => {
    expect(findAceMatchupIssues()).toEqual([]);
  });

  it("pits no capital ship (they stalemate a duel)", () => {
    const capitals = ACE_MATCHUPS.flatMap((m) => [
      ...m.side1.ships,
      ...m.side2.ships,
    ]).filter((id) => /conduit|bastion$|imperator|dreadnought/.test(id));
    expect(capitals).toEqual([]);
  });
});

describe("Ace Duel presets on the real engine (average pilots, both seats)", () => {
  it.each(ACE_MATCHUPS.map((m) => m.id))(
    "preset '%s' is a fair fight",
    (id) => {
      const matchup = ACE_MATCHUPS.find((m) => m.id === id)!;
      const series = runDuelSeries({
        ...aceSides(matchup),
        seeds: SEEDS,
        skill1: AVERAGE,
        skill2: AVERAGE,
      });
      const { share } = shareInterval(series.tally);
      expect(share).toBeGreaterThanOrEqual(CI_LOW);
      expect(share).toBeLessThanOrEqual(CI_HIGH);
      const sorted = [...series.durationsMs].sort((a, b) => a - b);
      expect(sorted[Math.floor(sorted.length / 2)] ?? Infinity).toBeLessThan(
        MAX_MEDIAN_ROUND_MS,
      );
    },
    60_000,
  );
});
