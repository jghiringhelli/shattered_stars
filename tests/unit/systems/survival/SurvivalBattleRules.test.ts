import { describe, it, expect } from "vitest";
import {
  SurvivalBattleRules,
  type EquipTarget,
} from "../../../../src/systems/survival/SurvivalBattleRules";
import { planCombat } from "../../../../src/systems/survival/CombatNodePlan";
import { maneuverDifficultyOf } from "../../../../src/systems/survival/maneuverDifficulty";
import { NEUTRAL_MODIFIERS } from "../../../../src/core/CombatModifiers";
import { DURABILITY_SCALE } from "../../../../src/config";
import { getShipDial } from "../../../../src/data/ShipDefinitions";
import { getAffix } from "../../../../src/data/survival/affixes";
import { SALVAGE_PER_KILL } from "../../../../src/data/survival/economy";
import type { RunState } from "../../../../src/systems/survival/RunTypes";
import { RunBuilder, atActiveNode } from "./survivalRunBuilder";

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
    expect(escort.modifiers.shieldRegenPerSecond).toBe(2);
  });
});

describe("SurvivalBattleRules — waves and enemies", () => {
  it("steps tiers and the belt each wave and sends the boss on a boss node's last wave", () => {
    const rules = rulesFor(atActiveNode(RunBuilder.aRun().build(), "boss"));
    const first = rules.nextWave();
    expect(first).toMatchObject({ index: 1, total: 2, isBossWave: false });
    expect(rules.onLastWave).toBe(false);
    const second = rules.nextWave();
    expect(second.isBossWave).toBe(true);
    expect(second.tierWave).toBe(first.tierWave + 1);
    expect(second.beltSteps).toBe(first.beltSteps + 1);
    expect(rules.onLastWave).toBe(true);
    expect(rules.currentWave()).toBe(second);
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
    expect(target.maxHull).toBe(Math.round(48 * 1.15));
    expect(target.maxShields).toBe(48);
    expect(dice).toBe(1);
    expect(target.modifiers.maxSpeedBonus).toBe(1);
  });

  it("flies Ace elites one tier higher", () => {
    const rules = rulesFor(atActiveNode(RunBuilder.aRun().build(), "elite"));
    const spec = rules.nextWave();
    expect(rules.tierFor(spec, "regular", [])).toBe("novice");
    expect(rules.tierFor(spec, "elite", [])).toBe("average");
    expect(rules.tierFor(spec, "elite", [getAffix("ace")!])).toBe("expert");
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
