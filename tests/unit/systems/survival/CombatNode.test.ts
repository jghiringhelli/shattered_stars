import { describe, it, expect } from "vitest";
import {
  combatKindOf,
  MAX_BELT_STEPS,
  MAX_REGULARS_PER_WAVE,
  planCombat,
  shouldStartNextBossPhase,
  WAVES_PER_NODE,
} from "../../../../src/systems/survival/CombatNodePlan";
import { ROGUELITE_THREAT_SCALE } from "../../../../src/systems/survival/CombatNodePlan";
import {
  completeCombat,
  failRun,
  rewardsFor,
  type CombatOutcome,
} from "../../../../src/systems/survival/CombatResolution";
import { addEscort } from "../../../../src/systems/survival/RunState";
import { NODE_CLEAR_SALVAGE } from "../../../../src/data/survival/economy";
import { survivalEnemyTier } from "../../../../src/arcade/systems/SurvivalSteering";
import type { RunState } from "../../../../src/systems/survival/RunTypes";
import { RunBuilder, atActiveNode } from "./survivalRunBuilder";

function outcome(
  run: RunState,
  patch: Partial<CombatOutcome> = {},
): CombatOutcome {
  return {
    survivors: [{ ...run.flagship, hull: 0.4, shields: 0 }],
    kills: 3,
    elitesKilled: 0,
    bossesKilled: 0,
    killSalvage: 9,
    progressionLevel: 2,
    durationMs: 60_000,
    ...patch,
  };
}

describe("planCombat", () => {
  it("plans nothing when no battle is active", () => {
    expect(planCombat(RunBuilder.aRun().build())).toBeNull();
  });

  it("scales threat with sector and row and keeps sector-1 row-0 pilots novices", () => {
    const run = atActiveNode(RunBuilder.aRun().build(), "combat");
    const plan = planCombat(run)!;
    expect(plan.kind).toBe("combat");
    expect(plan.waves).toBe(WAVES_PER_NODE.combat);
    expect(plan.threatMultiplier).toBeCloseTo(ROGUELITE_THREAT_SCALE);
    expect(plan.maxRegulars).toBe(MAX_REGULARS_PER_WAVE);
    expect(survivalEnemyTier(plan.effectiveWave, "regular")).toBe("novice");
    const later = planCombat({ ...run, sector: 3 })!;
    expect(later.threatMultiplier).toBeCloseTo(ROGUELITE_THREAT_SCALE * 1.5);
    expect(later.maxRegulars).toBe(MAX_REGULARS_PER_WAVE);
    expect(survivalEnemyTier(later.effectiveWave, "regular")).toBe("average");
    const deep = { ...run, sector: 3, activeNodeId: run.map.rows[4]![0]!.id };
    expect(survivalEnemyTier(planCombat(deep)!.effectiveWave, "regular")).toBe(
      "expert",
    );
  });

  it("fields at most two regulars per wave in every sector (sector 3 flew four experts)", () => {
    expect(MAX_REGULARS_PER_WAVE).toBe(2);
  });

  it("adds elites and affixes on elite nodes and more under ascension", () => {
    const elite = planCombat(atActiveNode(RunBuilder.aRun().build(), "elite"))!;
    expect(elite.extraElites).toBe(1);
    const ascended = planCombat(
      atActiveNode(RunBuilder.aRun().withAscension(10).build(), "elite"),
    )!;
    expect(ascended.extraElites).toBe(2);
    expect(ascended.eliteAffixCount).toBe(2);
    expect(ascended.threatMultiplier).toBeCloseTo(
      ROGUELITE_THREAT_SCALE * 1.25,
    );
    expect(ascended.beltSteps).toBeGreaterThan(elite.beltSteps);
    expect(ascended.effectiveWave).toBeGreaterThan(elite.effectiveWave);
  });

  it("applies Elite Contracts to elite nodes only, as described — never to a boss", () => {
    for (const ascension of [0, 1, 10]) {
      const boss = atActiveNode(
        RunBuilder.aRun().withAscension(ascension).build(),
        "boss",
      );
      expect(planCombat(boss)!.extraElites).toBe(0);
    }
  });

  it("gives the final boss an extra phase and ascension 8 one more", () => {
    const boss = atActiveNode(RunBuilder.aRun().build(), "boss");
    expect(planCombat(boss)!.bossPhases).toBe(1);
    expect(planCombat({ ...boss, sector: 3 })!.bossPhases).toBe(2);
    expect(planCombat({ ...boss, sector: 3, ascension: 8 })!.bossPhases).toBe(
      3,
    );
    expect(planCombat({ ...boss, sector: 3 })!.isFinalBoss).toBe(true);
  });

  it("never sends the player's own faction and does field the Free Confederation", () => {
    const factions = new Set<string>();
    for (let seed = 1; seed < 80; seed++) {
      const plan = planCombat(
        atActiveNode(RunBuilder.aRun().withSeed(seed).build(), "combat"),
      )!;
      factions.add(plan.enemyFaction);
    }
    expect(factions.has("terran_hegemony")).toBe(false);
    expect(factions.has("free_confederation")).toBe(true);
  });

  it("treats an event ambush as a battle", () => {
    const run = {
      ...atActiveNode(RunBuilder.aRun().build(), "event"),
      eventCombat: { elite: true, bonus: [] },
    };
    expect(combatKindOf(run)).toBe("elite");
  });
});

