/**
 * Dogfight default pairing — the ships a new Dogfight preselects must be an
 * even fight between equal pilots. The old default (Falcon v Raptor) went
 * to the Falcon 89–97 % of the time at every tier (telemetry battery);
 * DuelTempoSim flies the same BotPilots as the scene.
 */

import { describe, it, expect } from "vitest";
import { DOGFIGHT_DEFAULT_PAIRING } from "../../src/data/DogfightDefaults";
import { simulateDuelRound } from "../../src/simulation/DuelTempoSim";

/** Seeds per seating (fixed: the result is deterministic). */
const ROUNDS = 40;
const SEED_BASE = 1000;
/** Fair = the default player's share of decided rounds within 50 ± 10 %. */
const FAIRNESS_MARGIN = 0.1;

const { player, enemy } = DOGFIGHT_DEFAULT_PAIRING;

/** @returns The default player ship's wins and decided rounds over both seatings. */
function averageMirror(): { wins: number; decided: number } {
  let wins = 0;
  let decided = 0;
  for (const [side1, side2, playerSide] of [
    [player.shipId, enemy.shipId, 1],
    [enemy.shipId, player.shipId, 2],
  ] as const) {
    for (let i = 0; i < ROUNDS; i++) {
      const round = simulateDuelRound({
        side1: [side1],
        side2: [side2],
        seed: SEED_BASE + i,
        tier: "average",
      });
      if (round.winner === null) continue;
      decided += 1;
      if (round.winner === playerSide) wins += 1;
    }
  }
  return { wins, decided };
}

describe("Dogfight default pairing", () => {
  it("pits the Free Confederation against the Terran Hegemony with ships from their rosters", () => {
    expect(player.faction).toBe("free_confederation");
    expect(enemy.faction).toBe("terran_hegemony");
    expect(player.shipId.startsWith("confed_")).toBe(true);
    expect(enemy.shipId.startsWith("terran_")).toBe(true);
  });

  it("is an even fight between average pilots (within ±10 % over both seatings)", () => {
    const { wins, decided } = averageMirror();
    expect(decided).toBeGreaterThan(ROUNDS);
    const share = wins / decided;
    expect(share).toBeGreaterThanOrEqual(0.5 - FAIRNESS_MARGIN);
    expect(share).toBeLessThanOrEqual(0.5 + FAIRNESS_MARGIN);
  }, 120_000);
});
