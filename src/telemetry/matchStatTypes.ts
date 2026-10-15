/**
 * matchStatTypes — the vocabulary of match telemetry: the events a battle
 * scene records, the flat `match_summary` payload, and the special actions
 * counted. Pure data + two tiny classifiers.
 */

import type { ManeuverDefinition, ManeuverDirection } from "../core/types";
import type { TelemetryData } from "./TelemetryLog";

/** Weapon families tracked separately. */
export type MatchWeapon = "primary" | "ordnance";

/** Special actions counted (the pilot controls' flight events). */
export const SPECIAL_ACTIONS = [
  "kturn",
  "segnor",
  "tallon",
  "boost",
  "barrel_roll",
] as const;

/** A special action. */
export type SpecialAction = (typeof SPECIAL_ACTIONS)[number];

/** One thing that happened in a match. */
export type MatchStatEvent =
  | {
      readonly kind: "shot";
      /** The attacker flies on the player's side. */
      readonly friendly: boolean;
      readonly weapon: MatchWeapon;
      readonly hit: boolean;
    }
  | {
      /** A projectile fired earlier (shot with hit: false) struck its target. */
      readonly kind: "hit";
      readonly friendly: boolean;
      readonly weapon: MatchWeapon;
    }
  | {
      readonly kind: "damage";
      /** The damaged ship flies on the player's side (damage taken). */
      readonly toFriendly: boolean;
      readonly hull: number;
      readonly shield: number;
      /** The friendly ship that dealt it (credits the MVP). */
      readonly byShip?: { readonly id: string; readonly definitionId: string };
    }
  | {
      readonly kind: "kill";
      readonly victimFriendly: boolean;
      readonly victimIsPlayer?: boolean;
    }
  | {
      /** The player's maneuver cycle committed. */
      readonly kind: "cycle";
      readonly dial: readonly ManeuverDefinition[];
      readonly direction: ManeuverDirection;
      readonly speed: number;
    }
  | {
      /** The player's flight events this frame (specials, hard turns). */
      readonly kind: "flight";
      readonly events: readonly string[];
    }
  | { readonly kind: "mark" }
  | { readonly kind: "stress"; readonly ms: number; readonly stressed: boolean }
  | {
      /** Hull restored to a ship (ignored for ships deployed as hostile). */
      readonly kind: "repair";
      readonly hull: number;
      readonly shipId?: string;
    }
  | {
      readonly kind: "deploy";
      readonly friendly: boolean;
      readonly count?: number;
      /** Lets repairs of this ship be attributed to its side. */
      readonly shipId?: string;
    };

/** The flat `match_summary` payload. */
export interface MatchSummary extends TelemetryData {
  readonly mode: string;
  readonly outcome: string;
  readonly durationMs: number;
  /** Time from start to the first ship destroyed (either side), ms. */
  readonly firstKillMs: number | null;
  /** Hostile ships destroyed. */
  readonly kills: number;
  /** Friendly ships destroyed. */
  readonly losses: number;
  readonly playerDeaths: number;
  readonly shotsPrimary: number;
  readonly hitsPrimary: number;
  readonly shotsOrdnance: number;
  readonly hitsOrdnance: number;
  readonly enemyShots: number;
  readonly enemyHits: number;
  readonly dmgDealtHull: number;
  readonly dmgDealtShield: number;
  readonly dmgTakenHull: number;
  readonly dmgTakenShield: number;
  readonly mvGreen: number;
  readonly mvWhite: number;
  readonly mvRed: number;
  readonly kturn: number;
  readonly segnor: number;
  readonly tallon: number;
  readonly boost: number;
  readonly barrelRoll: number;
  /** Sum of every special action. */
  readonly specials: number;
  readonly marks: number;
  readonly stressMs: number;
  readonly repairs: number;
  readonly repairHull: number;
  readonly deployedFriendly: number;
  readonly deployedHostile: number;
  /** Ship definition id of the friendly ship that dealt the most damage. */
  readonly mvpShip: string | null;
  /** Damage dealt by {@link MatchSummary.mvpShip}. */
  readonly mvpDamage: number;
}

/**
 * @param ship - The attacker, when known.
 * @returns A spreadable `byShip` credit for a damage event (empty when unknown).
 */
export function dealerOf(
  ship: { readonly id: string; readonly definitionId: string } | null | undefined,
): { readonly byShip?: { readonly id: string; readonly definitionId: string } } {
  return ship ? { byShip: { id: ship.id, definitionId: ship.definitionId } } : {};
}

/**
 * @param event - A flight event name.
 * @returns True for the counted special actions.
 */
export function isSpecialAction(event: string): event is SpecialAction {
  return (SPECIAL_ACTIONS as readonly string[]).includes(event);
}

/**
 * @param events - Flight events of one frame.
 * @returns How many were special actions.
 */
export function countSpecialActions(events: readonly string[]): number {
  return events.filter(isSpecialAction).length;
}
