/**
 * realtimeEffectSummary — one-line, player-facing readings of real-time
 * effect knobs (pilot abilities and upgrade cards).
 */

import { describe, it, expect } from "vitest";
import {
  describeRealtimeEffect,
  summarizeRealtimeEffect,
} from "../../../src/data/realtimeEffectSummary";
import {
  NEUTRAL_MODIFIERS,
  type CombatModifiers,
} from "../../../src/core/CombatModifiers";
import { PILOT_ABILITY_REALTIME } from "../../../src/data/pilotAbilityEffects";
import { UPGRADE_DEFINITIONS } from "../../../src/systems/UpgradeSystem";

describe("summarizeRealtimeEffect — conditional laser damage", () => {
  it("reads a rear-arc bonus as damage from behind the target", () => {
    expect(summarizeRealtimeEffect({ rearArcLaserBonus: 1 })).toBe(
      "+1 laser dmg from behind the target",
    );
  });

  it("reads a range-1 bonus", () => {
    expect(summarizeRealtimeEffect({ closeRangeLaserBonus: 1 })).toBe(
      "+1 laser dmg at range 1",
    );
  });

  it("reads a bullseye bonus with its size", () => {
    expect(summarizeRealtimeEffect({ bullseyeLaserBonus: 2 })).toBe(
      "+2 laser dmg in the bullseye",
    );
  });

  it("reads an unconditional laser bonus", () => {
    expect(summarizeRealtimeEffect({ laserDamageBonus: 1 })).toBe(
      "+1 laser dmg",
    );
  });
});

describe("summarizeRealtimeEffect — multipliers", () => {
  it("reads a shorter boost recharge as a percentage faster", () => {
    expect(summarizeRealtimeEffect({ boostCooldownMultiplier: 0.6 })).toBe(
      "boost recharges 40% faster",
    );
  });

  it("rounds floating-point reductions to whole percents", () => {
    expect(
      summarizeRealtimeEffect({ barrelRollCooldownMultiplier: 0.85 }),
    ).toBe("barrel roll recharges 15% faster");
  });

  it("reads a damage reduction as less damage taken", () => {
    expect(summarizeRealtimeEffect({ damageTakenMultiplier: 0.9 })).toBe(
      "takes 10% less damage",
    );
  });

  it("reads a drawback multiplier above 1 as more", () => {
    expect(summarizeRealtimeEffect({ damageTakenMultiplier: 1.1 })).toBe(
      "takes 10% more damage",
    );
  });

  it("reads a stress drawback", () => {
    expect(summarizeRealtimeEffect({ stressRateMultiplier: 1.1 })).toBe(
      "10% more maneuver stress",
    );
  });
});

describe("summarizeRealtimeEffect — flags and composition", () => {
  it("reads aura projection", () => {
    expect(summarizeRealtimeEffect({ projectsAura: true })).toBe(
      "projects faction aura",
    );
  });

  it("joins several knobs with commas, in a fixed order", () => {
    expect(
      summarizeRealtimeEffect({
        boostCooldownMultiplier: 0.8,
        rearArcLaserBonus: 1,
      }),
    ).toBe("+1 laser dmg from behind the target, boost recharges 20% faster");
  });

  it("skips knobs at their neutral value", () => {
    expect(
      summarizeRealtimeEffect({
        laserDamageBonus: 0,
        damageTakenMultiplier: 1,
        projectsAura: false,
      }),
    ).toBe("");
  });

  it("an empty effect has no phrases", () => {
    expect(describeRealtimeEffect({})).toEqual([]);
  });

  it("formats fractional rates without float noise", () => {
    expect(summarizeRealtimeEffect({ shieldRegenPerSecond: 0.15 })).toBe(
      "regenerates 0.15 shield HP/s",
    );
  });

  it("reads stress inflicted per hit as a percentage", () => {
    expect(summarizeRealtimeEffect({ stressOnHit: 0.05 })).toBe(
      "laser hits add 5% stress to the target",
    );
  });
});

describe("describeRealtimeEffect — coverage", () => {
  const keys = Object.keys(NEUTRAL_MODIFIERS) as (keyof CombatModifiers)[];

  it.each(keys)("phrases a non-neutral %s", (key) => {
    const neutral = NEUTRAL_MODIFIERS[key];
    const value = typeof neutral === "boolean" ? true : neutral === 1 ? 0.5 : 1;
    expect(describeRealtimeEffect({ [key]: value })).toHaveLength(1);
  });

  it("every pilot ability reads as at least one phrase", () => {
    for (const [id, effect] of Object.entries(PILOT_ABILITY_REALTIME)) {
      expect(summarizeRealtimeEffect(effect), id).not.toBe("");
    }
  });

  it("every upgrade with a real-time effect reads as at least one phrase", () => {
    for (const card of Object.values(UPGRADE_DEFINITIONS)) {
      if (!card.realtime || Object.keys(card.realtime).length === 0) continue;
      expect(summarizeRealtimeEffect(card.realtime), card.id).not.toBe("");
    }
  });
});
