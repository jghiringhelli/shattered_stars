/**
 * Spawn durability parity — specification tests: a ship spawns with the same
 * hull and shields in every battle mode. Skirmish / Epic Format / Scenarios
 * (spawnArcadeShip, also used by reinforcements) build ships through the same
 * getModeCombatStats + DURABILITY_SCALE path as Dogfight, Ace Duel, Boss Raid,
 * Continuous, Campaign and Flight School (getModeCombatStats "continuous" then
 * the quick build), mirrored headlessly by the skill arena and duel sims.
 * No mode keeps its own minimum-HP floors.
 */

import { describe, it, expect } from "vitest";
import {
  spawnArcadeShip,
  type ArcadePilot,
} from "../../../../src/scenes/arcadeBattle/arcadeShipFactory";
import { getModeCombatStats } from "../../../../src/data/ModeBalancing";
import { SHIP_DEFINITIONS } from "../../../../src/data/ShipDefinitions";
import { getShipLoadouts } from "../../../../src/data/ShipLoadouts";
import { spawnArenaShip } from "../../../../src/simulation/skill/ArenaShip";
import { spawnDuelSide } from "../../../../src/simulation/duelSimShips";
import { assignQuickBuilds } from "../../../../src/arcade/systems/QuickBuildEquip";
import { BotPilot } from "../../../../src/arcade/ai/BotPilot";

const PILOTS: readonly ArcadePilot[] = ["player", "wingman", "ai"];
const POSE = { x: 1000, y: 1000, angle: 0 } as const;

interface Durability {
  readonly hull: number;
  readonly maxHull: number;
  readonly shields: number;
  readonly maxShields: number;
}

function durabilityOf(ship: Durability): Durability {
  const { hull, maxHull, shields, maxShields } = ship;
  return { hull, maxHull, shields, maxShields };
}

function skirmishShip(
  definitionId: string,
  loadoutId: string | null,
  pilot: ArcadePilot,
): Durability {
  return durabilityOf(
    spawnArcadeShip({
      id: "s",
      definitionId,
      loadoutId,
      faction: "free_confederation",
      pilot,
      ...POSE,
    }),
  );
}

function diceModeShip(
  definitionId: string,
  loadoutId: string | null,
): Durability {
  return durabilityOf(
    spawnArenaShip({
      id: "a",
      side: "A",
      definitionId,
      loadoutId,
      pose: POSE,
      pilot: new BotPilot("average", { random: () => 0.5 }),
    }),
  );
}

const SHIP_IDS = Object.keys(SHIP_DEFINITIONS);

describe("spawn durability parity across modes", () => {
  it.each(PILOTS)(
    "a bare %s ship in Skirmish has the mode-balanced hull and shields of every other mode",
    (pilot) => {
      for (const definitionId of SHIP_IDS) {
        const stats = getModeCombatStats(definitionId, "continuous");
        expect(skirmishShip(definitionId, null, pilot), definitionId).toEqual({
          hull: stats.hull,
          maxHull: stats.maxHull,
          shields: stats.shields,
          maxShields: stats.maxShields,
        });
      }
    },
  );

  it("keeps no player or wingman floor for a fragile light fighter", () => {
    const fragile = "terran_stiletto";
    const bare = getModeCombatStats(fragile, "continuous");
    for (const pilot of PILOTS) {
      expect(skirmishShip(fragile, null, pilot).maxHull).toBe(bare.maxHull);
      expect(skirmishShip(fragile, null, pilot).maxShields).toBe(
        bare.maxShields,
      );
    }
  });

  it("gives every equipped quick build the same hull and shields as the dice modes", () => {
    for (const definitionId of SHIP_IDS) {
      for (const loadout of getShipLoadouts(definitionId)) {
        const label = `${definitionId}/${loadout.id}`;
        const reference = diceModeShip(definitionId, loadout.id);
        for (const pilot of PILOTS) {
          expect(skirmishShip(definitionId, loadout.id, pilot), label).toEqual(
            reference,
          );
        }
      }
    }
  });

  it("matches the duel simulator's default-build ships", () => {
    const shipIds = ["confed_sparrow", "terran_gladius", "synth_scout_drone"];
    const builds = assignQuickBuilds(shipIds);
    spawnDuelSide(1, shipIds).forEach((duelShip, index) => {
      const definitionId = shipIds[index]!;
      expect(
        skirmishShip(definitionId, builds[index] ?? null, "ai"),
        definitionId,
      ).toEqual(durabilityOf(duelShip));
    });
  });
});
