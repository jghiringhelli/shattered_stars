/**
 * Regen / repair units — every shield-regen and hull-repair knob is authored
 * in REAL-TIME hit points per second, and the repair pipeline never rescales
 * it by DURABILITY_SCALE. Values that used to be miniature points per second
 * were converted (x DURABILITY_SCALE) so their in-game effect is unchanged;
 * Survival and Campaign values were always meant as HP/s and are kept.
 */

import { describe, it, expect } from "vitest";
import { DURABILITY_SCALE } from "../../../src/config";
import {
  combineEffects,
  type RealtimeEffect,
} from "../../../src/core/CombatModifiers";
import { UPGRADE_CATALOG } from "../../../src/data/upgrades";
import { PILOT_ABILITY_REALTIME } from "../../../src/data/pilotAbilityEffects";
import { getAffix } from "../../../src/data/survival/affixes";
import {
  BULWARK_RELICS,
  SQUADRON_RELICS,
} from "../../../src/data/survival/relicCatalogSupport";
import { ARCHETYPE_SETS, type Relic } from "../../../src/data/survival/relics";
import { ATOMS } from "../../../src/data/survival/powers";
import { getArmoryMod } from "../../../src/data/campaign/armory";
import { RESEARCH_TREE } from "../../../src/data/campaign/research";
import { FACTION_AURAS } from "../../../src/systems/aura/FactionAuras";
import { isSheetAbility } from "../../../src/arcade/systems/AceDuelAbilities";
import { realTimeRunBonuses } from "../../../src/arcade/systems/SurvivalDurability";
import {
  HULL_REPAIR_DAMAGE_PAUSE_MS,
  repairStep,
} from "../../../src/arcade/systems/repair/HullRepair";

/**
 * Measured ceiling for a pilot ability's shield regen (own or granted to
 * allies), in real-time HP/s: regen never pauses, and the skill arena shows
 * 0.24 HP/s already worth ~7 points; at 1+ HP/s a ship out-heals a
 * duelist's fire and cannot be killed (abilityPricing).
 */
const MAX_ABILITY_REGEN_HP_PER_S = 0.24;

/** One second of real time. */
const ONE_SECOND_MS = 1000;

/** Tolerance (s) between a card's "every ~N seconds" text and its rate. */
const CARD_TEXT_SECONDS_TOLERANCE = 1.5;

function staticEffectOf(relic: Relic | undefined): RealtimeEffect {
  const effect = relic?.effects.find((e) => e.kind === "static");
  return effect && effect.kind === "static" ? effect.effect : {};
}

function relic(list: readonly Relic[], id: string): Relic | undefined {
  return list.find((r) => r.id === id);
}

function researchOption(id: string) {
  for (const tier of RESEARCH_TREE) {
    if (tier.optionA.id === id) return tier.optionA;
    if (tier.optionB.id === id) return tier.optionB;
  }
  return undefined;
}

describe("regen units — catalog cards and pilot abilities (converted)", () => {
  const repairCards = Object.values(UPGRADE_CATALOG).filter(
    (card) =>
      (card.realtime?.shieldRegenPerSecond ?? 0) > 0 ||
      (card.realtime?.hullRepairPerSecond ?? 0) > 0,
  );

  it("has repair cards to check", () => {
    expect(repairCards.length).toBeGreaterThan(0);
  });

  it("restores one shield/hull token (DURABILITY_SCALE HP) in the time its card text says", () => {
    const drifted = repairCards.flatMap((card) => {
      const match = /every ~(\d+) seconds/.exec(card.description);
      if (!match) return [];
      const rate =
        (card.realtime?.shieldRegenPerSecond ?? 0) +
        (card.realtime?.hullRepairPerSecond ?? 0);
      const seconds = DURABILITY_SCALE / rate;
      return Math.abs(seconds - Number(match[1])) <= CARD_TEXT_SECONDS_TOLERANCE
        ? []
        : [`${card.id}: ${seconds.toFixed(1)}s vs ~${match[1]}s`];
    });
    expect(drifted).toEqual([]);
  });

  it("keeps every pilot ability's regen (own or allies') below the measured ceiling", () => {
    const tooStrong = Object.entries(PILOT_ABILITY_REALTIME).filter(
      ([, effect]) =>
        (effect.shieldRegenPerSecond ?? 0) > MAX_ABILITY_REGEN_HP_PER_S ||
        (effect.auraShieldRegenPerSecond ?? 0) > MAX_ABILITY_REGEN_HP_PER_S,
    );
    expect(tooStrong).toEqual([]);
  });

  it("states the Aegis Field shield regen in HP/s (0.4 HP/s, balance report)", () => {
    expect(FACTION_AURAS.ascendant_empire.magnitude).toBeCloseTo(0.4, 10);
    expect(FACTION_AURAS.ascendant_empire.description).toMatch(/HP\/s/);
  });
});