describe("boss phases", () => {
  it("never squeezes the belt past the cap", () => {
    const base = {
      ...atActiveNode(RunBuilder.aRun().withAscension(10).build(), "combat"),
      sector: 3,
    };
    expect(planCombat(base)!.beltSteps).toBe(2 * 4 + 0 + 2);
    const late = { ...base, activeNodeId: base.map.rows[6]![0]!.id };
    expect(planCombat(late)!.beltSteps).toBe(MAX_BELT_STEPS);
  });

  it("starts phase 2 of a two-phase boss at half hull, only once", () => {
    expect(shouldStartNextBossPhase(2, 1, 0.6)).toBe(false);
    expect(shouldStartNextBossPhase(2, 1, 0.5)).toBe(true);
    expect(shouldStartNextBossPhase(2, 2, 0.1)).toBe(false);
    expect(shouldStartNextBossPhase(1, 1, 0.1)).toBe(false);
  });
});

describe("completeCombat", () => {
  it("persists hull damage, partly recovers shields and returns to the map", () => {
    const run = atActiveNode(RunBuilder.aRun().build(), "combat");
    const next = completeCombat(run, outcome(run));
    expect(next.flagship.hull).toBe(0.4);
    expect(next.flagship.shields).toBe(0.5);
    expect(next.activeNodeId).toBeNull();
    expect(next.currentNodeId).toBe(run.activeNodeId);
    expect(next.salvage).toBe(run.salvage + 9 + NODE_CLEAR_SALVAGE.combat!);
    expect(next.stats).toMatchObject({
      kills: 3,
      nodesCleared: 1,
      elapsedMs: 60_000,
    });
    expect(next.progression.level).toBe(2);
    expect(next.pendingRewards).toEqual([
      { kind: "power", key: run.activeNodeId },
    ]);
  });

  it("repairs survivors after the battle with Nanite Weave", () => {
    const run = {
      ...atActiveNode(RunBuilder.aRun().build(), "combat"),
      relics: ["nanite_weave"],
    };
    expect(completeCombat(run, outcome(run)).flagship.hull).toBeCloseTo(0.5);
  });

  it("drops lost escorts and counts them", () => {
    const run = atActiveNode(
      addEscort(addEscort(RunBuilder.aRun().build())),
      "combat",
    );
    const next = completeCombat(
      run,
      outcome(run, { survivors: [run.flagship, run.escorts[0]!] }),
    );
    expect(next.escorts).toHaveLength(1);
    expect(next.progression.escorts).toBe(1);
    expect(next.stats.escortsLost).toBe(run.escorts.length - 1);
  });

  it("pays an event battle's bonus after victory", () => {
    const base = atActiveNode(RunBuilder.aRun().build(), "event");
    const run = {
      ...base,
      eventCombat: {
        elite: false,
        bonus: [{ kind: "salvage", amount: 30 }] as const,
      },
    };
    const next = completeCombat(run, outcome(run, { killSalvage: 0 }));
    expect(next.salvage).toBe(run.salvage + NODE_CLEAR_SALVAGE.combat! + 30);
    expect(next.eventCombat).toBeNull();
  });

  it("queues relic + power for elites and relic, hangar, mutation, jump for bosses", () => {
    expect(rewardsFor("elite", 1, "k").map((r) => r.kind)).toEqual([
      "relic",
      "power",
    ]);
    expect(rewardsFor("boss", 1, "k").map((r) => r.kind)).toEqual([
      "relic",
      "hangar",
      "mutation",
      "nextSector",
    ]);
    expect(rewardsFor("boss", 2, "k").map((r) => r.kind)).toEqual([
      "relic",
      "hangar",
      "mutation",
      "nextSector",
    ]);
  });

  it("wins the run on the final sector's boss", () => {
    const run = {
      ...atActiveNode(RunBuilder.aRun().build(), "boss"),
      sector: 3,
    };
    const next = completeCombat(run, outcome(run, { bossesKilled: 1 }));
    expect(next.status).toBe("victory");
    expect(next.pendingRewards).toEqual([]);
  });

  it("ends the run in defeat with the cause", () => {
    const run = atActiveNode(RunBuilder.aRun().build(), "combat");
    const lost = failRun(run, "Destroyed by Void Corsairs", 30_000, 2);
    expect(lost).toMatchObject({
      status: "defeat",
      cause: "Destroyed by Void Corsairs",
    });
    expect(lost.stats.kills).toBe(2);
  });
});

describe("AI tier curve", () => {
  it("flies novices through sector 1, average pilots in sector 2 and early sector 3, experts from sector 3's fifth row", () => {
    const base = atActiveNode(RunBuilder.aRun().build(), "combat");
    const tierAt = (sector: number, row: number) => {
      const plan = planCombat({
        ...base,
        sector,
        activeNodeId: base.map.rows[row]![0]!.id,
      })!;
      return survivalEnemyTier(plan.effectiveWave, "regular");
    };
    expect(tierAt(1, 0)).toBe("novice");
    expect(tierAt(1, 5)).toBe("novice");
    expect(tierAt(2, 0)).toBe("average");
    expect(tierAt(2, 6)).toBe("average");
    expect(tierAt(3, 0)).toBe("average");
    expect(tierAt(3, 3)).toBe("average");
    expect(tierAt(3, 4)).toBe("expert");
  });
});
