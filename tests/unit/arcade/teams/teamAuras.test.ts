import { describe, expect, it } from "vitest";
import { resolveTeamAuras } from "../../../../src/arcade/teams";
import { AURA_STACKING } from "../../../../src/systems/aura/FactionAuras";
import type { AuraShip } from "../../../../src/systems/SupportAura";

function ship(
  over: Partial<AuraShip> & { readonly id: string; readonly team: number },
): AuraShip & { readonly team: number } {
  return {
    x: 0,
    y: 0,
    faction: "terran_hegemony",
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

describe("resolveTeamAuras — support auras stay inside a team", () => {
  it("a support ship covers a same-faction teammate", () => {
    const { coveredShipIds } = resolveTeamAuras([
      ship({ id: "sup", team: 0, role: "support" }),
      ship({ id: "mate", team: 0, x: 100 }),
    ]);
    expect(coveredShipIds.has("mate")).toBe(true);
  });

  it("never covers a same-faction enemy (mirror match)", () => {
    const { coveredShipIds, buffs } = resolveTeamAuras([
      ship({ id: "sup", team: 0, role: "support" }),
      ship({ id: "foe", team: 1, x: 100 }),
    ]);
    expect(coveredShipIds.has("foe")).toBe(false);
    expect(buffs.has("foe")).toBe(false);
  });

  const mixedPair = [
    ship({ id: "sup", team: 0, role: "support" }),
    ship({ id: "mate", team: 0, faction: "void_corsairs", x: 100 }),
  ];

  it("covers a teammate of another faction only at the mixed-team share (a coalition partner)", () => {
    const previous = AURA_STACKING.mixedTeamShare;
    try {
      AURA_STACKING.mixedTeamShare = 0;
      expect(resolveTeamAuras(mixedPair).coveredShipIds.has("mate")).toBe(
        false,
      );
      AURA_STACKING.mixedTeamShare = 0.5;
      const { buffs, coveredShipIds } = resolveTeamAuras(mixedPair);
      expect(coveredShipIds.has("mate")).toBe(true);
      const full = resolveTeamAuras([
        mixedPair[0]!,
        ship({ id: "mate", team: 0, x: 100 }),
      ]).buffs.get("mate")!;
      const share = buffs.get("mate")!;
      expect(share.damageBonus).toBeCloseTo(full.damageBonus * 0.5);
    } finally {
      AURA_STACKING.mixedTeamShare = previous;
    }
  });

  it("never covers an enemy of another faction", () => {
    const { coveredShipIds } = resolveTeamAuras([
      ship({ id: "sup", team: 0, role: "support" }),
      ship({ id: "foe", team: 1, faction: "void_corsairs", x: 100 }),
    ]);
    expect(coveredShipIds.has("foe")).toBe(false);
  });

  it("resolves every team's auras in the same pass", () => {
    const { coveredShipIds } = resolveTeamAuras([
      ship({ id: "supA", team: 0, role: "support" }),
      ship({ id: "a", team: 0, x: 100 }),
      ship({ id: "supB", team: 1, role: "support", x: 5000 }),
      ship({ id: "b", team: 1, x: 5100 }),
    ]);
    expect(coveredShipIds.has("a")).toBe(true);
    expect(coveredShipIds.has("b")).toBe(true);
  });
});
