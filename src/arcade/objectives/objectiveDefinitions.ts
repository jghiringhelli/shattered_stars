/**
 * objectiveDefinitions — the authored shape of every objective kind
 * (discriminated by `type`). Mission data and scenario data declare these;
 * {@link ./objectiveRegistry} turns them into steppable states.
 *
 * Positions here are already in world pixels (mission data authors offsets
 * from the battlefield centre and resolves them first).
 *
 * `timeLimit` (seconds) means: for `survive`/`defend`, how long to hold;
 * for every other kind, a deadline — the objective fails if still active.
 */

import type { ObjectivePoint, ObjectiveReward } from "./objectiveTypes";

/** Every objective kind. */
export type ObjectiveType =
  | "eliminate"
  | "survive"
  | "escort"
  | "defend"
  | "capture"
  | "assassinate"
  | "waypoints"
  | "sabotage"
  | "salvage"
  | "protect"
  | "stealth";

/** Fields shared by every objective. */
export interface ObjectiveBase {
  readonly id: string;
  readonly type: ObjectiveType;
  readonly description: string;
  /** Bonus objective: never fails the mission, grants its reward. */
  readonly optional?: boolean | undefined;
  /** Not shown nor stepped until a script reveals it (still blocks victory). */
  readonly hidden?: boolean | undefined;
  /** Seconds — see the module comment. */
  readonly timeLimit?: number | undefined;
  /** Legacy bonus XP (Campaign data v1). */
  readonly xpBonus?: number | undefined;
  readonly reward?: ObjectiveReward | undefined;
  /** Legacy free-text target name (descriptive only). */
  readonly target?: string | undefined;
}

/** Destroy `count` enemies (optionally only ones tagged `tag`). */
export interface EliminateDefinition extends ObjectiveBase {
  readonly type: "eliminate";
  readonly count?: number | undefined;
  readonly tag?: string | undefined;
}

/** Keep a player ship alive for `timeLimit` seconds. */
export interface SurviveDefinition extends ObjectiveBase {
  readonly type: "survive";
}

/** A ship type with a count (convoy transports, escorts). */
export interface ShipGroup {
  readonly shipId: string;
  readonly count: number;
}

/** Transports fly a path; fail when more than `maxLosses` are lost. */
export interface EscortDefinition extends ObjectiveBase {
  readonly type: "escort";
  readonly path: readonly ObjectivePoint[];
  /** Px per second along the path. */
  readonly speed: number;
  readonly transports: ShipGroup;
  readonly maxLosses: number;
  readonly hullScale?: number | undefined;
}

/** A static station that must survive (for `timeLimit`, or the mission). */
export interface DefendDefinition extends ObjectiveBase {
  readonly type: "defend";
  readonly at: ObjectivePoint;
  readonly stationShipId: string;
  readonly hullScale?: number | undefined;
}

/** Control a zone for `holdSeconds` (more weight in range than the foe). */
export interface CaptureDefinition extends ObjectiveBase {
  readonly type: "capture";
  readonly at: ObjectivePoint;
  readonly radius: number;
  readonly holdSeconds: number;
  /** Fail when the enemy holds it for `holdSeconds` first. */
  readonly enemyHoldFails?: boolean | undefined;
}

/** Destroy a named target that may flee along a path. */
export interface AssassinateDefinition extends ObjectiveBase {
  readonly type: "assassinate";
  readonly targetShipId: string;
  readonly at: ObjectivePoint;
  readonly isBoss?: boolean | undefined;
  readonly hullScale?: number | undefined;
  /** Escape route; reaching its end fails the objective. */
  readonly fleePath?: readonly ObjectivePoint[] | undefined;
  readonly fleeSpeed?: number | undefined;
  /** Starts fleeing below this hull fraction... */
  readonly fleeAtHullFraction?: number | undefined;
  /** ...or after this many seconds, whichever first. */
  readonly fleeAfterSeconds?: number | undefined;
}

/** Fly the flagship through each point in order (race / extraction). */
export interface WaypointsDefinition extends ObjectiveBase {
  readonly type: "waypoints";
  readonly points: readonly ObjectivePoint[];
  readonly radius: number;
  /** The last point is drawn as an extraction exit. */
  readonly extraction?: boolean | undefined;
}

/** Keep a player ship within range of a point for `holdSeconds`. */
export interface SabotageDefinition extends ObjectiveBase {
  readonly type: "sabotage";
  readonly at: ObjectivePoint;
  readonly radius: number;
  readonly holdSeconds: number;
  /** Progress lost per second while nobody is in range. */
  readonly decayPerSecond?: number | undefined;
}

/** Carry crates to a drop zone (tabletop Salvage Mission rules). */
export interface SalvageDefinition extends ObjectiveBase {
  readonly type: "salvage";
  readonly crates: readonly ObjectivePoint[];
  readonly dropZone: ObjectivePoint;
  readonly required: number;
  readonly pickupRadius: number;
  readonly dropRadius: number;
}

/** Fail when a player ship tagged `tag` is destroyed (constraint). */
export interface ProtectDefinition extends ObjectiveBase {
  readonly type: "protect";
  readonly tag: string;
}

/** Fail when a player ship lingers in sentry range (constraint). */
export interface StealthDefinition extends ObjectiveBase {
  readonly type: "stealth";
  readonly sentries: readonly ObjectivePoint[];
  readonly radius: number;
  readonly graceSeconds: number;
}

/** Any objective. */
export type ObjectiveDefinition =
  | EliminateDefinition
  | SurviveDefinition
  | EscortDefinition
  | DefendDefinition
  | CaptureDefinition
  | AssassinateDefinition
  | WaypointsDefinition
  | SabotageDefinition
  | SalvageDefinition
  | ProtectDefinition
  | StealthDefinition;
