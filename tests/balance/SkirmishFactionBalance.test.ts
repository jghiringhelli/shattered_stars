/**
 * Skirmish faction balance — guardrail on the real engine (the skill
 * arena: BotPilots through the player's controls, SquadCommand marks,
 * CycleFlight, dice combat, secondaries, faction auras). Each faction fields
 * the squad the Skirmish AI builds for it (autoFillSquad: its curated
 * 200-point quick-build squad, each ship on its build) and fights every
 * other faction from both seats with fixed seeds — deterministic, so a
 * drop here is a regression in prices, builds, lists or combat.
 *
 * The CI band (30–70 % per faction at 32 games) is the 40–60 % target
 * widened by the sample's interval; `npm run balance:report` measures the
 * full matrices (classic and reinforced) with 80 games per pairing.
 */

import { describe, it, expect } from "vitest";
import {
  BALANCE_FACTIONS,
  listCost,
  skirmishAutoFillList,
  SKIRMISH_POINT_LIMIT,
} from "../../src/simulation/balance/squadLists";
import {
  classicPair,
  factionPairs,
  factionTotals,
  type PairResult,
} from "../../src/simulation/balance/factionMatrix";
import { shareInterval } from "../../src/simulation/balance/balanceStats";
import { seedRange } from "../../src/simulation/skill";

/** Seeds per pairing (each played from both seats). */
const SEEDS = seedRange(4, 6000);
/** CI band around the 40–60 % target. */
const CI_LOW = 0.3;
const CI_HIGH = 0.7;
/** A curated list spends at least this share of its budget. */
const MIN_SPEND = 0.9;

describe("Skirmish AI squads (auto-fill)", () => {
  it.each(BALANCE_FACTIONS)(
    "%s flies at most 200 points of builds",
    (faction) => {
      const cost = listCost(skirmishAutoFillList(faction));
      expect(cost).toBeLessThanOrEqual(SKIRMISH_POINT_LIMIT);
      expect(cost).toBeGreaterThanOrEqual(SKIRMISH_POINT_LIMIT * MIN_SPEND);
    },
  );
});

describe("Skirmish faction balance on the real engine (average pilots)", () => {
  const pairs: PairResult[] = [];
  it("plays every pairing", () => {
    const lists = new Map(
      BALANCE_FACTIONS.map((f) => [f, skirmishAutoFillList(f)] as const),
    );
    for (const [a, b] of factionPairs())
      pairs.push(classicPair(lists.get(a)!, lists.get(b)!, SEEDS));
    expect(pairs.length).toBe(10);
  }, 120_000);

  it.each(BALANCE_FACTIONS)("%s wins a fair share of its games", (faction) => {
    const { share } = shareInterval(factionTotals(pairs).get(faction)!);
    expect(share).toBeGreaterThanOrEqual(CI_LOW);
    expect(share).toBeLessThanOrEqual(CI_HIGH);
  });
});
