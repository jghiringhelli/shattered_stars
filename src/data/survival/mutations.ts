/**
 * Survival roguelite — mutations (Nova Drift-style), pure data.
 *
 * At the boss of sectors 1 and 2 the player picks ONE mutation for a
 * system slot. Options in a slot are mutually exclusive and change how
 * the flagship behaves (fire pattern, shield model, drive) rather than
 * adding a stat delta. Interpreted by RelicCombatEngine.
 */

import type { RealtimeEffect } from "../../core/CombatModifiers";
import type { RelicTrigger, TimedBuff } from "./relics";

/** The flagship system a mutation rewires. */
export type MutationSlot = "weapon" | "systems";

/** What a mutation changes (all optional; flagship only). */
export interface MutationRules {
  readonly attackIntervalMultiplier?: number;
  readonly damageMultiplier?: number;
  readonly rangeBonusPx?: number;
  /** Bolts fired per attack, each rolled separately. */
  readonly shotsPerAttack?: number;
  readonly hitChanceBonus?: number;
  readonly staticEffect?: RealtimeEffect;
  /** Shields stop regenerating on their own (passive regen = 0). */
  readonly noPassiveShieldRegen?: boolean;
  /** Fraction of max shields restored per kill. */
  readonly killShieldFraction?: number;
  readonly maxHullMultiplier?: number;
  readonly trigger?: { readonly on: RelicTrigger; readonly buff: TimedBuff };
}

/** One mutation option. */
export interface Mutation {
  readonly id: string;
  readonly slot: MutationSlot;
  readonly name: string;
  readonly icon: string;
  /** Behaviour change, stated plainly (not a stat delta). */
  readonly description: string;
  readonly rules: MutationRules;
}

/** Every mutation, grouped by slot. */
export const MUTATIONS: readonly Mutation[] = [
  {
    id: "rail_driver",
    slot: "weapon",
    name: "Rail Driver",
    icon: "🔱",
    description:
      "Primary fires 45% slower, but every bolt hits 2.5x harder and reaches 120px further",
    rules: {
      attackIntervalMultiplier: 1.8,
      damageMultiplier: 2.5,
      rangeBonusPx: 120,
    },
  },
  {
    id: "scatter_array",
    slot: "weapon",
    name: "Scatter Array",
    icon: "✳",
    description:
      "Every attack fires two bolts, each rolled separately, at 70% damage",
    rules: { shotsPerAttack: 2, damageMultiplier: 0.7 },
  },
  {
    id: "ion_lance",
    slot: "weapon",
    name: "Ion Lance",
    icon: "⚡",
    description:
      "Bolts deal 10% less damage but gain +15% hit chance and stress every target they hit",
    rules: {
      damageMultiplier: 0.9,
      hitChanceBonus: 0.15,
      staticEffect: { stressOnHit: 0.35 },
    },
  },
  {
    id: "reactive_shields",
    slot: "systems",
    name: "Reactive Shields",
    icon: "♾",
    description:
      "Shields no longer regenerate on their own; each kill restores 40% of them, each barrel roll 15%",
    rules: {
      noPassiveShieldRegen: true,
      killShieldFraction: 0.4,
      trigger: {
        on: "barrel_roll",
        buff: { id: "reactive", durationMs: 1, shieldRestoreFraction: 0.15 },
      },
    },
  },
  {
    id: "afterburner_core",
    slot: "systems",
    name: "Afterburner Core",
    icon: "🚀",
    description:
      "Boost and barrel roll recharge twice as fast and a boost dodges 70% of damage for 1s — but max hull -15%",
    rules: {
      staticEffect: {
        boostCooldownMultiplier: 0.5,
        barrelRollCooldownMultiplier: 0.5,
      },
      trigger: {
        on: "boost",
        buff: {
          id: "afterburner",
          durationMs: 1000,
          damageTakenMultiplier: 0.3,
        },
      },
      maxHullMultiplier: 0.85,
    },
  },
  {
    id: "juggernaut_plating",
    slot: "systems",
    name: "Juggernaut Plating",
    icon: "🏰",
    description:
      "Take 30% less damage with +25% max hull — but boost and barrel roll recharge 80% slower",
    rules: {
      staticEffect: {
        damageTakenMultiplier: 0.7,
        boostCooldownMultiplier: 1.8,
        barrelRollCooldownMultiplier: 1.8,
      },
      maxHullMultiplier: 1.25,
    },
  },
];

/** Which slot each sector's boss offers (sector → slot); the final boss offers none. */
export const MUTATION_SLOT_BY_SECTOR: Readonly<Record<number, MutationSlot>> = {
  1: "weapon",
  2: "systems",
};

/**
 * @param slot - A mutation slot.
 * @returns Its mutually exclusive options.
 */
export function mutationsForSlot(slot: MutationSlot): Mutation[] {
  return MUTATIONS.filter((m) => m.slot === slot);
}

/**
 * @param id - A mutation id.
 * @returns The mutation, or undefined.
 */
export function getMutation(id: string): Mutation | undefined {
  return MUTATIONS.find((m) => m.id === id);
}
