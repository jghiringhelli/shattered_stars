/**
 * A quick build can never spawn a dead ship: a card that removes hull
 * (Jury-Rigged Deflectors, −1 hull) on a hull that has only one real-time
 * hull point used to leave it at 0 HP — destroyed before the battle began.
 */

import { describe, it, expect } from "vitest";
import { DURABILITY_SCALE } from "../../../src/config";
import { getModeCombatStats } from "../../../src/data/ModeBalancing";
import { getEquippableLoadouts } from "../../../src/data/ShipLoadouts";
import { SHIP_DEFINITIONS } from "../../../src/data/ShipDefinitions";
import { applyLoadoutEffects } from "../../../src/systems/BattleHelpers";

describe("applyLoadoutEffects", () => {
  it("never leaves a ship below one hull point", () => {
    const dead: string[] = [];
    for (const def of Object.values(SHIP_DEFINITIONS)) {
      for (const loadout of getEquippableLoadouts(def.id)) {
        const stats = { ...getModeCombatStats(def.id, "continuous") };
        const ship = {
          definitionId: def.id,
          hull: stats.hull,
          maxHull: stats.maxHull,
          shields: stats.shields,
          maxShields: stats.maxShields,
          combatStats: stats,
        };
        applyLoadoutEffects(ship, loadout.id);
        if (ship.hull < DURABILITY_SCALE) dead.push(loadout.id);
      }
    }
    expect(dead).toEqual([]);
  });
});
