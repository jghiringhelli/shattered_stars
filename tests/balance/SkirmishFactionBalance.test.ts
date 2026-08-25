/**
 * Skirmish Faction Balance — regression guardrail at the real play budget.
 *
 * Skirmish is played with 200-point squads built from the quick-build presets
 * (the same path SquadBuilderScene and scripts/headless_sim.ts use). The existing
 * tests/balance/BattleSimulator.test.ts exercises balance with raw "all ships of a
 * faction" lists and unseeded RNG — useful, but neither the real squad composition
 * nor deterministic.
 *
 * This suite runs the full faction matrix at the 200pt preset budget with a FIXED
 * seed and asserts:
 *  - structural invariants (decisive tallies, bounded turns, non-empty squads within budget),
 *  - determinism (same seed → identical aggregate),
 *  - a WIDE regression guardrail on per-faction win rate.
 *
 * It is intentionally a relative-lens guardrail, not a claim of perfect balance:
 * the band is wide enough to tolerate the current (imperfect) tuning while still
 * catching a faction regressing into unplayable or unbeatable territory.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  BattleSimulator,
  type AggregatedStats,
  type SimShipSpec,
} from "../../src/simulation/BattleSimulator";
import {
  runFactionMatrix,
  aggregateFactionWinRates,
  type FactionMatchup,
} from "../../src/simulation/FactionBalance";
import { getQuickBuild, toSimSpecs } from "../../src/data/SquadronPresets";
import type { FactionId } from "../../src/config";

const FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
] as const;

const BUDGET = 200;
const BATTLES_PER_MATCHUP = 40;
const MAX_TURNS = 60;
const SEED = 20260316;

/** A single directed matchup outcome (team1 = faction a, team2 = faction b). */
type Matchup = FactionMatchup;

/** Build the 200pt preset squad for a faction (pure — presets exist for all factions). */
function squadFor(faction: FactionId): SimShipSpec[] {
  const preset = getQuickBuild(faction, BUDGET);
  if (!preset) throw new Error(`no ${BUDGET}pt preset for ${faction}`);
  return toSimSpecs(preset);
}

describe("Skirmish faction balance (200pt presets, seeded)", () => {
  let matchups: Matchup[] = [];
  const squads = new Map<FactionId, SimShipSpec[]>();

  beforeAll(() => {
    for (const faction of FACTIONS) squads.set(faction, squadFor(faction));

    const sim = new BattleSimulator({
      verbose: false,
      maxTurns: MAX_TURNS,
      seed: SEED,
    });
    matchups = runFactionMatrix(sim, FACTIONS, BUDGET, BATTLES_PER_MATCHUP);
  });

  it("builds a non-empty 200pt preset squad within budget for every faction", () => {
    for (const faction of FACTIONS) {
      const preset = getQuickBuild(faction, BUDGET);
      expect(preset, `preset for ${faction}`).toBeDefined();
      expect(preset!.pointLimit).toBeLessThanOrEqual(BUDGET);
      expect(squads.get(faction)!.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("runs every matchup to a decisive tally within the turn budget", () => {
    expect(matchups.length).toBe(10); // C(5,2)
    for (const { a, b, stats } of matchups) {
      const label = `${a} vs ${b}`;
      expect(stats.totalBattles, label).toBe(BATTLES_PER_MATCHUP);
      expect(stats.team1Wins + stats.team2Wins + stats.draws, label).toBe(
        BATTLES_PER_MATCHUP,
      );
      expect(stats.averageTurns, label).toBeGreaterThan(0);
      expect(stats.averageTurns, label).toBeLessThanOrEqual(MAX_TURNS);
    }
  });

  it("is deterministic for a fixed seed", () => {
    const a = FACTIONS[0]!;
    const b = FACTIONS[3]!;
    const run = (): AggregatedStats =>
      new BattleSimulator({
        verbose: false,
        maxTurns: MAX_TURNS,
        seed: SEED,
      }).runBatchSimulation(squadFor(a), squadFor(b), BATTLES_PER_MATCHUP);

    const first = run();
    const second = run();
    expect(second.team1Wins).toBe(first.team1Wins);
    expect(second.team2Wins).toBe(first.team2Wins);
    expect(second.draws).toBe(first.draws);
  });

  it("has no single matchup that is a near-total blowout", () => {
    for (const { a, b, stats } of matchups) {
      const t1 = stats.team1Wins / stats.totalBattles;
      const t2 = stats.team2Wins / stats.totalBattles;
      const dominant = Math.max(t1, t2);
      expect(dominant, `${a} vs ${b} dominant win rate`).toBeLessThanOrEqual(
        0.9,
      );
    }
  });

  it("keeps every faction's aggregate win rate inside the regression guardrail", () => {
    const rates = aggregateFactionWinRates(matchups);
    for (const faction of FACTIONS) {
      const rate = rates.get(faction)!;
      // Wide band: catches an unplayable (<20%) or unbeatable (>80%) faction
      // without failing on the current imperfect-but-shipped tuning.
      expect(rate, `${faction} aggregate win rate`).toBeGreaterThanOrEqual(0.2);
      expect(rate, `${faction} aggregate win rate`).toBeLessThanOrEqual(0.8);
    }
  });
});
