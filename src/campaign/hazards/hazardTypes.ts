/**
 * hazardTypes — environmental hazards a mission can field (SC2-style mission
 * mechanics: Supernova's advancing fire, ion storms, minefields, asteroid
 * belts). Plain data; hazardModel steps them.
 */

import type { ObjectivePoint } from "../../arcade/objectives";

/** Which side a hazard harms. */
export type HazardHarms = "all" | "player" | "enemy";

/** Fields shared by every hazard. */
interface HazardBase {
  readonly id: string;
  /** Starts inactive until a script switches it on. */
  readonly startsInactive?: boolean;
  readonly harms?: HazardHarms;
}

/** Ion storm: drains shields and builds stress inside its radius. */
export interface IonStormDefinition extends HazardBase {
  readonly kind: "ion_storm";
  readonly at: ObjectivePoint;
  readonly radius: number;
  readonly shieldDrainPerSecond: number;
  readonly stressPerSecond?: number;
}

/** Minefield: each mine blasts once when a ship comes within range. */
export interface MinefieldDefinition extends HazardBase {
  readonly kind: "minefield";
  readonly mines: readonly ObjectivePoint[];
  readonly triggerRadius: number;
  readonly damage: number;
}

/** Asteroid belt: an impact every `hitIntervalMs` spent inside. */
export interface AsteroidBeltDefinition extends HazardBase {
  readonly kind: "asteroid_belt";
  readonly at: ObjectivePoint;
  readonly radius: number;
  readonly damagePerHit: number;
  readonly hitIntervalMs: number;
}

/** Flare wall: a front advancing along an axis, burning what it passed. */
export interface FlareWallDefinition extends HazardBase {
  readonly kind: "flare_wall";
  readonly axis: "x" | "y";
  readonly start: number;
  readonly stop: number;
  /** Px per second (sign gives direction). */
  readonly speed: number;
  readonly damagePerSecond: number;
}

/** Any hazard. */
export type HazardDefinition =
  | IonStormDefinition
  | MinefieldDefinition
  | AsteroidBeltDefinition
  | FlareWallDefinition;

/** What a hazard does to one ship this frame. */
export interface HazardEffect {
  readonly shipId: string;
  readonly hullDamage: number;
  readonly shieldDrain: number;
  readonly stress: number;
}

/** A drawable hazard shape. */
export type HazardVisual =
  | {
      readonly id: string;
      readonly kind: "ion_storm" | "asteroid_belt";
      readonly x: number;
      readonly y: number;
      readonly radius: number;
    }
  | {
      readonly id: string;
      readonly kind: "mine";
      readonly x: number;
      readonly y: number;
      readonly radius: number;
      readonly harms: HazardHarms;
    }
  | {
      readonly id: string;
      readonly kind: "flare_wall";
      readonly axis: "x" | "y";
      readonly position: number;
      readonly direction: number;
    };
