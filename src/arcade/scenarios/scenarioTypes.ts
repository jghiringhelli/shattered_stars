/**
 * scenarioTypes — data contracts of the X-Wing 2.0 Scenario mode: the
 * per-frame view the rules read, the objective states they keep and the
 * match result. Ships and markers reuse the mission-objective contracts
 * (src/arcade/objectives) so both modes speak the same language.
 *
 * Pure data. Coordinates are world px on the toroidal battlefield.
 */

import type {
  MarkerController,
  ObjectivePoint,
  ObjectiveShip,
  ObjectiveSide,
} from "../objectives";

/** The four tabletop scenarios. */
export type ScenarioId =
  | "satellite_array"
  | "chance_engagement"
  | "salvage_mission"
  | "scramble_transmissions";

/** A side of a scenario match: the player's or the opponent's. */
export type ScenarioSide = ObjectiveSide;

/** Who holds an objective right now. */
export type ObjectiveOwner = MarkerController;

/** A living ship as the scenario rules see it. */
export interface ScenarioShip extends ObjectiveShip {
  /** What destroying it is worth to the other side (scenario points). */
  readonly value: number;
  /** (hull + shields) / (max hull + max shields), 0–1. */
  readonly healthFraction: number;
}

/** Something that happened since the previous frame. */
export type ScenarioEvent =
  | {
      readonly kind: "destroyed";
      readonly shipId: string;
      readonly side: ScenarioSide;
      readonly value: number;
      readonly x: number;
      readonly y: number;
    }
  | {
      /** Boost or barrel roll, where it started (drops carried salvage). */
      readonly kind: "evasive";
      readonly shipId: string;
      readonly x: number;
      readonly y: number;
    };

/** One frame of the battle, as the scenario rules read it. */
export interface ScenarioFrame {
  readonly deltaMs: number;
  /** Torus side length (<= 0 for a plane). */
  readonly worldSize: number;
  /** Living ships. */
  readonly ships: readonly ScenarioShip[];
  readonly events: readonly ScenarioEvent[];
  /**
   * Reinforced battles: whether each side can still field a ship. A side
   * with no living ship is only annihilated when it cannot.
   */
  readonly reserves?: Readonly<Record<ScenarioSide, boolean>>;
}

/** How a scenario's objectives score. */
export type ScenarioObjectiveKind = "control" | "scramble" | "salvage";

/** A control objective (satellite, central objective). */
export interface ControlZone extends ObjectivePoint {
  readonly id: string;
  /** Short letter shown on markers ("A", "B"...). */
  readonly label: string;
  readonly radius: number;
  readonly controller: ObjectiveOwner;
}

/** A network node of Scramble the Transmissions. */
export interface ScrambleNode extends ObjectivePoint {
  readonly id: string;
  readonly label: string;
  readonly radius: number;
  /** The side that scrambled it last (scores each round), or null. */
  readonly owner: ScenarioSide | null;
  /** The side scrambling it now, or null. */
  readonly progressSide: ScenarioSide | null;
  /** How long `progressSide` has held it uncontested (ms). */
  readonly progressMs: number;
  /** Who is in range of it right now. */
  readonly controller: ObjectiveOwner;
}

/** A salvage crate of Salvage Mission. */
export interface SalvageCrate extends ObjectivePoint {
  readonly id: string;
  readonly label: string;
  /** Ship carrying it, or null when it lies loose. */
  readonly carrierId: string | null;
  readonly carrierSide: ScenarioSide | null;
}

/** A side's points, by source. */
export interface SidePoints {
  /** From objectives, scored at each round's end. */
  readonly objective: number;
  /** From damaging (half) and destroying (full) enemy ships. */
  readonly destruction: number;
}

/** Why a match ended. */
export type ScenarioEndReason = "threshold" | "time" | "annihilation";

/** How a match ended. */
export interface ScenarioResult {
  readonly winner: ScenarioSide | "draw";
  readonly reason: ScenarioEndReason;
  readonly points: Readonly<Record<ScenarioSide, SidePoints>>;
  readonly rounds: number;
  readonly elapsedMs: number;
}
