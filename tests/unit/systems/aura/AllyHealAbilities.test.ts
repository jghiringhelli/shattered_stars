/**
 * Ally-acting heal / stress abilities — specification tests: the pilot
 * abilities whose card text restores shields or removes stress on FRIENDLY
 * ships (healing_aura, shield_transfer, force_heal, inspiring_presence) act
 * on allies inside the pilot's aura, not on the pilot itself.
 */

import { describe, it, expect } from "vitest";
import type { FactionId } from "../../../../src/config";
import {
  combineEffects,
  type CombatModifiers,
} from "../../../../src/core/CombatModifiers";
import { PILOT_ABILITY_REALTIME } from "../../../../src/data/pilotAbilityEffects";
import {
  FACTION_AURAS,
  resolveSupportAuras,
  type ActiveAura,
  type AuraShip,
} from "../../../../src/systems/SupportAura";
import { auraFactsOf } from "../../../../src/systems/aura/AuraShipFacts";

function sheetOf(abilityId: string | null): CombatModifiers {
  return combineEffects(
    abilityId ? [PILOT_ABILITY_REALTIME[abilityId]!] : [{ projectsAura: true }],
  );
}

function ship(
  id: string,
  faction: FactionId,
  x: number,
  sheet: CombatModifiers | null,
): AuraShip {
  return {
    id,
    x,
    y: 0,
    faction,
    role: "support",
    size: "medium",
    isUnique: false,
    equippedUpgrades: [],
    hull: 4,
    shields: 0,
    maxShields: 4,
    ...(sheet ? auraFactsOf(sheet) : {}),
  };
}

function allyBuff(
  faction: FactionId,
  abilityId: string | null,
  x = 100,
): ActiveAura | undefined {
  const healer = ship("healer", faction, 0, sheetOf(abilityId));
  const ally = ship("ally", faction, x, null);
  return resolveSupportAuras([healer, ally]).buffs.get("ally");
}

const ALLY_HEALERS: ReadonlyArray<readonly [string, FactionId]> = [
  ["healing_aura", "free_confederation"],
  ["shield_transfer", "terran_hegemony"],
  ["force_heal", "ascendant_empire"],
];

describe("heal-ally abilities restore allies' shields", () => {
  it.each(ALLY_HEALERS)(
    "%s gives covered allies more shield regen than the plain aura",
    (abilityId, faction) => {
      const plain = allyBuff(faction, null)?.shieldRegenPerSecond ?? 0;
      const healed = allyBuff(faction, abilityId)?.shieldRegenPerSecond ?? 0;
      expect(healed).toBeGreaterThan(plain);
    },
  );

  it.each(ALLY_HEALERS)(
    "%s does not regenerate the pilot's own shields",
    (abilityId) => {
      expect(sheetOf(abilityId).shieldRegenPerSecond).toBe(0);
    },
  );

  it.each(ALLY_HEALERS)("%s heals nobody outside the aura", (abilityId, f) => {
    expect(allyBuff(f, abilityId, FACTION_AURAS[f].radius * 3)).toBeUndefined();
  });
});

describe("inspiring_presence (friendlies remove stress)", () => {
  it("eases covered allies' maneuvers by one stress tier", () => {
    expect(
      allyBuff("terran_hegemony", "inspiring_presence")?.stressReliefTiers,
    ).toBe(1);
  });

  it("does not ease the pilot's own maneuvers", () => {
    expect(sheetOf("inspiring_presence").stressReliefTiers).toBe(0);
  });
});
