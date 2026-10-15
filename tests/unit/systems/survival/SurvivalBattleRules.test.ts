import { describe, it, expect } from "vitest";
import {
  SurvivalBattleRules,
  type EquipTarget,
} from "../../../../src/systems/survival/SurvivalBattleRules";
import {
  planCombat,
  WAVES_PER_NODE,
} from "../../../../src/systems/survival/CombatNodePlan";
import { maneuverDifficultyOf } from "../../../../src/systems/survival/maneuverDifficulty";
import { NEUTRAL_MODIFIERS } from "../../../../src/core/CombatModifiers";
import { DURABILITY_SCALE } from "../../../../src/config";
import { getShipDial } from "../../../../src/data/ShipDefinitions";
import { getAffix } from "../../../../src/data/survival/affixes";
import { BASE_ENEMY_HULL_MULTIPLIER } from "../../../../src/data/survival/ascension";
import { SALVAGE_PER_KILL } from "../../../../src/data/survival/economy";
import type { RunState } from "../../../../src/systems/survival/RunTypes";
import { RunBuilder, atActiveNode } from "./survivalRunBuilder";

/** Hardened Hulls (ascension 5): enemy hull ×1.15 on top of the base. */
const HARDENED_HULLS = 1.1;

function rulesFor(run: RunState): SurvivalBattleRules {
  return new SurvivalBattleRules(run, planCombat(run)!);
}

function ship(patch: Partial<EquipTarget> = {}): EquipTarget {
  return {
    hull: 48,
    maxHull: 48,
    shields: 24,
    maxShields: 24,
    modifiers: NEUTRAL_MODIFIERS,
    ...patch,
  };
}

describe("SurvivalBattleRules — the player's fleet", () => {
  it("spawns ships with their persisted hull and shield damage", () => {
    const base = atActiveNode(RunBuilder.aRun().build(), "combat");
    const run = {
      ...base,
      flagship: { ...base.flagship, hull: 0.5, shields: 0.25 },
    };
    const target = ship();
    rulesFor(run).equipPlayer(target, "flagship", run.flagship);
    expect(target.hull).toBe(24);
    expect(target.shields).toBe(6);
  });

  it("adds upgrade hull and damage, and mutation hull scaling for the flagship", () => {
    const base = atActiveNode(RunBuilder.aRun().build(), "combat");
    const run = { ...base, mutations: { systems: "juggernaut_plating" } };
    const target = ship();
    rulesFor(run).equipPlayer(target, "flagship", {
      ...run.flagship,
      upgrades: 2,
    });
    expect(target.maxHull).toBe(Math.round((48 + 2 * DURABILITY_SCALE) * 1.25));
    expect(target.modifiers.laserDamageBonus).toBe(2);
    expect(target.modifiers.damageTakenMultiplier).toBeCloseTo(0.7);
  });

  it("switches off passive shield regen for a Reactive Shields flagship only", () => {
    const base = atActiveNode(RunBuilder.aRun().build(), "combat");
    const run = {
      ...base,
      relics: ["regen_lattice"],
      mutations: { systems: "reactive_shields" },
    };
    const flagship = ship();
    const escort = ship();
    const rules = rulesFor(run);
    rules.equipPlayer(flagship, "flagship", run.flagship);
    rules.equipPlayer(escort, "escort", run.flagship);
    expect(flagship.modifiers.shieldRegenPerSecond).toBe(0);
    expect(escort.modifiers.shieldRegenPerSecond).toBe(0.04);
  });
});

