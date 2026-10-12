/**
 * Pilot ability real-time effects — invariants on the catalogue and on the
 * price derived from each effect.
 */

import { describe, it, expect } from "vitest";
import { PILOT_ABILITY_REALTIME } from "../../../src/data/pilotAbilityEffects";
import { abilityPointValue } from "../../../src/data/abilityPricing";
import { derivePilotSurcharge } from "../../../src/data/pilotPricing";
import { PILOT_CARDS } from "../../../src/systems/SquadBuilder";
import { PILOT_ABILITIES } from "../../../src/systems/PilotAbilities";
import {
  combineEffects,
  NEUTRAL_MODIFIERS,
} from "../../../src/core/CombatModifiers";

const abilitiesOnCards = [
  ...new Set(
    Object.values(PILOT_CARDS)
      .map((card) => card.abilityId)
      .filter((id): id is string => id !== undefined),
  ),
];

describe("pilot ability real-time effects", () => {
  it("every ability on a pilot card has a real-time effect", () => {
    const missing = abilitiesOnCards.filter(
      (id) => !PILOT_ABILITY_REALTIME[id],
    );
    expect(missing).toEqual([]);
  });

  it("every effect changes at least one knob", () => {
    const inert = Object.entries(PILOT_ABILITY_REALTIME)
      .filter(([, effect]) => {
        const sheet = combineEffects([effect]);
        return JSON.stringify(sheet) === JSON.stringify(NEUTRAL_MODIFIERS);
      })
      .map(([id]) => id);
    expect(inert).toEqual([]);
  });

  it("every effect belongs to a defined ability", () => {
    const orphans = Object.keys(PILOT_ABILITY_REALTIME).filter(
      (id) => !PILOT_ABILITIES[id],
    );
    expect(orphans).toEqual([]);
  });

  it("no two abilities play identically", () => {
    const seen = new Map<string, string>();
    const twins: string[] = [];
    for (const [id, effect] of Object.entries(PILOT_ABILITY_REALTIME)) {
      const key = JSON.stringify(combineEffects([effect]));
      const twin = seen.get(key);
      if (twin) twins.push(`${twin} = ${id}`);
      seen.set(key, id);
    }
    expect(twins).toEqual([]);
  });
});

describe("abilityPointValue", () => {
  it("+1 unconditional laser damage is worth 5", () => {
    expect(abilityPointValue({ laserDamageBonus: 1 })).toBe(5);
  });

  it("a conditional bonus is worth less than the unconditional one", () => {
    expect(abilityPointValue({ rearArcLaserBonus: 1 })).toBeLessThan(
      abilityPointValue({ laserDamageBonus: 1 }),
    );
  });

  it("40% faster recharge on one action is worth 2 (bots barely use it)", () => {
    expect(abilityPointValue({ boostCooldownMultiplier: 0.6 })).toBe(2);
  });

  it("a drawback lowers the value", () => {
    expect(
      abilityPointValue({ laserDamageBonus: 1, damageTakenMultiplier: 1.1 }),
    ).toBeLessThan(abilityPointValue({ laserDamageBonus: 1 }));
  });

  it("every ability is worth at least 1 point", () => {
    for (const effect of Object.values(PILOT_ABILITY_REALTIME)) {
      expect(abilityPointValue(effect)).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("derivePilotSurcharge — priced from the real-time effect", () => {
  it("charges the effect's value, not the authored campaign cost", () => {
    const effect = PILOT_ABILITY_REALTIME.marksman!;
    expect(PILOT_ABILITIES.marksman!.pointCost).not.toBe(
      abilityPointValue(effect),
    );
    expect(derivePilotSurcharge(1, "marksman")).toBe(abilityPointValue(effect));
  });

  it("adds one point per initiative above the rookie", () => {
    expect(derivePilotSurcharge(4, "marksman")).toBe(
      3 + abilityPointValue(PILOT_ABILITY_REALTIME.marksman!),
    );
  });
});
