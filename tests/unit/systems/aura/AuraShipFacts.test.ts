/**
 * AuraShipFacts — specification tests: a ship's folded sheet (quick build
 * upgrades + pilot ability) feeds the aura resolver in every mode, and a
 * command card's radius bonus is counted once.
 */

import { describe, it, expect } from "vitest";
import { getShipLoadouts } from "../../../../src/data/ShipLoadouts";
import { PILOT_CARDS } from "../../../../src/systems/SquadBuilder";
import {
  FACTION_AURAS,
  resolveSupportAuras,
  type AuraShip,
} from "../../../../src/systems/SupportAura";
import {
  auraFactsOf,
  auraShipFacts,
} from "../../../../src/systems/aura/AuraShipFacts";
import { applyAllyAuraRepairs } from "../../../../src/systems/aura/AllyAuraRepair";
import { resolveUpgradeModifiers } from "../../../../src/arcade/ArcadeUpgradeEffects";

const HEGEMONY = "terran_hegemony" as const;

function aura(x: number, over: Partial<AuraShip>): AuraShip {
  return {
    id: "s",
    x,
    y: 0,
    faction: HEGEMONY,
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

function covered(projector: AuraShip, x: number): boolean {
  const ally = aura(x, { id: "ally", role: "light_fighter", size: "small" });
  return resolveSupportAuras([projector, ally]).buffs.has(ally.id);
}

describe("one source for the radius bonus", () => {
  it("does not double count a command card already folded into the sheet", () => {
    const card = "tactical_officer";
    const officer = aura(0, {
      id: "officer",
      equippedUpgrades: [card],
      ...auraFactsOf(resolveUpgradeModifiers([card])),
    });
    const radius = FACTION_AURAS[HEGEMONY].radius;
    expect(covered(officer, radius * 1.2)).toBe(true);
    expect(covered(officer, radius * 1.3)).toBe(false);
  });
});

describe("auraShipFacts / every mode's aura ships", () => {
  const rallyLoadout = getShipLoadouts("confed_eagle").find(
    (lo) => PILOT_CARDS[lo.pilotId]?.abilityId === "rally",
  )!;

  it("reads the pilot ability from the quick build", () => {
    expect(auraShipFacts("confed_eagle", rallyLoadout.id)).toMatchObject({
      projectsAura: true,
      auraStressReliefTiers: 1,
    });
  });

  it("is neutral for a bare hull", () => {
    expect(auraShipFacts("confed_eagle", null)).toMatchObject({
      projectsAura: false,
      auraRadiusBonus: 0,
      auraMagnitudeBonus: 0,
      auraStressReliefTiers: 0,
      auraHitChanceBonus: 0,
    });
  });

  it("applyAllyAuraRepairs gives allies of a rally pilot its stress relief", () => {
    const base = {
      faction: "free_confederation" as const,
      y: 0,
      hull: 10,
      shields: 0,
      maxShields: 10,
    };
    const buffs = applyAllyAuraRepairs(
      [
        {
          ...base,
          id: "rex",
          definitionId: "confed_eagle",
          x: 0,
          loadoutId: rallyLoadout.id,
        },
        {
          ...base,
          id: "wing",
          definitionId: "confed_eagle",
          x: 80,
          loadoutId: null,
        },
      ],
      null,
      16,
    );
    expect(buffs.get("wing")?.stressReliefTiers).toBe(1);
  });
});
