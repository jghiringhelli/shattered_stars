/**
 * Reinforced Skirmish (the default battle type) on the real engine: the
 * pure ReinforcementDirector wired to the skill arena as the Skirmish
 * scene wires it (ReinforcedBattleSim). Fixed seeds; guards the format's
 * shape — both sides keep deploying, the match ends by exhaustion or at the
 * 3:00 clock, destroyed points decide — so a regression in the director,
 * the plans or the field cap shows up here. Faction parity in reinforced
 * battles is measured by `npm run balance:report` (40 games per pairing).
 */

import { describe, it, expect } from "vitest";
import { REINFORCED_TIME_LIMIT_MS } from "../../src/arcade/reinforcements";
import { runReinforcedBattle } from "../../src/simulation/ReinforcedBattleSim";
import { skirmishAutoFillList } from "../../src/simulation/balance/squadLists";

const AVERAGE = { tier: "average", reactionScale: 1 } as const;
/** One logic tick of slack past the clock (ms). */
const TICK_SLACK_MS = 50;

function battle(seed: number) {
  return runReinforcedBattle({
    player: {
      opening: skirmishAutoFillList("free_confederation"),
      strategy: "balanced",
      skill: AVERAGE,
    },
    enemy: {
      opening: skirmishAutoFillList("void_corsairs"),
      strategy: "balanced",
      skill: AVERAGE,
    },
    seed,
  });
}

describe("reinforced Skirmish on the real engine", () => {
  const results = [battle(31), battle(32)];

  it("ends by exhaustion or at the 3:00 clock", () => {
    for (const result of results) {
      expect(["exhaustion", "time"]).toContain(result.endedBy);
      expect(result.durationMs).toBeLessThanOrEqual(
        REINFORCED_TIME_LIMIT_MS + TICK_SLACK_MS,
      );
    }
  });

  it("keeps both sides deploying replacements", () => {
    for (const result of results) {
      expect(result.deployments.A).toBeGreaterThan(0);
      expect(result.deployments.B).toBeGreaterThan(0);
    }
  });

  it("awards a decided match to the side that destroyed more points at the clock", () => {
    for (const result of results.filter((r) => r.endedBy === "time")) {
      const { A, B } = result.destroyedPoints;
      if (A === B) expect(result.winner).toBe("draw");
      else expect(result.winner).toBe(A > B ? "player" : "enemy");
    }
  });

  it("is deterministic for a fixed seed", () => {
    expect(battle(31)).toEqual(results[0]);
  });
});
