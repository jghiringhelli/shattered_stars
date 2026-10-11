/**
 * heroPowerTypes — campaign hero pilots' active powers: what each power does
 * (a data-described effect per rank) and its cooldown. Plain data; the
 * effect resolver turns an activation into commands for the battle scene.
 */

import type { FactionId } from "../../config";

/** What a power does when cast. */
export type HeroPowerEffect =
  | {
      /** Delayed area bombardment at the focus target (or ahead). */
      readonly kind: "orbital_strike";
      readonly radius: number;
      readonly damage: number;
      readonly delayMs: number;
    }
  | {
      /** Shields refilled and incoming damage reduced for a while. */
      readonly kind: "shield_overcharge";
      readonly durationMs: number;
      readonly damageTakenMultiplier: number;
    }
  | {
      /** Allies in range fire faster for a while. */
      readonly kind: "rally";
      readonly radius: number;
      readonly durationMs: number;
      /** Multiplier on the attack interval (< 1 = faster). */
      readonly intervalMultiplier: number;
    }
  | {
      /** Hull restored to the flagship and nearby allies. */
      readonly kind: "field_repair";
      readonly radius: number;
      readonly selfHullFraction: number;
      readonly allyHullFraction: number;
    }
  | {
      /** Temporary allied drones. */
      readonly kind: "drone_swarm";
      readonly shipId: string;
      readonly count: number;
      readonly lifetimeMs: number;
    }
  | {
      /** Enemies in range lose shields, are stressed and cannot fire. */
      readonly kind: "emp_burst";
      readonly radius: number;
      readonly disableMs: number;
      readonly stress: number;
    }
  | {
      /** Jump forward and become untargetable. */
      readonly kind: "cloak_dash";
      readonly distance: number;
      readonly durationMs: number;
    }
  | {
      /** Mines dropped behind the flagship that only harm enemies. */
      readonly kind: "scatter_mines";
      readonly count: number;
      readonly damage: number;
      readonly spacing: number;
    }
  | {
      /** Enemies slowed in time. */
      readonly kind: "time_slow";
      readonly durationMs: number;
      readonly enemyTimeScale: number;
    }
  | {
      /** Shield-piercing strike on the focus target in range. */
      readonly kind: "psionic_lance";
      readonly range: number;
      readonly damage: number;
    };

/** One rank of a power. */
export interface HeroPowerRank {
  readonly cooldownMs: number;
  readonly effect: HeroPowerEffect;
}

/** A hero power (ranks 1..3). */
export interface HeroPowerDefinition {
  readonly id: string;
  readonly name: string;
  /** One-character HUD glyph. */
  readonly glyph: string;
  readonly description: string;
  readonly ranks: readonly [HeroPowerRank, HeroPowerRank, HeroPowerRank];
}

/** A faction campaign's hero and its two powers. */
export interface FactionHero {
  readonly factionId: FactionId;
  /** Campaign pilot id of the protagonist. */
  readonly pilotId: string;
  readonly name: string;
  readonly title: string;
  readonly portraitKey: string;
  readonly powers: readonly [HeroPowerDefinition, HeroPowerDefinition];
}

/** When a power slot unlocks / ranks up (completed missions). */
export interface PowerUnlockStep {
  readonly completedMissions: number;
  readonly slot: 0 | 1;
  readonly rank: number;
}
