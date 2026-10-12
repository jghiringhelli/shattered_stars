/**
 * nodeWaveRoster — the ships of one roguelite battle wave (shared by
 * SurvivalScene and the headless node sim). ADR-0004 fairness pass: a boss
 * wave fields the boss (and its phase reinforcements later) but no longer a
 * bonus expert elite on top.
 */

import { describe, it, expect } from "vitest";
import { planCombat } from "../../../../src/systems/survival/CombatNodePlan";
import {
  BOSS_WAVE_REGULARS,
  ELITE_ROLES_BY_SECTOR,
  nodeWaveRoster,
} from "../../../../src/systems/survival/NodeWaveRoster";
import { SurvivalBattleRules } from "../../../../src/systems/survival/SurvivalBattleRules";
import { SurvivalRunController } from "../../../../src/systems/survival/SurvivalRunController";
import type { RunState } from "../../../../src/systems/survival/RunTypes";
import { atActiveNode, RunBuilder } from "./survivalRunBuilder";

function waves(run: RunState, playerShips: number) {
  const plan = planCombat(run)!;
  const rules = new SurvivalBattleRules(run, plan);
  const controller = SurvivalRunController.fromState(run.seed, run.progression);
  return Array.from({ length: plan.waves }, () => {
    const spec = rules.nextWave();
    controller.beginWave();
    return {
      spec,
      slots: nodeWaveRoster({ rules, controller, spec, playerShips }),
    };
  });
}

const count = (slots: readonly { tier: string }[], tier: string) =>
  slots.filter((s) => s.tier === tier).length;

describe("nodeWaveRoster", () => {
  it("fields the sector boss alone on a boss node: no bonus elite, no regulars to squad-mark with", () => {
    for (let sector = 1; sector <= 3; sector++) {
      const base = atActiveNode(RunBuilder.aRun().build(), "boss");
      const run = { ...base, sector };
      const last = waves(run, 2).at(-1)!;
      expect(last.spec.isBossWave).toBe(true);
      expect(count(last.slots, "boss")).toBe(1);
      expect(count(last.slots, "elite")).toBe(0);
      expect(count(last.slots, "regular")).toBe(BOSS_WAVE_REGULARS);
      expect(BOSS_WAVE_REGULARS).toBe(0);
    }
  });

  it("never gives the boss ascension 1's contract elite (elite nodes get it instead)", () => {
    const boss = atActiveNode(
      RunBuilder.aRun().withAscension(1).build(),
      "boss",
    );
    const last = waves(boss, 2).at(-1)!;
    expect(count(last.slots, "elite")).toBe(0);
    expect(count(last.slots, "boss")).toBe(1);
    const elite = atActiveNode(
      RunBuilder.aRun().withAscension(1).build(),
      "elite",
    );
    expect(count(waves(elite, 2)[0]!.slots, "elite")).toBe(2);
  });

  it("gives an elite node its one elite, flying alone", () => {
    const run = atActiveNode(RunBuilder.aRun().build(), "elite");
    const [wave] = waves(run, 2);
    expect(count(wave!.slots, "elite")).toBe(1);
    expect(count(wave!.slots, "boss")).toBe(0);
    expect(count(wave!.slots, "regular")).toBe(0);
  });

  it("draws elites from the sector's roles: heavy fighters in sector 1, gunships only as a sector-3 fallback", () => {
    const base = atActiveNode(RunBuilder.aRun().build(), "elite");
    const roleOf = (sector: number) => {
      const run = { ...base, sector };
      const rules = new SurvivalBattleRules(run, planCombat(run)!);
      const [wave] = waves(run, 2);
      const elite = wave!.slots.find((s) => s.tier === "elite")!;
      return rules
        .roster(rules.plan.enemyFaction)
        .find((ship) => ship.id === elite.definitionId)!.role;
    };
    expect(roleOf(1)).toBe(ELITE_ROLES_BY_SECTOR[1]![0]);
    expect(roleOf(1)).toBe("heavy_fighter");
    expect(roleOf(3)).toBe("bomber");
    expect(ELITE_ROLES_BY_SECTOR[1]).not.toContain("gunship");
    expect(ELITE_ROLES_BY_SECTOR[2]).not.toContain("gunship");
    expect(ELITE_ROLES_BY_SECTOR[3]!.at(-1)).toBe("gunship");
  });

  it("gives a combat node regulars only", () => {
    const run = atActiveNode(RunBuilder.aRun().build(), "combat");
    const [wave] = waves(run, 2);
    expect(count(wave!.slots, "elite")).toBe(0);
    expect(count(wave!.slots, "regular")).toBeGreaterThanOrEqual(1);
  });
});
