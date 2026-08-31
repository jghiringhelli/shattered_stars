import { describe, it, expect } from "vitest";
import {
  resolveSupportAuras,
  alliesCoveredWithinRadius,
  FACTION_AURAS,
  SWARM_EVADE_PER_ALLY,
  SWARM_EVADE_CAP,
  MIN_DAMAGE_TAKEN_MULTIPLIER,
  type AuraShip,
} from "../../../src/systems/SupportAura";

/**
 * Build a ship fixture with sensible defaults.
 * @param over - Field overrides.
 * @returns An AuraShip.
 */
function ship(over: Partial<AuraShip>): AuraShip {
  return {
    id: "s",
    x: 0,
    y: 0,
    faction: "terran_hegemony",
    role: "heavy_fighter",
    hull: 4,
    shields: 0,
    maxShields: 4,
    ...over,
  };
}

describe("FACTION_AURAS", () => {
  it("defines a unique effect for every faction", () => {
    const effects = Object.values(FACTION_AURAS).map((a) => a.effect);
    expect(new Set(effects).size).toBe(effects.length);
  });

  it("keeps shield regen the smallest radius (most powerful effect)", () => {
    const aegis = FACTION_AURAS.ascendant_empire;
    const others = Object.values(FACTION_AURAS).filter(
      (a) => a.effect !== "shield_regen",
    );
    expect(others.every((a) => a.radius >= aegis.radius)).toBe(true);
  });
});

describe("resolveSupportAuras", () => {
  it("marks an ally within radius as covered", () => {
    const ships = [
      ship({ id: "sup", role: "support", x: 0, y: 0 }),
      ship({ id: "ally", x: 100, y: 0 }),
    ];
    const { coveredShipIds } = resolveSupportAuras(ships);
    expect(coveredShipIds.has("ally")).toBe(true);
  });

  it("does not cover an ally beyond the faction radius", () => {
    const ships = [
      ship({ id: "sup", role: "support", x: 0, y: 0 }),
      ship({ id: "ally", x: FACTION_AURAS.terran_hegemony.radius + 50, y: 0 }),
    ];
    const { coveredShipIds } = resolveSupportAuras(ships);
    expect(coveredShipIds.has("ally")).toBe(false);
  });

  it("does not cover ships of a different faction", () => {
    const ships = [
      ship({
        id: "sup",
        role: "support",
        faction: "terran_hegemony",
        x: 0,
        y: 0,
      }),
      ship({ id: "foe", faction: "void_corsairs", x: 50, y: 0 }),
    ];
    const { coveredShipIds } = resolveSupportAuras(ships);
    expect(coveredShipIds.has("foe")).toBe(false);
  });

  it("does not buff a support ship with its own aura", () => {
    const ships = [ship({ id: "sup", role: "support", x: 0, y: 0 })];
    const { coveredShipIds } = resolveSupportAuras(ships);
    expect(coveredShipIds.has("sup")).toBe(false);
  });

  it("ignores dead support ships", () => {
    const ships = [
      ship({ id: "sup", role: "support", hull: 0, x: 0, y: 0 }),
      ship({ id: "ally", x: 50, y: 0 }),
    ];
    const { coveredShipIds } = resolveSupportAuras(ships);
    expect(coveredShipIds.size).toBe(0);
  });

  it("returns empty result when there are no support ships", () => {
    const ships = [
      ship({ id: "a", x: 0, y: 0 }),
      ship({ id: "b", x: 10, y: 0 }),
    ];
    const { buffs, coveredShipIds } = resolveSupportAuras(ships);
    expect(coveredShipIds.size).toBe(0);
    expect(buffs.size).toBe(0);
  });
});

