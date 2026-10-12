/**
 * ArenaWeapons — the skill arena's ships carry their quick-build
 * secondaries (missiles, torpedoes, bombs, mines, turrets, cloaks) through
 * the shared WeaponsDriver, and the bots use them as in the scenes. Hits go
 * shields first, then hull, and kills score like primary kills.
 */
import { describe, it, expect } from "vitest";
import { BotPilot } from "../../../../src/arcade/ai/BotPilot";
import { HitImmunityLedger } from "../../../../src/arcade/systems/CombatTempo";
import { NO_SQUAD_MARKS } from "../../../../src/arcade/systems/SquadMark";
import { BATTLEFIELD_SIZE } from "../../../../src/config";
import { createSideScore } from "../../../../src/systems/arena/BattleScore";
import {
  emptyTally,
  type CombatState,
} from "../../../../src/simulation/skill/ArenaCombat";
import { ENGINE_RULES } from "../../../../src/simulation/skill/ArenaRules";
import { spawnArenaShip } from "../../../../src/simulation/skill/ArenaShip";
import {
  applyOrdnanceHit,
  armArena,
} from "../../../../src/simulation/skill/ArenaWeapons";
import { runBattle } from "../../../../src/simulation/skill/SkillArena";

function stateWith(): CombatState {
  const random = () => 0.5;
  const ship = (id: string, side: "A" | "B", y: number) =>
    spawnArenaShip({
      id,
      side,
      definitionId: "terran_gladius",
      pose: { x: 3000, y, angle: 0 },
      pilot: new BotPilot("average", { random }),
    });
  return {
    ships: [ship("A0", "A", 3000), ship("B0", "B", 2800)],
    ledger: new HitImmunityLedger(),
    rules: ENGINE_RULES,
    worldSize: BATTLEFIELD_SIZE,
    random,
    scores: { A: createSideScore(), B: createSideScore() },
    tallies: { A: emptyTally(), B: emptyTally() },
    recentHits: new Map(),
    marks: NO_SQUAD_MARKS,
  };
}

function torpedoHit(damage: number) {
  return {
    kind: "hit" as const,
    attackerId: "A0",
    targetId: "B0",
    weapon: "torpedo" as const,
    damage,
    stress: 0,
  };
}

describe("ArenaWeapons", () => {
  it("arms_every_ship_from_its_quick_build", () => {
    const state = stateWith();
    const driver = armArena(state);
    expect(driver.runtime.arsenalOf("A0")?.slots.length).toBeGreaterThan(0);
    expect(state.weapons).toBe(driver);
  });

  it("an_ordnance_hit_takes_shields_first_then_hull", () => {
    const state = stateWith();
    const target = state.ships[1]!;
    target.shields = 10;
    target.hull = 30;
    applyOrdnanceHit(state, torpedoHit(25), 0);
    expect(target.shields).toBe(0);
    expect(target.hull).toBe(15);
    expect(state.tallies.A.damage).toBe(25);
    expect(state.tallies.A.ordnanceHits).toBe(1);
    expect(state.tallies.A.hits).toBe(0);
  });

  it("an_ordnance_kill_scores_for_the_attacker", () => {
    const state = stateWith();
    applyOrdnanceHit(state, torpedoHit(10_000), 0);
    expect(state.ships[1]!.alive).toBe(false);
    expect(state.tallies.A.kills).toBe(1);
  });

  it("bots_fly_their_quick_build_secondaries_in_arena_battles", () => {
    // The Vindicator's build carries missiles and a turret.
    let ordnanceHits = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const result = runBattle({
        A: {
          ships: [{ definitionId: "terran_vindicator", tier: "average" }],
          squad: null,
        },
        B: {
          ships: [{ definitionId: "terran_gladius", tier: "average" }],
          squad: null,
        },
        seed,
      });
      ordnanceHits += result.tallies.A.ordnanceHits;
    }
    expect(ordnanceHits).toBeGreaterThan(0);
  });
});
