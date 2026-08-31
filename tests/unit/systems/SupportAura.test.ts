import { describe, it, expect } from "vitest";
import {
  resolveSupportAuras,
  DEFAULT_AURA_PARAMS,
  AURA_RADIUS_DEFAULT,
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

describe("resolveSupportAuras", () => {
  it("covers an ally within radius of a support ship", () => {
    const ships = [
      ship({ id: "sup", role: "support", x: 0, y: 0 }),
      ship({ id: "ally", x: 100, y: 0 }),
    ];
    const result = resolveSupportAuras(ships, 16.67, DEFAULT_AURA_PARAMS);
    expect(result.coveredShipIds.has("ally")).toBe(true);
  });

  it("does not cover an ally beyond the radius", () => {
    const ships = [
      ship({ id: "sup", role: "support", x: 0, y: 0 }),
      ship({ id: "ally", x: AURA_RADIUS_DEFAULT + 50, y: 0 }),
    ];
    const result = resolveSupportAuras(ships, 16.67);
    expect(result.coveredShipIds.has("ally")).toBe(false);
  });

  it("does not cover enemies of a different faction", () => {
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
    const result = resolveSupportAuras(ships, 16.67);
    expect(result.coveredShipIds.has("foe")).toBe(false);
  });

  it("does not cover a support ship with itself", () => {
    const ships = [ship({ id: "sup", role: "support", x: 0, y: 0 })];
    const result = resolveSupportAuras(ships, 16.67);
    expect(result.coveredShipIds.has("sup")).toBe(false);
  });

  it("ignores dead support ships", () => {
    const ships = [
      ship({ id: "sup", role: "support", hull: 0, x: 0, y: 0 }),
      ship({ id: "ally", x: 50, y: 0 }),
    ];
    const result = resolveSupportAuras(ships, 16.67);
    expect(result.coveredShipIds.size).toBe(0);
  });

  it("regenerates shields for covered allies below max", () => {
    const ships = [
      ship({ id: "sup", role: "support", x: 0, y: 0 }),
      ship({ id: "ally", x: 50, y: 0, shields: 1, maxShields: 4 }),
    ];
    const result = resolveSupportAuras(ships, 1000, {
      radius: 220,
      shieldRegenPerSecond: 0.5,
    });
    expect(result.shieldGain.get("ally")).toBeCloseTo(0.5, 5);
  });

  it("caps shield gain at maxShields headroom", () => {
    const ships = [
      ship({ id: "sup", role: "support", x: 0, y: 0 }),
      ship({ id: "ally", x: 50, y: 0, shields: 3.9, maxShields: 4 }),
    ];
    const result = resolveSupportAuras(ships, 1000, {
      radius: 220,
      shieldRegenPerSecond: 0.5,
    });
    expect(result.shieldGain.get("ally")).toBeCloseTo(0.1, 5);
  });

  it("emits no shield gain for a fully shielded ally", () => {
    const ships = [
      ship({ id: "sup", role: "support", x: 0, y: 0 }),
      ship({ id: "ally", x: 50, y: 0, shields: 4, maxShields: 4 }),
    ];
    const result = resolveSupportAuras(ships, 1000, {
      radius: 220,
      shieldRegenPerSecond: 0.5,
    });
    expect(result.shieldGain.has("ally")).toBe(false);
    expect(result.coveredShipIds.has("ally")).toBe(true);
  });

  it("returns empty result when there are no support ships", () => {
    const ships = [
      ship({ id: "a", x: 0, y: 0 }),
      ship({ id: "b", x: 10, y: 0 }),
    ];
    const result = resolveSupportAuras(ships, 16.67);
    expect(result.coveredShipIds.size).toBe(0);
    expect(result.shieldGain.size).toBe(0);
  });
});
