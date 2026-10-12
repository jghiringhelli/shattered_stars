/**
 * Pilot aura abilities — specification tests: a pilot sheet's aura knobs
 * (projectsAura, auraRadiusBonus, auraMagnitudeBonus, auraStressReliefTiers,
 * auraHitChanceBonus) are read by the aura resolver, so the five support
 * abilities that used to do nothing (coordinated_assault, data_link,
 * informant, rally, force_guidance) give allies inside the pilot's aura a
 * real, distinct effect — and allies outside it get nothing.
 */

import { describe, it, expect } from "vitest";
import type { FactionId } from "../../../../src/config";
import {
  MAX_AURA_HIT_CHANCE_BONUS,
  MAX_AURA_MAGNITUDE_BONUS,
  combineEffects,
} from "../../../../src/core/CombatModifiers";
import { PILOT_ABILITY_REALTIME } from "../../../../src/data/pilotAbilityEffects";
import {
  FACTION_AURAS,
  SWARM_EVADE_PER_ALLY,
  projectionScaleFor,
  resolveSupportAuras,
  type ActiveAura,
  type AuraShip,
} from "../../../../src/systems/SupportAura";
import { auraFactsOf } from "../../../../src/systems/aura/AuraShipFacts";

/** Size multipliers are 1 for a medium hull, so radii read straight. */
const SIZE = "medium" as const;

function projector(
  faction: FactionId,
  abilityId: string | null,
  over: Partial<AuraShip> = {},
): AuraShip {
  const sheet = combineEffects(
    abilityId ? [PILOT_ABILITY_REALTIME[abilityId]!] : [{ projectsAura: true }],
  );
  return {
    id: "pilot",
    x: 0,
    y: 0,
    faction,
    role: "heavy_fighter",
    size: SIZE,
    isUnique: false,
    equippedUpgrades: [],
    hull: 4,
    shields: 0,
    maxShields: 4,
    ...auraFactsOf(sheet),
    ...over,
  };
}

function ally(faction: FactionId, x: number, id = "ally"): AuraShip {
  return {
    id,
    x,
    y: 0,
    faction,
    role: "light_fighter",
    size: "small",
    isUnique: false,
    equippedUpgrades: [],
    hull: 4,
    shields: 0,
    maxShields: 4,
  };
}

function buffAt(
  source: AuraShip,
  x: number,
  extra: AuraShip[] = [],
): ActiveAura | undefined {
  const target = ally(source.faction, x);
  return resolveSupportAuras([source, target, ...extra]).buffs.get(target.id);
}

/** A point just beyond the plain aura, inside a widened one. */
function justOutsidePlain(faction: FactionId, radiusBonus: number): number {
  return FACTION_AURAS[faction].radius * (1 + radiusBonus / 2);
}

describe("pilot sheets project the aura", () => {
  it.each([
    "coordinated_assault",
    "data_link",
    "informant",
    "rally",
    "force_guidance",
  ])(
    "%s projects at least a crew-kind aura without a crew card or unique status",
    (id) => {
      expect(projectionScaleFor(projector("terran_hegemony", id))?.kind).toBe(
        "crew",
      );
    },
  );

  it("a ship without an aura sheet or card still projects nothing", () => {
    expect(
      projectionScaleFor(
        projector("terran_hegemony", null, { projectsAura: false }),
      ),
    ).toBeNull();
  });
});

describe("coordinated_assault (allies may Focus / Target Lock)", () => {
  const faction = "terran_hegemony";
  const pilot = projector(faction, "coordinated_assault");

  it("widens the aura by 20%", () => {
    const x = justOutsidePlain(faction, 0.2);
    expect(buffAt(projector(faction, null), x)).toBeUndefined();
    expect(buffAt(pilot, x)).toBeDefined();
  });

  it("gives allies inside +5% hit chance on top of the faction damage", () => {
    expect(buffAt(pilot, 100)).toMatchObject({
      hitChanceBonus: 0.05,
      damageBonus: 1,
    });
  });

  it("gives nothing outside the aura", () => {
    expect(buffAt(pilot, FACTION_AURAS[faction].radius * 2)).toBeUndefined();
  });
});

