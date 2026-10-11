/**
 * Spec: the sims under a tempo variant — the engine tempo replays the
 * engine bit for bit, round stats (first kill, damage, specials) are
 * reported, and a longer cycle with the attack cap tied to it stretches a
 * duel.
 */

import { describe, it, expect } from "vitest";
import {
  simulateDuelRound,
  medianDurationMs,
} from "../../src/simulation/DuelTempoSim";
import { runBattle } from "../../src/simulation/skill/SkillArena";
import { ENGINE_TEMPO } from "../../src/simulation/TempoVariant";
import type { BattleSpec } from "../../src/simulation/skill/ArenaSpec";

const FALCONS = { side1: ["confed_falcon"], side2: ["confed_falcon"] } as const;
const SEEDS = [11, 12, 13, 14, 15, 16, 17, 18];

function squadSpec(seed: number): BattleSpec {
  const side = {
    ships: [
      { definitionId: "confed_falcon", tier: "average" as const },
      { definitionId: "confed_falcon", tier: "average" as const },
    ],
    squad: {},
  };
  return { A: side, B: side, seed };
}

describe("tempo variants in the sims", () => {
  it("replays a duel bit for bit at the engine tempo", () => {
    const plain = simulateDuelRound({ ...FALCONS, seed: 7 });
    const engine = simulateDuelRound({
      ...FALCONS,
      seed: 7,
      tempo: ENGINE_TEMPO,
    });
    expect(engine.durationMs).toBe(plain.durationMs);
    expect(engine.attacks).toEqual(plain.attacks);
    expect(engine.damage).toEqual(plain.damage);
  });

  it("replays a skill-arena battle bit for bit at the engine tempo", () => {
    const plain = runBattle(squadSpec(3));
    const engine = runBattle({ ...squadSpec(3), tempo: ENGINE_TEMPO });
    expect(engine.durationMs).toBe(plain.durationMs);
    expect(engine.tallies).toEqual(plain.tallies);
  });

  it("reports the first kill, damage and specials of a decided round", () => {
    const round = simulateDuelRound({ ...FALCONS, seed: 7 });
    expect(round.firstKillMs).toBe(round.durationMs);
    expect(round.damage[1] + round.damage[2]).toBeGreaterThan(0);
    expect(round.hits[1] + round.hits[2]).toBeGreaterThan(0);
    expect(round.specialsUsed).toBeGreaterThanOrEqual(0);
  });

  it("reports the first kill of a skill-arena battle no later than its end", () => {
    const result = runBattle(squadSpec(4));
    expect(result.firstKillMs).not.toBeNull();
    expect(result.firstKillMs!).toBeLessThanOrEqual(result.durationMs);
  });

  it("stretches a duel when the cycle (and the attack cap with it) is longer", () => {
    const median = (cycleMs: number) =>
      medianDurationMs(
        SEEDS.map((seed) =>
          simulateDuelRound({
            ...FALCONS,
            seed,
            tempo: { ...ENGINE_TEMPO, cycleMs },
          }),
        ),
      )!;
    expect(median(750)).toBeGreaterThan(median(500));
  });

  it("lets side 2 fly at its own tier", () => {
    const wins = SEEDS.filter(
      (seed) =>
        simulateDuelRound({
          ...FALCONS,
          seed,
          tier: "expert",
          side2Tier: "novice",
        }).winner === 1,
    ).length;
    expect(wins).toBeGreaterThanOrEqual(SEEDS.length - 2);
  });
});