describe("faction aura effects", () => {
  it("Terran Coordinated Fire grants a flat damage bonus", () => {
    const ships = [
      ship({
        id: "sup",
        role: "support",
        faction: "terran_hegemony",
        x: 0,
        y: 0,
      }),
      ship({ id: "ally", faction: "terran_hegemony", x: 50, y: 0 }),
    ];
    const { buffs } = resolveSupportAuras(ships);
    expect(buffs.get("ally")!.damageBonus).toBe(
      FACTION_AURAS.terran_hegemony.magnitude,
    );
  });

  it("Confederation Rallying Banner reduces incoming damage", () => {
    const ships = [
      ship({
        id: "sup",
        role: "support",
        faction: "free_confederation",
        x: 0,
        y: 0,
      }),
      ship({ id: "ally", faction: "free_confederation", x: 50, y: 0 }),
    ];
    const { buffs } = resolveSupportAuras(ships);
    expect(buffs.get("ally")!.damageTakenMultiplier).toBeCloseTo(0.8, 5);
  });

  it("Ascendant Aegis Field regenerates shields slowly", () => {
    const ships = [
      ship({
        id: "sup",
        role: "support",
        faction: "ascendant_empire",
        x: 0,
        y: 0,
      }),
      ship({ id: "ally", faction: "ascendant_empire", x: 50, y: 0 }),
    ];
    const { buffs } = resolveSupportAuras(ships);
    const regen = buffs.get("ally")!.shieldRegenPerSecond;
    expect(regen).toBe(FACTION_AURAS.ascendant_empire.magnitude);
    expect(regen).toBeLessThanOrEqual(0.25);
  });

  it("Corsairs Raider's Cadence eases maneuver stress by a tier", () => {
    const ships = [
      ship({
        id: "sup",
        role: "support",
        faction: "void_corsairs",
        x: 0,
        y: 0,
      }),
      ship({ id: "ally", faction: "void_corsairs", x: 50, y: 0 }),
    ];
    const { buffs } = resolveSupportAuras(ships);
    expect(buffs.get("ally")!.stressReliefTiers).toBe(1);
  });

  it("Synthetic Hive Resilience mitigation grows with swarm size", () => {
    const near = (id: string, x: number): AuraShip =>
      ship({ id, faction: "synthetic_collective", x, y: 0 });
    const smallSwarm = [
      ship({
        id: "sup",
        role: "support",
        faction: "synthetic_collective",
        x: 0,
        y: 0,
      }),
      near("a", 40),
      near("b", 60),
    ];
    const bigSwarm = [
      ...smallSwarm,
      near("c", 80),
      near("d", 100),
      near("e", 120),
    ];
    const small = resolveSupportAuras(smallSwarm).buffs.get("a")!;
    const big = resolveSupportAuras(bigSwarm).buffs.get("a")!;
    expect(big.damageTakenMultiplier).toBeLessThan(small.damageTakenMultiplier);
  });

  it("caps swarm mitigation at the configured cap", () => {
    const members: AuraShip[] = [
      ship({
        id: "sup",
        role: "support",
        faction: "synthetic_collective",
        x: 0,
        y: 0,
      }),
    ];
    for (let i = 0; i < 20; i++) {
      members.push(
        ship({ id: `d${i}`, faction: "synthetic_collective", x: 10 + i, y: 0 }),
      );
    }
    const buff = resolveSupportAuras(members).buffs.get("d0")!;
    expect(buff.damageTakenMultiplier).toBeCloseTo(1 - SWARM_EVADE_CAP, 5);
  });

  it("never reduces incoming damage below the safety floor", () => {
    expect(1 - SWARM_EVADE_CAP).toBeGreaterThanOrEqual(
      MIN_DAMAGE_TAKEN_MULTIPLIER,
    );
    expect(SWARM_EVADE_PER_ALLY).toBeGreaterThan(0);
  });
});

describe("alliesCoveredWithinRadius", () => {
  it("returns allies within an arbitrary radius of a support ship", () => {
    const ships = [
      ship({ id: "sup", role: "support", x: 0, y: 0 }),
      ship({ id: "near", x: 100, y: 0 }),
      ship({ id: "far", x: 500, y: 0 }),
    ];
    const covered = alliesCoveredWithinRadius(ships, 200);
    expect(covered.has("near")).toBe(true);
    expect(covered.has("far")).toBe(false);
  });
});
