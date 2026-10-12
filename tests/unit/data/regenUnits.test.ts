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
import { realTimeRunBonuses } from "../../../src/arcade/systems/SurvivalDurability";
import {
  HULL_REPAIR_DAMAGE_PAUSE_MS,
  repairStep,
} from "../../../src/arcade/systems/repair/HullRepair";

/** Miniature rates the converted pilot abilities used to carry. */
const OLD_MINIATURE_ABILITY_REGEN: Readonly<Record<string, number>> = {
  regenerative_matrix: 0.15,
  healing_aura: 0.1,
  shield_transfer: 0.05,
  force_heal: 0.2,
  shield_upgrade: 0.1,
  regenerative_shields: 0.2,
};

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

  it("keeps each converted pilot ability at its old real-time strength", () => {
    for (const [id, miniature] of Object.entries(OLD_MINIATURE_ABILITY_REGEN)) {
      expect(PILOT_ABILITY_REALTIME[id]?.shieldRegenPerSecond, id).toBeCloseTo(
        miniature * DURABILITY_SCALE,
        10,
      );
    }
  });

  it("states the Aegis Field shield regen in HP/s (0.2 tokens/s = 2.4 HP/s)", () => {
    expect(FACTION_AURAS.ascendant_empire.magnitude).toBeCloseTo(
      0.2 * DURABILITY_SCALE,
      10,
    );
    expect(FACTION_AURAS.ascendant_empire.description).toMatch(/HP\/s/);
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
    ["affix regenerating", 2],
    ["relic regen_lattice", 2],
    ["relic escort_foundry", 1],
    ["set bulwark", 3],
    ["armory regenerative_emitters", 1.5],
    ["research shield_harmonics", 1],
  ] as const)("%s regenerates %d HP/s", (name, hpPerSecond) => {
    const entry = authored.find(([label]) => label === name);
    expect(entry?.[1]).toBe(hpPerSecond);
    expect(entry?.[2]).toMatch(/HP\/s/);
  });

  it("drafted Regen Coils (bul_regen) add 0.5 shield HP/s, unscaled", () => {
    const coils = ATOMS.find((p) => p.id === "bul_regen");
    expect(coils?.amount).toBe(0.5);
    expect(coils?.description).toMatch(/HP\/s/);
    expect(
      realTimeRunBonuses({ maxHull: 0, maxShields: 0, shieldRegen: 0.5 })
        .shieldRegenPerSecond,
    ).toBe(0.5);
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
