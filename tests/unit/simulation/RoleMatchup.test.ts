import { describe, it, expect } from "vitest";
import type { ShipRole } from "../../../src/core/types";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";
import type { DuelOutcome } from "../../../src/simulation/DuelBalance";
import {
  ROLE_REPRESENTATIVES,
  ALL_ROLES,
  buildEqualPointSquad,
  runRoleMatchupMatrix,
  roleAWinShare,
  summarizeByRole,
  findDominantRole,
  findUnderpoweredRole,
  type RoleMatchupResult,
} from "../../../src/simulation/RoleMatchup";

function fakeOutcome(side1DecisiveShare: number): DuelOutcome {
  const side1Wins = Math.round(side1DecisiveShare * 100);
  return {
    totalBattles: 100,
    side1Wins,
    side2Wins: 100 - side1Wins,
    draws: 0,
    decisiveRate: 1,
    drawRate: 0,
    side1DecisiveShare,
    weakerSideShare: Math.min(side1DecisiveShare, 1 - side1DecisiveShare),
  };
}

function fakeResult(
  roleA: ShipRole,
  roleB: ShipRole,
  side1Share: number,
): RoleMatchupResult {
  return {
    roleA,
    roleB,
    squadASize: 1,
    squadBSize: 1,
    outcome: fakeOutcome(side1Share),
  };
}

/** Every unordered pair among ALL_ROLES, defaulting to a 50/50 split. */
function neutralMatrix(
  overrides: ReadonlyMap<string, number> = new Map(),
): RoleMatchupResult[] {
  const results: RoleMatchupResult[] = [];
  for (let i = 0; i < ALL_ROLES.length; i++) {
    for (let j = i + 1; j < ALL_ROLES.length; j++) {
      const a = ALL_ROLES[i]!;
      const b = ALL_ROLES[j]!;
      const share = overrides.get(`${a}:${b}`) ?? 0.5;
      results.push(fakeResult(a, b, share));
    }
  }
  return results;
}

describe("RoleMatchup", () => {
  it("ROLE_REPRESENTATIVES covers all 7 roles with distinct ship ids", () => {
    expect(ALL_ROLES).toHaveLength(7);
    expect(new Set(Object.values(ROLE_REPRESENTATIVES)).size).toBe(7);
  });

  it("buildEqualPointSquad fills the budget with as many identical ships as fit", () => {
    expect(buildEqualPointSquad("terran_stiletto", 200)).toHaveLength(
      Math.floor(
        200 / SHIP_DEFINITIONS["terran_stiletto"]!.baseStats.pointCost,
      ),
    );
    expect(buildEqualPointSquad("terran_imperator", 200)).toHaveLength(1); // cost 118
  });

  it("buildEqualPointSquad always returns at least 1 ship even over budget", () => {
    expect(buildEqualPointSquad("terran_imperator", 10)).toHaveLength(1);
  });

  it("roleAWinShare reads side1DecisiveShare directly", () => {
    expect(roleAWinShare(fakeResult("interceptor", "support", 0.8))).toBe(0.8);
  });

  it("summarizeByRole marks a >=60% share as beating, <=40% as losing to", () => {
    const results = [fakeResult("interceptor", "support", 0.8)];
    const summaries = summarizeByRole(results);
    const interceptor = summaries.find((s) => s.role === "interceptor")!;
    const support = summaries.find((s) => s.role === "support")!;
    expect(interceptor.beats).toContain("support");
    expect(support.losesTo).toContain("interceptor");
  });

  it("findDominantRole flags a role that beats every other role", () => {
    const dominant: ShipRole = "interceptor";
    const results = ALL_ROLES.filter((r) => r !== dominant).map((r) =>
      fakeResult(dominant, r, 0.9),
    );
    const summaries = summarizeByRole(results);
    expect(findDominantRole(summaries)).toBe(dominant);
    expect(findUnderpoweredRole(summaries)).toBeNull();
  });

  it("findUnderpoweredRole flags a role that loses to every other role", () => {
    const weak: ShipRole = "support";
    const results = ALL_ROLES.filter((r) => r !== weak).map((r) =>
      fakeResult(r, weak, 0.9),
    );
    const summaries = summarizeByRole(results);
    expect(findUnderpoweredRole(summaries)).toBe(weak);
    expect(findDominantRole(summaries)).toBeNull();
  });

  it("a healthy rock-paper-scissors triangle has neither a dominant nor an underpowered role", () => {
    const overrides = new Map([
      ["interceptor:support", 0.7], // interceptor beats support
      ["heavy_fighter:support", 0.3], // support beats heavy_fighter
      ["heavy_fighter:interceptor", 0.7], // heavy_fighter beats interceptor
    ]);
    const summaries = summarizeByRole(neutralMatrix(overrides));
    expect(findDominantRole(summaries)).toBeNull();
    expect(findUnderpoweredRole(summaries)).toBeNull();
  });

  it("runRoleMatchupMatrix produces one result per unordered role pair", () => {
    const results = runRoleMatchupMatrix(
      ["interceptor", "support"],
      200,
      5,
      1,
      { mode: "arcade", maxTurns: 40 },
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.outcome.totalBattles).toBe(5);
    expect(results[0]!.squadASize).toBeGreaterThan(0);
    expect(results[0]!.squadBSize).toBeGreaterThan(0);
  });
});