describe("SurvivalBattleRules — waves and enemies", () => {
  it("sends the boss on a boss node's last wave, after its regular patrols (its phases bring the reinforcements)", () => {
    const rules = rulesFor(atActiveNode(RunBuilder.aRun().build(), "boss"));
    expect(rules.plan.waves).toBe(WAVES_PER_NODE.boss);
    for (let i = 1; i < WAVES_PER_NODE.boss; i++) {
      expect(rules.nextWave()).toMatchObject({ index: i, isBossWave: false });
      expect(rules.onLastWave).toBe(false);
    }
    const last = rules.nextWave();
    expect(last).toMatchObject({
      index: WAVES_PER_NODE.boss,
      total: WAVES_PER_NODE.boss,
      isBossWave: true,
    });
    expect(rules.onLastWave).toBe(true);
    expect(rules.currentWave()).toBe(last);
  });

  it("keeps the node's pilot tier and belt on every wave (no squeeze mid-node)", () => {
    const run = atActiveNode(RunBuilder.aRun().build(), "boss");
    const rules = new SurvivalBattleRules(run, {
      ...planCombat(run)!,
      waves: 2,
    });
    const first = rules.nextWave();
    expect(first).toMatchObject({ index: 1, total: 2, isBossWave: false });
    expect(rules.onLastWave).toBe(false);
    const second = rules.nextWave();
    expect(second.isBossWave).toBe(true);
    expect(second.tierWave).toBe(first.tierWave);
    expect(second.tierWave).toBe(rules.plan.effectiveWave);
    expect(second.beltSteps).toBe(first.beltSteps);
    expect(second.beltSteps).toBe(rules.plan.beltSteps);
    expect(rules.onLastWave).toBe(true);
    expect(rules.currentWave()).toBe(second);
  });

  it("flies the sector boss at its sector's boss tier: average in sector 1, expert after", () => {
    const base = atActiveNode(RunBuilder.aRun().build(), "boss");
    const tierIn = (sector: number) => {
      const rules = rulesFor({ ...base, sector });
      return rules.tierFor(rules.nextWave(), "boss", []);
    };
    expect(tierIn(1)).toBe("average");
    expect(tierIn(2)).toBe("expert");
    expect(tierIn(3)).toBe("expert");
  });

  it("never fields capital ships as wave ships", () => {
    const rules = rulesFor(atActiveNode(RunBuilder.aRun().build(), "combat"));
    expect(
      rules.roster("void_corsairs").some((s) => s.role === "capital"),
    ).toBe(false);
    expect(rules.roster("void_corsairs").length).toBeGreaterThan(5);
  });

  it("applies affixes and ascension hull to enemies", () => {
    const rules = rulesFor(
      atActiveNode(RunBuilder.aRun().withAscension(5).build(), "elite"),
    );
    const target = ship();
    const dice = rules.equipEnemy(target, [
      getAffix("shielded")!,
      getAffix("marksman")!,
      getAffix("swift")!,
    ]);
    expect(target.maxHull).toBe(
      Math.round(48 * BASE_ENEMY_HULL_MULTIPLIER * HARDENED_HULLS),
    );
    expect(target.maxShields).toBe(48);
    expect(dice).toBe(1);
    expect(target.modifiers.maxSpeedBonus).toBe(1);
  });

  it("flies Ace elites one tier higher", () => {
    const rules = rulesFor(atActiveNode(RunBuilder.aRun().build(), "elite"));
    const spec = rules.nextWave();
    expect(rules.tierFor(spec, "regular", [])).toBe("novice");
    expect(rules.tierFor(spec, "elite", [])).toBe("novice");
    expect(rules.tierFor(spec, "elite", [getAffix("ace")!])).toBe("average");
  });
});

describe("SurvivalBattleRules — outcome", () => {
  it("banks kills by rank and reports survivors as hull fractions", () => {
    const run = atActiveNode(RunBuilder.aRun().build(), "combat");
    const rules = rulesFor(run);
    rules.registerEnemy("e1", "regular");
    rules.registerEnemy("e2", "elite");
    expect(rules.recordKill("e1")).toBe(SALVAGE_PER_KILL.regular);
    rules.recordKill("e2");
    expect(rules.salvageEarned).toBe(
      SALVAGE_PER_KILL.regular + SALVAGE_PER_KILL.elite,
    );
    const outcome = rules.outcome(
      [
        {
          record: run.flagship,
          hull: 30,
          maxHull: 60,
          shields: 0,
          maxShields: 24,
        },
      ],
      2,
      1234,
    );
    expect(outcome).toMatchObject({
      kills: 2,
      elitesKilled: 1,
      progressionLevel: 2,
      durationMs: 1234,
    });
    expect(outcome.survivors[0]).toMatchObject({ hull: 0.5, shields: 0 });
  });
});

describe("maneuverDifficultyOf", () => {
  it("reads the dial colour and treats off-dial templates as red", () => {
    const dial = getShipDial("terran_viper");
    const known = dial[0]!;
    expect(maneuverDifficultyOf(dial, known.direction, known.speed)).toBe(
      known.difficulty,
    );
    expect(maneuverDifficultyOf(dial, "straight", 99)).toBe("red");
    expect(maneuverDifficultyOf(dial, "drift_left", 3)).toBe("white");
  });
});
