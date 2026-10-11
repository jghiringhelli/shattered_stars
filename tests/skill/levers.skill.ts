/**
 * Lever report — measured, not gated. Prints both gates under every rule
 * set in LEVER_CANDIDATES (the engine as shipped first, then the bare dice
 * model, each adopted lever alone, and the prototypes that were NOT adopted)
 * so a lever change can be judged before it touches the shared modules.
 * The adopted levers' own contracts live in tests/unit/arcade/ShotLevers
 * and tests/unit/arcade/systems/SquadMark.
 *
 * SKILL_LEVER_PAIRS (default 30), SKILL_LEVER_SEEDS (default 10) and
 * SKILL_LEVER_SQUAD_SEEDS (default 20) size the sample.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHOT_LEVERS,
  NO_SHOT_LEVERS,
} from "../../src/arcade/ShotLevers";
import {
  ENGINE_RULES,
  LEVER_CANDIDATES,
  duelSpec,
  fighterRoster,
  gate1Pairs,
  gate2Compositions,
  measureGate2,
  runBattle,
  runSeries,
  sampleGate1Pairs,
  seedRange,
} from "../../src/simulation/skill";

const PAIRS = Number(process.env.SKILL_LEVER_PAIRS ?? 30);
const SEEDS = Number(process.env.SKILL_LEVER_SEEDS ?? 10);
const SQUAD_SEEDS = Number(process.env.SKILL_LEVER_SQUAD_SEEDS ?? 20);

describe("arena rules contract", () => {
  it("the_default_rules_are_the_engine_with_its_shipped_shot_levers", () => {
    const pair = {
      expertShip: "terran_gladius",
      noviceShip: "confed_falcon",
      priceRatio: 1,
    };
    expect(ENGINE_RULES.shotLevers).toEqual(DEFAULT_SHOT_LEVERS);
    expect(runBattle(duelSpec(pair, 11, ENGINE_RULES))).toEqual(
      runBattle(duelSpec(pair, 11)),
    );
  });

  it("the_bare_dice_rule_set_turns_every_shot_lever_off", () => {
    const bare = LEVER_CANDIDATES.find((c) => c.name === "bareDice");
    expect(bare?.rules.shotLevers).toEqual(NO_SHOT_LEVERS);
  });
});

describe("lever report", () => {
  it("prints_both_gates_under_every_rule_set", () => {
    const roster = fighterRoster();
    const pairs = sampleGate1Pairs(gate1Pairs(roster.fighters), PAIRS);
    const compositions = gate2Compositions(roster.fighters);
    for (const candidate of LEVER_CANDIDATES) {
      const duels = pairs.map(
        (pair) =>
          runSeries(
            (seed) => duelSpec(pair, seed, candidate.rules),
            seedRange(SEEDS),
          ).summary,
      );
      const gate1 = duels.reduce((sum, s) => sum + s.winRate, 0) / duels.length;
      const below = duels.filter((s) => s.winRate < 0.85).length;
      const worst = Math.min(...duels.map((s) => s.winRate));
      const gate2 = measureGate2(compositions, SQUAD_SEEDS, candidate.rules);
      const squadMedian =
        [...gate2.rows.map((r) => r.summary.medianDurationMs)].sort(
          (a, b) => a - b,
        )[gate2.rows.length >> 1]! / 1000;
      const duelMedian =
        [...duels.map((s) => s.medianDurationMs)].sort((a, b) => a - b)[
          duels.length >> 1
        ]! / 1000;
      console.log(
        `[lever] ${candidate.name.padEnd(15)} G1 mean ${gate1.toFixed(3)} below85 ${below}/${duels.length} worst ${worst.toFixed(2)} duel ${duelMedian.toFixed(1)}s | G2 ${gate2.winRate.toFixed(3)} squad ${squadMedian.toFixed(1)}s — ${candidate.intent}`,
      );
    }
    expect(LEVER_CANDIDATES[0]!.rules).toEqual(ENGINE_RULES);
  });
});