describe("regen units — Ace Duel regenerative_shields", () => {
  it("acts through the modifier sheet at most at the ceiling, never per maneuver cycle", () => {
    expect(isSheetAbility("regenerative_shields")).toBe(true);
    expect(
      PILOT_ABILITY_REALTIME.regenerative_shields?.shieldRegenPerSecond ?? 0,
    ).toBeLessThanOrEqual(MAX_ABILITY_REGEN_HP_PER_S);
  });
});

describe("regen units — Survival and Campaign values are HP/s as authored", () => {
  const authored: ReadonlyArray<readonly [string, number, string]> = [
    [
      "affix regenerating",
      getAffix("regenerating")?.effect?.shieldRegenPerSecond ?? 0,
      getAffix("regenerating")?.description ?? "",
    ],
    [
      "relic regen_lattice",
      staticEffectOf(relic(BULWARK_RELICS, "regen_lattice"))
        .shieldRegenPerSecond ?? 0,
      relic(BULWARK_RELICS, "regen_lattice")?.description ?? "",
    ],
    [
      "relic escort_foundry",
      staticEffectOf(relic(SQUADRON_RELICS, "escort_foundry"))
        .shieldRegenPerSecond ?? 0,
      relic(SQUADRON_RELICS, "escort_foundry")?.description ?? "",
    ],
    [
      "set bulwark",
      (() => {
        const e = ARCHETYPE_SETS.bulwark.effects.find(
          (x) => x.kind === "static",
        );
        return e && e.kind === "static"
          ? (e.effect.shieldRegenPerSecond ?? 0)
          : 0;
      })(),
      ARCHETYPE_SETS.bulwark.description,
    ],
    [
      "armory regenerative_emitters",
      getArmoryMod("regenerative_emitters")?.bonuses.shieldRegenPerSecond ?? 0,
      getArmoryMod("regenerative_emitters")?.description ?? "",
    ],
    [
      "research shield_harmonics",
      researchOption("shield_harmonics")?.bonuses.shieldRegenPerSecond ?? 0,
      researchOption("shield_harmonics")?.description ?? "",
    ],
  ];

  it.each([
    ["affix regenerating", 0.24],
    ["relic regen_lattice", 0.24],
    ["relic escort_foundry", 0.12],
    ["set bulwark", 0.24],
    ["armory regenerative_emitters", 0.24],
    ["research shield_harmonics", 0.12],
  ] as const)("%s regenerates %d HP/s", (name, hpPerSecond) => {
    const entry = authored.find(([label]) => label === name);
    expect(entry?.[1]).toBe(hpPerSecond);
    expect(entry?.[2]).toMatch(/HP\/s/);
  });

  it("keeps every Survival / Campaign regen at or below the measured ceiling (R2: ≥0.72 HP/s is unkillable)", () => {
    const tooStrong = authored.filter(
      ([, rate]) => rate > MAX_ABILITY_REGEN_HP_PER_S,
    );
    expect(tooStrong).toEqual([]);
  });

  it("drafted Regen Coils (bul_regen) add 0.12 shield HP/s, unscaled", () => {
    const coils = ATOMS.find((p) => p.id === "bul_regen");
    expect(coils?.amount).toBe(0.12);
    expect(coils?.description).toMatch(/0\.12 shield HP\/s/);
    expect(
      realTimeRunBonuses({ maxHull: 0, maxShields: 0, shieldRegen: 0.12 })
        .shieldRegenPerSecond,
    ).toBe(0.12);
  });

  it("repairs exactly r shield HP in one second for every authored rate r", () => {
    const rates = [
      ...authored.map(([, rate]) => rate),
      ...Object.values(PILOT_ABILITY_REALTIME).map(
        (e) => e.shieldRegenPerSecond ?? 0,
      ),
      ...Object.values(UPGRADE_CATALOG).map(
        (c) => c.realtime?.shieldRegenPerSecond ?? 0,
      ),
    ].filter((rate) => rate > 0);
    for (const rate of rates) {
      const sheet = combineEffects([{ shieldRegenPerSecond: rate }]);
      const after = repairStep({
        hull: 10,
        maxHull: 10,
        shields: 0,
        maxShields: 1000,
        shieldRegenPerSecond: sheet.shieldRegenPerSecond,
        hullRepairPerSecond: 0,
        deltaMs: ONE_SECOND_MS,
        msSinceDamage: HULL_REPAIR_DAMAGE_PAUSE_MS,
      });
      expect(after.shields).toBeCloseTo(rate, 10);
    }
  });
});
