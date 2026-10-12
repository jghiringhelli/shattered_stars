/**
 * Survival death blasts — the Volatile affix and the Martyr Beacon relic
 * are threats, never one-shots: a Volatile elite's blast stays below the
 * full health of every light fighter, and an escort's Martyr blast matches
 * a pilot's own Self-Destruct.
 */

import { describe, it, expect } from "vitest";
import { combineEffects } from "../../../../src/core/CombatModifiers";
import { getModeCombatStats } from "../../../../src/data/ModeBalancing";
import { SHIP_DEFINITIONS } from "../../../../src/data/ShipDefinitions";
import { getAffix } from "../../../../src/data/survival/affixes";
import { SQUADRON_RELICS } from "../../../../src/data/survival/relicCatalogSupport";
import { PILOT_ABILITY_REALTIME } from "../../../../src/data/pilotAbilityEffects";
import {
  deathBlastDamage,
  type AbilityCombatant,
} from "../../../../src/arcade/PilotAbilityCombat";
import { INITIAL_STRESS } from "../../../../src/arcade/ArcadeStress";
import type { RealtimeEffect } from "../../../../src/core/CombatModifiers";

/** The frailest full-health light fighter's margin over the blast (HP). */
const MIN_SURVIVAL_MARGIN_HP = 1;

function blastOf(effect: RealtimeEffect): number {
  const victim: AbilityCombatant = {
    id: "v",
    x: 0,
    y: 0,
    angle: 0,
    hull: 0,
    maxHull: 1,
    shields: 0,
    maxShields: 0,
    stress: INITIAL_STRESS,
    modifiers: combineEffects([effect]),
    frenzyUntilMs: 0,
  };
  return deathBlastDamage(victim);
}

function martyrEffect(): RealtimeEffect {
  const relic = SQUADRON_RELICS.find((r) => r.id === "martyr_beacon");
  const effect = relic?.effects.find((e) => e.kind === "static");
  return effect && effect.kind === "static" ? effect.effect : {};
}

describe("Survival death blasts", () => {
  const volatile = blastOf(getAffix("volatile")!.effect!);

  it("Volatile never one-shots a full-health light fighter", () => {
    const lightFighters = Object.values(SHIP_DEFINITIONS).filter(
      (def) => def.role === "light_fighter",
    );
    const oneShot = lightFighters
      .map((def) => {
        const stats = getModeCombatStats(def.id, "survival");
        return { id: def.id, health: stats.maxHull + stats.maxShields };
      })
      .filter(({ health }) => health < volatile + MIN_SURVIVAL_MARGIN_HP);
    expect(oneShot).toEqual([]);
  });

  it("Volatile is still a bigger threat than a pilot's Self-Destruct", () => {
    expect(volatile).toBeGreaterThan(
      blastOf(PILOT_ABILITY_REALTIME["self_destruct"]!),
    );
  });

  it("Martyr Beacon escorts blast like a pilot's Self-Destruct (20 HP)", () => {
    expect(blastOf(martyrEffect())).toBe(
      blastOf(PILOT_ABILITY_REALTIME["self_destruct"]!),
    );
  });
});
