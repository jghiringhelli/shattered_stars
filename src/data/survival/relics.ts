/**
 * Survival roguelite — relic model (pure data contracts).
 *
 * A relic is a permanent, run-defining passive. Its behaviour is DATA
 * ({@link RelicEffect}) interpreted at real-time combat consumption points
 * by src/systems/survival/RelicCombatEngine.ts (shot bonuses, incoming
 * damage, flight-event triggers, kills) and by the run economy
 * (salvage, shop, repairs). Static effects reuse the arcade combat knobs
 * (CombatModifiers / ShotConditions), so a relic is never a hidden
 * multiplier: every relic carries visible synergy tags and an archetype.
 */

import type { RealtimeEffect } from "../../core/CombatModifiers";

/** Build archetypes a relic belongs to (3 of one archetype = set bonus). */
export type RelicArchetype =
  "ace" | "hunter" | "squadron" | "bulwark" | "salvager";

/** Visible synergy tags — shared tags hint at combos. */
export type SynergyTag =
  | "red-maneuver"
  | "barrel-roll"
  | "boost"
  | "k-turn"
  | "stress"
  | "mark"
  | "crit"
  | "rear-arc"
  | "bullseye"
  | "unshielded"
  | "kill"
  | "escort"
  | "wingman"
  | "shields"
  | "hull"
  | "repair"
  | "salvage"
  | "shop"
  | "reroll"
  | "elite";

export type RelicRarity = "common" | "uncommon" | "rare";

/** Which pool a relic drops from; non-base pools are meta unlocks. */
export type RelicPool = "base" | "ace_pack" | "fleet_pack" | "salvage_pack";

/** Which of the player's ships an effect applies to. */
export type FleetScope = "flagship" | "escorts" | "fleet";

/** Flight moments that can trigger a timed buff. */
export type RelicTrigger = "red_maneuver" | "barrel_roll" | "boost" | "kturn";

/** A short real-time buff granted by a trigger. */
export interface TimedBuff {
  readonly id: string;
  readonly durationMs: number;
  readonly damageBonus?: number;
  readonly hitChanceBonus?: number;
  /** Multiplier on incoming damage while active (<1 protects). */
  readonly damageTakenMultiplier?: number;
  /** Fraction of max shields restored when the buff is granted. */
  readonly shieldRestoreFraction?: number;
}

/** One relic behaviour, interpreted by the combat engine or the economy. */
export type RelicEffect =
  | {
      readonly kind: "static";
      readonly scope: FleetScope;
      readonly effect: RealtimeEffect;
    }
  | {
      readonly kind: "trigger";
      readonly on: RelicTrigger;
      readonly buff: TimedBuff;
    }
  | {
      readonly kind: "marked";
      readonly scope: FleetScope;
      readonly damageBonus: number;
      readonly hitChanceBonus: number;
      readonly critChanceBonus: number;
    }
  | { readonly kind: "perEscort"; readonly escortsPerDamage: number }
  | {
      readonly kind: "formation";
      readonly minEscorts: number;
      readonly damageTakenMultiplier: number;
    }
  | {
      readonly kind: "onKill";
      readonly salvage?: number;
      readonly shieldFraction?: number;
    }
  | {
      readonly kind: "economy";
      readonly shopDiscount?: number;
      readonly repairBonus?: number;
      readonly rerollsPerSector?: number;
      readonly eliteSalvageMultiplier?: number;
    }
  | { readonly kind: "nodeRepair"; readonly fraction: number };

/** A relic as drafted, shown and saved (by id). */
export interface Relic {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly rarity: RelicRarity;
  readonly archetype: RelicArchetype;
  readonly tags: readonly SynergyTag[];
  readonly pool: RelicPool;
  /** Player-facing rule text ("After a red maneuver, ..."). */
  readonly description: string;
  readonly effects: readonly RelicEffect[];
}

/** Relics of one archetype needed for its set bonus. */
export const ARCHETYPE_SET_SIZE = 3;

/** An archetype's set bonus (active at ARCHETYPE_SET_SIZE relics). */
export interface ArchetypeSet {
  readonly archetype: RelicArchetype;
  readonly name: string;
  readonly description: string;
  readonly effects: readonly RelicEffect[];
}

/** Every archetype's name + set bonus. */
export const ARCHETYPE_SETS: Readonly<Record<RelicArchetype, ArchetypeSet>> = {
  ace: {
    archetype: "ace",
    name: "Hotshot",
    description: "Set: -30% stress from maneuvers",
    effects: [
      {
        kind: "static",
        scope: "flagship",
        effect: { stressRateMultiplier: 0.7 },
      },
    ],
  },
  hunter: {
    archetype: "hunter",
    name: "Hunter",
    description: "Set: marked targets take +1 damage from the whole fleet",
    effects: [
      {
        kind: "marked",
        scope: "fleet",
        damageBonus: 1,
        hitChanceBonus: 0,
        critChanceBonus: 0,
      },
    ],
  },
  squadron: {
    archetype: "squadron",
    name: "Squadron",
    description: "Set: escorts take 20% less damage",
    effects: [
      {
        kind: "static",
        scope: "escorts",
        effect: { damageTakenMultiplier: 0.8 },
      },
    ],
  },
  bulwark: {
    archetype: "bulwark",
    name: "Bulwark",
    description: "Set: +3 shield regen per second for the fleet",
    effects: [
      { kind: "static", scope: "fleet", effect: { shieldRegenPerSecond: 3 } },
    ],
  },
  salvager: {
    archetype: "salvager",
    name: "Salvager",
    description: "Set: +2 salvage per kill",
    effects: [{ kind: "onKill", salvage: 2 }],
  },
};
