/**
 * Spec: a Survival boss node fights the creature of its sector — the same
 * node battle, with the creature telegraphing and landing powers on the
 * fleet, its phases following the plan's phases plus its enrage, the
 * boss's kill counting as the boss kill, and the whole fight deterministic.
 */

import { describe, it, expect } from "vitest";
import { flagshipLoadout } from "../../../src/arcade/systems/SurvivalLoadouts";
import { SURVIVAL_SECTOR_BOSSES } from "../../../src/data/creatures/creatureCatalog";
import { simulateNodeBattle } from "../../../src/simulation/survival/SurvivalNodeSim";
import { CREATURE_EXTRA_PHASES } from "../../../src/data/creatures/creatureCatalog";
import { planCombat } from "../../../src/systems/survival/CombatNodePlan";
import { createRun } from "../../../src/systems/survival/RunState";
import type { RunState } from "../../../src/systems/survival/RunTypes";

function bossRun(seed: number, sector: number): RunState {
  const run = createRun({
    seed,
    faction: "terran_hegemony",
    flagshipId: "terran_viper",
    loadoutId: flagshipLoadout("terran_viper", null),
    ascension: 0,
    unlocked: [],
    now: 0,
  });
  const bossNode = run.map.rows.flat().find((n) => n.type === "boss")!;
  // A veteran wing: the boss wave must be reached for the creature to fight.
  const escorts = Array.from({ length: 5 }, () => run.escorts[0]!);
  return {
    ...run,
    sector,
    escorts,
    activeNodeId: bossNode.id,
    activeKind: "boss",
  };
}

describe("boss node plan", () => {
  it("names_the_creature_of_each_sector_and_adds_its_enrage_phase", () => {
    [1, 2, 3].forEach((sector, index) => {
      const plan = planCombat(bossRun(5, sector))!;
      expect(plan.creatureBoss?.id).toBe(SURVIVAL_SECTOR_BOSSES[index]);
      expect(plan.creatureBoss?.phases).toBe(
        plan.bossPhases + CREATURE_EXTRA_PHASES,
      );
    });
  });

  it("has_no_creature_boss_on_a_combat_node", () => {
    const run = bossRun(5, 1);
    expect(
      planCombat({ ...run, activeKind: "combat" })?.creatureBoss,
    ).toBeNull();
  });
});

describe("a creature boss node", () => {
  const run = bossRun(11, 1);
  const battle = simulateNodeBattle(run);

  it("fights_the_sector_creature_and_it_telegraphs_and_lands_powers", () => {
    expect(battle.bossCreatureId).toBe("cinder_wyrm");
    expect(battle.creatures.telegraphs).toBeGreaterThan(0);
    expect(battle.creatures.powersLanded).toBeGreaterThan(0);
  });

  it("terminates_inside_the_time_limit", () => {
    expect(battle.timedOut).toBe(false);
  });

  it("is_deterministic_for_a_run", () => {
    const again = simulateNodeBattle(run);
    expect(again.durationMs).toBe(battle.durationMs);
    expect(again.creatures).toEqual(battle.creatures);
  });

  it("can_still_fight_the_legacy_capital_boss_for_comparison", () => {
    const legacy = simulateNodeBattle(run, { creatureBosses: false });
    expect(legacy.creatures.telegraphs).toBe(0);
  });
});

describe("an event battle with a creature", () => {
  const base = bossRun(21, 1);
  const combatNode = base.map.rows.flat().find((n) => n.type === "combat")!;
  const run: RunState = {
    ...base,
    activeNodeId: combatNode.id,
    activeKind: "combat",
    eventCombat: { elite: false, bonus: [], creature: "tidecell" },
  };

  it("plans_the_creature_for_the_last_wave", () => {
    expect(planCombat(run)?.eventCreature).toBe("tidecell");
    expect(planCombat({ ...run, eventCombat: null })?.eventCreature).toBeNull();
  });

  it("fights_it_with_its_own_telegraphed_powers", () => {
    const result = simulateNodeBattle(run);
    expect(result.bossCreatureId).toBeNull();
    expect(result.creatures.telegraphs).toBeGreaterThan(0);
  });
});
