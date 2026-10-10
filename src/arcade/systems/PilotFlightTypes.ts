/**
 * PilotFlightTypes — data contracts for the shared pilot flight controls
 * (input frame, per-pilot memory, flown ship, result and effect events).
 */

import type { ShipPose } from "../../core/ArcadeControls";
import type { ManeuverDefinition } from "../../core/types";
import type { GestureState } from "../ArcadeInputGestures";
import type { StressState } from "../ArcadeStress";
import type { HeldSteering } from "../SteeringIntent";
import type { MotionState } from "./ShipMotion";

/** Edge-triggered flight intents (fired once per key press). */
export type FlightEdge =
  | "THRUST_UP"
  | "THRUST_DOWN"
  | "KTURN"
  | "SHARP_TURN_LEFT"
  | "SHARP_TURN_RIGHT"
  | "SEGNOR_LEFT"
  | "SEGNOR_RIGHT"
  | "TALLON_LEFT"
  | "TALLON_RIGHT"
  | "BOOST";

/** One frame of flight input. */
export interface FlightInput {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
  readonly edges: ReadonlySet<FlightEdge>;
  readonly nowMs: number;
  readonly deltaMs: number;
  /** Whether left+right chords trigger a barrel roll (scene setting). */
  readonly allowChordBarrelRoll: boolean;
}

/** Per-pilot input memory between frames. */
export interface PilotControlState {
  readonly gesture: GestureState;
  readonly steering: HeldSteering;
}

/** The ship being flown, as far as flight controls care. */
export interface FlownShip {
  readonly ship: ShipPose;
  readonly motion: MotionState;
  readonly stress: StressState;
  readonly dial: readonly ManeuverDefinition[];
}

/** Something the scene should show (sound, afterimage, trail, lean). */
export type FlightEvent =
  "kturn" | "segnor" | "tallon" | "boost" | "barrel_roll" | "hard_turn";

/** Result of one frame of flight input. */
export interface FlightControlResult {
  readonly pilot: PilotControlState;
  readonly motion: MotionState;
  readonly stress: StressState;
  readonly events: FlightEvent[];
}