describe("data_link (allies reroll 1 attack die)", () => {
  const faction = "synthetic_collective";
  const pilot = projector(faction, "data_link");
  const swarm = [ally(faction, 50, "drone")];

  it("strengthens the swarm mitigation by 15%", () => {
    const plain = buffAt(projector(faction, null), 100, swarm)!;
    const linked = buffAt(pilot, 100, swarm)!;
    expect(1 - linked.damageTakenMultiplier).toBeCloseTo(
      (1 - plain.damageTakenMultiplier) * 1.15,
      10,
    );
    expect(1 - plain.damageTakenMultiplier).toBeCloseTo(
      SWARM_EVADE_PER_ALLY * 2,
      10,
    );
  });

  it("widens the aura by 25%", () => {
    const x = justOutsidePlain(faction, 0.25);
    expect(buffAt(projector(faction, null), x)).toBeUndefined();
    expect(buffAt(pilot, x)).toBeDefined();
  });

  it("gives nothing outside the aura", () => {
    expect(buffAt(pilot, FACTION_AURAS[faction].radius * 2)).toBeUndefined();
  });
});

describe("informant (reveals enemy maneuvers)", () => {
  const faction = "free_confederation";
  const pilot = projector(faction, "informant");

  it("strengthens the damage reduction by 30% (20% → 26%)", () => {
    expect(buffAt(pilot, 100)?.damageTakenMultiplier).toBeCloseTo(
      1 - FACTION_AURAS[faction].magnitude * 1.3,
      10,
    );
  });

  it("gives nothing outside the aura", () => {
    expect(buffAt(pilot, FACTION_AURAS[faction].radius * 2)).toBeUndefined();
  });
});

describe("rally (removes stress from a friendly)", () => {
  const faction = "free_confederation";
  const pilot = projector(faction, "rally");

  it("eases allies' maneuvers by one stress tier inside the aura", () => {
    expect(buffAt(pilot, 100)?.stressReliefTiers).toBe(1);
    expect(buffAt(projector(faction, null), 100)?.stressReliefTiers).toBe(0);
  });

  it("widens the aura by 10%", () => {
    const x = justOutsidePlain(faction, 0.1);
    expect(buffAt(projector(faction, null), x)).toBeUndefined();
    expect(buffAt(pilot, x)?.stressReliefTiers).toBe(1);
  });

  it("gives nothing outside the aura", () => {
    expect(buffAt(pilot, FACTION_AURAS[faction].radius * 2)).toBeUndefined();
  });
});

describe("force_guidance (allies reroll attack dice)", () => {
  const faction = "ascendant_empire";
  const pilot = projector(faction, "force_guidance");

  it("strengthens the Aegis shield regen by 20%", () => {
    expect(buffAt(pilot, 100)?.shieldRegenPerSecond).toBeCloseTo(
      FACTION_AURAS[faction].magnitude * 1.2,
      10,
    );
  });

  it("widens the aura by 15%", () => {
    const x = justOutsidePlain(faction, 0.15);
    expect(buffAt(projector(faction, null), x)).toBeUndefined();
    expect(buffAt(pilot, x)).toBeDefined();
  });

  it("gives nothing outside the aura", () => {
    expect(buffAt(pilot, FACTION_AURAS[faction].radius * 2)).toBeUndefined();
  });
});

describe("the five support abilities are distinct", () => {
  it("no two of them carry the same real-time effect", () => {
    const ids = [
      "coordinated_assault",
      "data_link",
      "informant",
      "rally",
      "force_guidance",
    ];
    const effects = ids.map((id) => JSON.stringify(PILOT_ABILITY_REALTIME[id]));
    expect(new Set(effects).size).toBe(ids.length);
  });
});

describe("aura knob caps", () => {
  it("caps the stacked magnitude and hit-chance bonuses", () => {
    const sheet = combineEffects([
      { auraMagnitudeBonus: 0.4, auraHitChanceBonus: 0.08 },
      { auraMagnitudeBonus: 0.4, auraHitChanceBonus: 0.08 },
    ]);
    expect(sheet.auraMagnitudeBonus).toBe(MAX_AURA_MAGNITUDE_BONUS);
    expect(sheet.auraHitChanceBonus).toBe(MAX_AURA_HIT_CHANCE_BONUS);
  });
});
