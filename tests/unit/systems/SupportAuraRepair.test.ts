import { describe, it, expect } from "vitest";
import {
  resolveSupportAuras,
  FACTION_AURAS,
  SIZE_MAGNITUDE_MULTIPLIER,
  type AuraShip,
} from "../../../src/systems/SupportAura";
import { AURA_HULL_REPAIR_RATIO } from "../../../src/systems/aura/AuraRepair";

/**
 * Build an Ascendant ship fixture with sensible defaults.
 * @param over - Field overrides.
 * @returns An AuraShip.
 */
function ship(over: Partial<AuraShip>): AuraShip {
  return {
    id: "s",
    x: 0,
    y: 0,
    faction: "ascendant_empire",
    role: "heavy_fighter",
    size: "medium",
    isUnique: false,
    equippedUpgrades: [],
    hull: 4,
    shields: 0,
    maxShields: 4,
    ...over,
  };
}

const AEGIS = FACTION_AURAS.ascendant_empire.magnitude;

describe("repair aura (Aegis Field) hull repair", () => {
  it("a support ship's aegis field also repairs allied hull slowly", () => {
    const { buffs } = resolveSupportAuras([
      ship({ id: "sup", role: "support" }),
      ship({ id: "ally", x: 50 }),
    ]);
    expect(buffs.get("ally")!.hullRepairPerSecond).toBeCloseTo(
      AEGIS * AURA_HULL_REPAIR_RATIO,
      10,
    );
  });

  it("a capital's field repairs hull at its damped magnitude", () => {
    const { buffs } = resolveSupportAuras([
      ship({ id: "cap", role: "capital", size: "huge" }),
      ship({ id: "ally", x: 50 }),
    ]);
    expect(buffs.get("ally")!.hullRepairPerSecond).toBeCloseTo(
      AEGIS * SIZE_MAGNITUDE_MULTIPLIER.huge * AURA_HULL_REPAIR_RATIO,
      10,
    );
  });

  it("a hero's small aura regenerates shields but does not repair hull", () => {
    const { buffs } = resolveSupportAuras([
      ship({ id: "ace", isUnique: true }),
      ship({ id: "ally", x: 50 }),
    ]);
    expect(buffs.get("ally")!.shieldRegenPerSecond).toBeGreaterThan(0);
    expect(buffs.get("ally")!.hullRepairPerSecond).toBe(0);
  });

  it("non-repair auras repair nothing and name no repair source", () => {
    const { buffs } = resolveSupportAuras([
      ship({ id: "sup", role: "support", faction: "terran_hegemony" }),
      ship({ id: "ally", faction: "terran_hegemony", x: 50 }),
    ]);
    expect(buffs.get("ally")!.hullRepairPerSecond).toBe(0);
    expect(buffs.get("ally")!.repairSourceId).toBeNull();
  });

  it("names the strongest repairing projector as the repair source", () => {
    const { buffs } = resolveSupportAuras([
      ship({ id: "cap", role: "capital", size: "huge", x: -60 }),
      ship({ id: "sup", role: "support", x: 60 }),
      ship({ id: "ally", x: 0 }),
    ]);
    expect(buffs.get("ally")!.repairSourceId).toBe("sup");
  });
});
