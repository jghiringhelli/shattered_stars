/**
 * Skill gate 2, fast smoke (default unit suite): a coordinated squadron of
 * average pilots (shared focus target marked with SquadMark, flank slots,
 * cohesion, drag-and-bag, fall-back) beats the same points of solo expert
 * aces at least 70% of the time, over every faction's gate-2 squad. Fixed
 * seeds: deterministic, so a drop here is a regression, not noise. The full
 * sample runs in `npm run test:skill`.
 */
import { describe, expect, it } from "vitest";
import { NO_SHOT_LEVERS } from "../../../../src/arcade/ShotLevers";
import {
  ENGINE_RULES,
  GATE2_MIN_SQUAD_WIN_RATE,
  fighterRoster,
  gate2Compositions,
  measureGate2,
} from "../../../../src/simulation/skill";

/** Battles per faction squad. */
const SMOKE_SEEDS = 10;

describe("skill gate 2 smoke — coordinated average squad beats solo aces", () => {
  const compositions = gate2Compositions(fighterRoster().fighters);

  it("measures_every_faction", () => {
    expect(compositions).toHaveLength(5);
  });

  it("the_coordinated_squad_wins_at_least_70_percent", () => {
    expect(
      measureGate2(compositions, SMOKE_SEEDS).winRate,
    ).toBeGreaterThanOrEqual(GATE2_MIN_SQUAD_WIN_RATE);
  });

  it("owes_the_win_to_the_squad_mark_lever", () => {
    const withoutMark = {
      ...ENGINE_RULES,
      shotLevers: {
        ...ENGINE_RULES.shotLevers,
        markHitBonus: NO_SHOT_LEVERS.markHitBonus,
        markDamageBonus: NO_SHOT_LEVERS.markDamageBonus,
      },
    };
    expect(
      measureGate2(compositions.slice(0, 2), SMOKE_SEEDS, withoutMark).winRate,
    ).toBeLessThan(GATE2_MIN_SQUAD_WIN_RATE);
  });
});
