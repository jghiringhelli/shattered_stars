/**
 * Spec: ally aura repairs outside Skirmish — any mode's ships become aura
 * ships (role/size from the hull, unique pilot and upgrades from the quick
 * build), faction auras resolve the same way Skirmish resolves them, and
 * the repair rates reach the scene's repair sink (ShipRepairFeedback) with
 * the projector credited, so repair drones fly ally to ally.
 */

import { describe, it, expect } from "vitest";
import {
  applyAllyAuraRepairs,
  auraShipOf,
  type AuraFieldShip,
  type AuraRepairSink,
} from "../../../../src/systems/aura/AllyAuraRepair";
import { SHIP_DEFINITIONS } from "../../../../src/data/ShipDefinitions";
import { createCapitalSystems } from "../../../../src/systems/CapitalSystems";

const DEFS = Object.values(SHIP_DEFINITIONS);
const ASCENDANT_SUPPORT = DEFS.find(
  (d) => d.faction === "ascendant_empire" && d.role === "support",
)!;
const ASCENDANT_FIGHTER = DEFS.find(
  (d) =>
    d.faction === "ascendant_empire" &&
    d.role !== "support" &&
    d.role !== "capital",
)!;
const HEGEMONY_FIGHTER = DEFS.find(
  (d) => d.faction === "terran_hegemony" && d.role === "light_fighter",
)!;

function ship(
  id: string,
  definitionId: string,
  faction: AuraFieldShip["faction"],
  x = 0,
): AuraFieldShip {
  return {
    id,
    definitionId,
    faction,
    x,
    y: 0,
    hull: 5,
    shields: 0,
    maxShields: 10,
    loadoutId: null,
  };
}

interface Call {
  readonly shipId: string;
  readonly shield: number;
  readonly hull: number;
  readonly source: string | null;
}

function recordingSink(): {
  calls: Call[];
  sink: AuraRepairSink<AuraFieldShip>;
} {
  const calls: Call[] = [];
  return {
    calls,
    sink: {
      auraRepair: (s, rates) => {
        calls.push({
          shipId: s.id,
          shield: rates.shieldRegenPerSecond,
          hull: rates.hullRepairPerSecond,
          source: rates.repairSourceId,
        });
        return true;
      },
    },
  };
}

describe("auraShipOf", () => {
  it("reads role and size from the hull definition", () => {
    const aura = auraShipOf(
      ship("a", ASCENDANT_SUPPORT.id, "ascendant_empire"),
    );
    expect(aura.role).toBe("support");
    expect(aura.size).toBe(ASCENDANT_SUPPORT.baseStats.size);
    expect(aura.isUnique).toBe(false);
    expect(aura.equippedUpgrades).toEqual([]);
    expect(aura.systemsOnline).toBe(true);
  });
});

describe("applyAllyAuraRepairs", () => {
  it("an Ascendant support ship repairs a nearby Ascendant ally, credited as the source", () => {
    const { calls, sink } = recordingSink();
    applyAllyAuraRepairs(
      [
        ship("medic", ASCENDANT_SUPPORT.id, "ascendant_empire", 0),
        ship("wing", ASCENDANT_FIGHTER.id, "ascendant_empire", 40),
      ],
      sink,
      16,
    );
    const wing = calls.find((c) => c.shipId === "wing");
    expect(wing).toBeDefined();
    expect(wing!.shield).toBeGreaterThan(0);
    expect(wing!.hull).toBeGreaterThan(0);
    expect(wing!.source).toBe("medic");
  });

  it("never repairs another faction's ship", () => {
    const { calls, sink } = recordingSink();
    applyAllyAuraRepairs(
      [
        ship("medic", ASCENDANT_SUPPORT.id, "ascendant_empire", 0),
        ship("enemy", HEGEMONY_FIGHTER.id, "terran_hegemony", 40),
      ],
      sink,
      16,
    );
    expect(calls.some((c) => c.shipId === "enemy")).toBe(false);
  });

  it("never repairs the other side in a mirror match (same faction, other owner)", () => {
    const { calls, sink } = recordingSink();
    applyAllyAuraRepairs(
      [
        {
          ...ship("medic", ASCENDANT_SUPPORT.id, "ascendant_empire", 0),
          owner: "ai",
        },
        {
          ...ship("player", ASCENDANT_FIGHTER.id, "ascendant_empire", 40),
          owner: "player",
        },
        {
          ...ship("wing", ASCENDANT_FIGHTER.id, "ascendant_empire", -40),
          owner: "ai",
        },
      ],
      sink,
      16,
    );
    expect(calls.map((c) => c.shipId)).toEqual(["wing"]);
  });

  it("never repairs a destroyed ship", () => {
    const { calls, sink } = recordingSink();
    applyAllyAuraRepairs(
      [
        ship("medic", ASCENDANT_SUPPORT.id, "ascendant_empire", 0),
        {
          ...ship("wreck", ASCENDANT_FIGHTER.id, "ascendant_empire", 40),
          hull: 0,
        },
      ],
      sink,
      16,
    );
    expect(calls).toEqual([]);
  });

  it("a capital's hull is left to its repair crews (no aura hull repair)", () => {
    const { calls, sink } = recordingSink();
    const capital = {
      ...ship("cap", ASCENDANT_FIGHTER.id, "ascendant_empire", 40),
      capitalSystems: createCapitalSystems(100),
    };
    applyAllyAuraRepairs(
      [ship("medic", ASCENDANT_SUPPORT.id, "ascendant_empire", 0), capital],
      sink,
      16,
    );
    const cap = calls.find((c) => c.shipId === "cap");
    expect(cap).toBeDefined();
    expect(cap!.hull).toBe(0);
    expect(cap!.shield).toBeGreaterThan(0);
  });

  it("does nothing without a sink and returns the resolved buffs", () => {
    const buffs = applyAllyAuraRepairs(
      [
        ship("medic", ASCENDANT_SUPPORT.id, "ascendant_empire", 0),
        ship("wing", ASCENDANT_FIGHTER.id, "ascendant_empire", 40),
      ],
      null,
      16,
    );
    expect(buffs.get("wing")?.shieldRegenPerSecond ?? 0).toBeGreaterThan(0);
  });
});
