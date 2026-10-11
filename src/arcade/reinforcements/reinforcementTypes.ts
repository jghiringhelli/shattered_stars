/**
 * reinforcementTypes — data contracts of the reinforcement-pool battle:
 * match rules (pool, on-field cap, category quotas, choice), what can be
 * deployed (an option: ship + loadout + cost + categories) and why a
 * deployment is refused.
 *
 * Pure data.
 */

import type { ShipRole } from "../../core/types";

/** Which battle a reinforced match is (sets the default rules). */
export type ReinforcementFormat = "skirmish" | "epic" | "scenario";

/** A pre-planned deployment strategy (reserve preset / AI plan). */
export type StrategyId = "balanced" | "swarm" | "aces" | "heavy";

/** A category with a quota (max on the field / per match). */
export type ShipCategory = "bomber" | "ace" | "capital";

/**
 * What the player may pick when a ship is lost: "open" = the reserve plus
 * any ship of the faction; "planned" = the pre-planned reserve only.
 */
export type ReinforcementChoice = "open" | "planned";

/** One planned deployment: a ship, flown with a quick-build loadout (or bare). */
export interface ReserveEntry {
  readonly definitionId: string;
  readonly loadoutId: string | null;
}

/** A deployable ship with everything the rules read. */
export interface DeployOption extends ReserveEntry {
  /** Pool points it costs (loadout price, or the bare ship's). */
  readonly cost: number;
  readonly role: ShipRole;
  readonly categories: readonly ShipCategory[];
  /** The unique pilot flying it, or null for a generic pilot. */
  readonly uniquePilotId: string | null;
  /** Display name (loadout name, else ship name). */
  readonly label: string;
}

/** A category quota. Use Infinity for "no limit". */
export interface QuotaRule {
  readonly category: ShipCategory;
  /** Most ships of the category alive at once (0 = forbidden). */
  readonly maxOnField: number;
  /** Most ships of the category deployed over the whole match. */
  readonly maxPerMatch: number;
}

/** The match rules of a reinforced battle. */
export interface ReinforcementRules {
  readonly format: ReinforcementFormat;
  /** Total points a side may ever deploy (initial squad included). */
  readonly poolPoints: number;
  /** Most points of living ships a side may have at once. */
  readonly fieldCapPoints: number;
  readonly quotas: readonly QuotaRule[];
  readonly choice: ReinforcementChoice;
  /** Battle time after which destroyed points decide the match (ms). */
  readonly timeLimitMs: number;
  /** The player's picker accepts the next reserve ship after this (ms). */
  readonly pickerAutoAcceptMs: number;
  /** A ship that just warped in cannot be hit for this long (ms). */
  readonly arrivalProtectionMs: number;
  /** Delay before an AI side fills freed field points (ms). */
  readonly aiDeployDelayMs: number;
}

/** Why a deployment is refused. */
export type DeployBlock =
  "pool" | "cap" | "quota_field" | "quota_match" | "unique";

/** The verdict on one deployment. */
export interface DeployCheck {
  readonly allowed: boolean;
  readonly block: DeployBlock | null;
  /** Short reason for the picker ("" when allowed). */
  readonly reason: string;
}
