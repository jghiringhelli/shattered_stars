/**
 * Unit tests for the pure helpers in DuelBalance — the structural validator and
 * the outcome normalizer. These cover the branches the seeded balance guardrails
 * don't hit (malformed matchups, zero-decisive batches).
 */

import { describe, it, expect } from "vitest";
import {
  findAceMatchupIssues,
  toDuelOutcome,
} from "../../../src/simulation/DuelBalance";
import type { AceMatchup } from "../../../src/data/AceMatchups";
import type { AggregatedStats } from "../../../src/simulation/BattleSimulator";

function emptyAggregated(overrides: Partial<AggregatedStats>): AggregatedStats {
  return {
    totalBattles: 0,
    team1Wins: 0,
    team2Wins: 0,
    draws: 0,
    averageTurns: 0,
    shipPerformance: new Map(),
    factionPerformance: new Map(),
    ...overrides,
  };
}

describe("findAceMatchupIssues", () => {
  it("returns no issues for the shipped roster", () => {
    expect(findAceMatchupIssues()).toEqual([]);
  });

  it("flags duplicate matchup ids", () => {
    const base: AceMatchup = {
      id: "dup",
      name: "A",
      description: "",
      flavorText: "",
      side1: {
        name: "s1",
        faction: "terran_hegemony",
        ships: ["terran_raptor"],
        abilities: [],
      },
      side2: {
        name: "s2",
        faction: "free_confederation",
        ships: ["confed_falcon"],
        abilities: [],
      },
    };
    const issues = findAceMatchupIssues([base, base]);
    expect(issues).toContainEqual({
      matchupId: "dup",
      problem: "duplicate matchup id",
    });
  });

  it("flags empty sides, unknown ships and unknown abilities", () => {
    const bad: AceMatchup = {
      id: "bad",
      name: "B",
      description: "",
      flavorText: "",
      side1: {
        name: "empty",
        faction: "terran_hegemony",
        ships: [],
        abilities: [],
      },
      side2: {
        name: "wrong",
        faction: "free_confederation",
        ships: ["not_a_real_ship"],
        abilities: ["not_a_real_ability"],
      },
    };
    const issues = findAceMatchupIssues([bad]);
    const problems = issues.map((i) => i.problem);
    expect(problems).toContain('side "empty" has no ships');
    expect(problems).toContain('unknown ship id "not_a_real_ship"');
    expect(problems).toContain('unknown ability id "not_a_real_ability"');
  });
});

describe("toDuelOutcome", () => {
  it("reports zero shares for an all-draws batch", () => {
    const outcome = toDuelOutcome(
      emptyAggregated({ totalBattles: 10, draws: 10 }),
    );
    expect(outcome.decisiveRate).toBe(0);
    expect(outcome.drawRate).toBe(1);
    expect(outcome.side1DecisiveShare).toBe(0);
    expect(outcome.weakerSideShare).toBe(0);
  });

  it("reports zero rates for an empty batch", () => {
    const outcome = toDuelOutcome(emptyAggregated({}));
    expect(outcome.decisiveRate).toBe(0);
    expect(outcome.drawRate).toBe(0);
  });

  it("computes decisive shares from wins", () => {
    const outcome = toDuelOutcome(
      emptyAggregated({ totalBattles: 10, team1Wins: 7, team2Wins: 3 }),
    );
    expect(outcome.decisiveRate).toBe(1);
    expect(outcome.side1DecisiveShare).toBeCloseTo(0.7);
    expect(outcome.weakerSideShare).toBeCloseTo(0.3);
  });
});
