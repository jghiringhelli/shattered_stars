/**
 * Ace Duel Balance — regression guardrail for the preset iconic matchups.
 *
 * Ace Duel ships have no unit/sim coverage: the scene picks a canned matchup and
 * fights it best-of-3. This suite is the safety net for the *data + combat* of
 * those presets. With a FIXED seed it asserts:
 *  - structural integrity of every preset (real ships, real abilities, both sides),
 *  - determinism (same seed → identical outcome),
 *  - competitiveness (no preset is a hopeless stomp; matchups resolve decisively).
 *
 * It models ship-vs-ship combat only (pilot abilities / difficulty are layered by
 * the live scene, not the sim), so it is a coarse "is this matchup playable?" lens
 * rather than a claim of exact in-scene outcomes.
 */

import { describe, it, expect } from "vitest";
import { ACE_MATCHUPS } from "../../src/data/AceMatchups";
import {
  runAceMatchup,
  findAceMatchupIssues,
  STOMP_FLOOR,
  MAX_DRAW_RATE,
  type DuelOutcome,
} from "../../src/simulation/DuelBalance";

const BATTLES = 120;
const SEED = 20260316;

describe("Ace Duel preset structure", () => {
  it("has at least the shipped roster of matchups", () => {
    expect(ACE_MATCHUPS.length).toBeGreaterThanOrEqual(6);
  });

  it("references only real ships and abilities, with unique ids and non-empty sides", () => {
    const issues = findAceMatchupIssues();
    expect(issues).toEqual([]);
  });
});

describe("Ace Duel matchup balance (headless, seeded)", () => {
  const outcomes = new Map<string, DuelOutcome>();
  /**
   * Capital ships are intentionally boss-tier (tripled hull/shields + flat
   * armor damage reduction), so a duel between two capitals legitimately
   * needs far more turns to resolve than a fighter duel.
   */
  const MAX_TURNS_OVERRIDE: Readonly<Record<string, number>> = {
    gunship_duel: 300,
  };
  for (const matchup of ACE_MATCHUPS) {
    outcomes.set(
      matchup.id,
      runAceMatchup(matchup, {
        mode: "continuous",
        battles: BATTLES,
        seed: SEED,
        maxTurns: MAX_TURNS_OVERRIDE[matchup.id],
      }),
    );
  }

  it.each(ACE_MATCHUPS.map((m) => m.id))(
    "matchup '%s' is not a hopeless stomp",
    (id) => {
      const outcome = outcomes.get(id)!;
      // Among decisive battles, the losing side must still win a real share.
      expect(outcome.weakerSideShare).toBeGreaterThanOrEqual(STOMP_FLOOR);
    },
  );

  it.each(ACE_MATCHUPS.map((m) => m.id))(
    "matchup '%s' resolves decisively most of the time",
    (id) => {
      const outcome = outcomes.get(id)!;
      expect(outcome.drawRate).toBeLessThanOrEqual(MAX_DRAW_RATE);
    },
  );

  it("is deterministic for a fixed seed", () => {
    const first = runAceMatchup(ACE_MATCHUPS[0]!, {
      mode: "continuous",
      battles: BATTLES,
      seed: SEED,
    });
    const second = runAceMatchup(ACE_MATCHUPS[0]!, {
      mode: "continuous",
      battles: BATTLES,
      seed: SEED,
    });
    expect(second).toEqual(first);
  });
});
