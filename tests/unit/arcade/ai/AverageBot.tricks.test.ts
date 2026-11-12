/**
 * AverageBot specials — an engaged average pilot only occasionally thinks of
 * a Snap turn / Hook / Knife (it spends the recharge when queued), instead of
 * flying one every time it recharges like an ace.
 */

import { describe, expect, it } from "vitest";
import {
  AVERAGE_TRICK_CHANCE,
  AverageBot,
  AVERAGE_WEIGHTS,
} from "../../../../src/arcade/ai/bots/AverageBot";
import { TIER_PROFILES } from "../../../../src/arcade/ai/bots/BotKit";
import { profileBattle } from "../../../../src/simulation/skill/BehaviourRun";

const SEEDS = [1, 2, 3, 4];

/** @returns Special requests of two average pilots with this trick chance, over several duels. */
function specialRequests(trickChance: number): number {
  let requests = 0;
  for (const seed of SEEDS) {
    const entry = (definitionId: string) => ({
      definitionId,
      tier: "average" as const,
      bot: new AverageBot(TIER_PROFILES.average, AVERAGE_WEIGHTS, trickChance),
    });
    const profiles = profileBattle({
      A: { ships: [entry("terran_gladius")], squad: null },
      B: { ships: [entry("confed_raven")], squad: null },
      seed,
      timeLimitMs: 40_000,
    });
    for (const p of profiles) requests += p.decisions.specialRequests;
  }
  return requests;
}

describe("AverageBot — occasional specials", () => {
  it("considers specials on a minority of decisions", () => {
    expect(AVERAGE_TRICK_CHANCE).toBeGreaterThan(0);
    expect(AVERAGE_TRICK_CHANCE).toBeLessThan(0.5);
  });

  it("flies no special in a fight when it never thinks of one", () => {
    expect(specialRequests(0)).toBe(0);
  });

  it("asks for fewer specials the less often it thinks of them", () => {
    expect(specialRequests(1)).toBeGreaterThan(specialRequests(0.1));
  });
});
