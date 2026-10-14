/**
 * Upgrade catalog types.
 *
 * Kept in core (no imports from systems/data) so the catalog data files and
 * the UpgradeSystem logic can both depend on them without an import cycle.
 */

import type { FactionId, ShipSize } from "../config";
import type { ShipRole } from "./types";
import type { RealtimeEffect } from "./CombatModifiers";

/** Upgrade categories — each ship's slot bar lists which of these it accepts. */
export type UpgradeSlotType =
  | "talent" // Pilot talents
  | "missile" // Missiles and rockets
  | "torpedo" // Torpedoes
  | "cannon" // Forward cannons that modify the primary laser
  | "turret" // Auto-tracking turret weapons
  | "bomb" // Bombs and mines
  | "crew" // Crew members
  | "gunner" // Dedicated gunners
  | "astromech" // Riggers
  | "sensor" // Sensor suites
  | "tech" // Advanced technology
  | "modification" // Ship modifications
  | "illicit" // Black-market gear: strong effects with a drawback
  | "title" // Unique ship titles
  | "configuration" // Ship configurations (trade-offs)
  | "force_power"; // psionic abilities (Ascendant Empire pilots)

/**
 * Stat bonuses every game mode applies (hull, shields, attack/agility dice),
 * plus legacy action/reroll annotations used by the encyclopedia and picker.
 */
export interface UpgradeEffects {
  readonly hullBonus?: number;
  readonly shieldBonus?: number;
  readonly agilityBonus?: number;
  readonly attackBonus?: number;
  readonly addsAction?: string;
  readonly addsActionLinked?: { action: string; linkedTo: string };
  readonly rangeBonus?: number;
  readonly rerollCount?: number;
  /** Ordnance charges (missiles, torpedoes, bombs) or ability charges. */
  readonly chargesAdded?: number;
}

/**
 * Real-time profile of a secondary weapon (turret, missile, torpedo, bomb).
 * The weapon class comes from the upgrade's slot type.
 */
export interface WeaponProfile {
  /** Damage dealt per hit. */
  readonly damage: number;
  /** Time between shots, in milliseconds. */
  readonly cooldownMs: number;
  /**
   * X-Wing range band [min, max] (1–3; config RANGE_1..RANGE_3 px) the
   * weapon engages at. Omitted = the class default (missiles/torpedoes
   * 2–3, turrets 1–2).
   */
  readonly rangeBand?: readonly [number, number];
  /** Bomb-slot cards: a timed "bomb" or a proximity "mine". */
  readonly device?: "bomb" | "mine";
  /** Homing steering speed, in degrees per second. */
  readonly homingTurnRate?: number;
  /** Total degrees of steering before a homing shot flies straight. */
  readonly homingTurnBudget?: number;
  /** Stress (0–1 scale) inflicted on the target by each hit. */
  readonly stressOnHit?: number;
}

/** One card in the upgrade catalog. */
export interface UpgradeDefinition {
  readonly id: string;
  readonly name: string;
  readonly slotType: UpgradeSlotType;
  /** What the upgrade does in real-time combat — shown to the player. */
  readonly description: string;
  /** Fixed squad-point value; a loadout's price is the sum of these. */
  readonly pointCost: number;
  /** Campaign shop price. */
  readonly creditCost: number;
  readonly requiredFaction?: FactionId;
  readonly requiredShipSize?: ShipSize | ShipSize[];
  readonly requiredShipRole?: ShipRole | ShipRole[];
  readonly requiredSlots?: UpgradeSlotType[];
  readonly isUnique?: boolean;
  readonly effects?: UpgradeEffects;
  /** Real-time combat behaviour (cooldowns, damage, stress, regen, auras). */
  readonly realtime?: RealtimeEffect;
  /** Real-time profile when the upgrade is itself a secondary weapon. */
  readonly weapon?: WeaponProfile;
}
