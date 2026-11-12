/**
 * ArcadeFlightTypes — the data contracts of the arcade flight recorder: what
 * a flight is asked to do (options, scripted actions and interrupts) and what
 * it records.
 *
 * Pure: no Phaser.
 */

import type { ManeuverDirection } from "../../core/types";
import type { MotionAction } from "../../arcade/systems/ShipActions";
import type { Pose } from "./XWingFlightOracle";

/** The scene's fixed simulation step (ArcadeBattleScene.FIXED_DT). */
export const ARCADE_FIXED_TICK_MS = 1000 / 60;

/** One telemetry sample, in the unwrapped frame of reference. */
export interface TelemetrySample {
  readonly tMs: number;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** Everything recorded while flying a plan. */
export interface FlightRecord {
  /** Base size used for this ship (px). */
  readonly baseSize: number;
  /** Unwrapped pose at the end of each cycle, in plan order. */
  readonly cyclePoses: Pose[];
  /** Simulation time at which each cycle completed (ms). */
  readonly cycleEndMs: number[];
  /**
   * The speed each cycle was flown at (control.cycleSpeed: the plan's set
   * speed after the dial cap) — what the oracle must be asked about.
   */
  readonly cycleSpeeds: number[];
  /** The maneuver each cycle flew. */
  readonly cycleDirections: ManeuverDirection[];
  /**
   * Share of each cycle that was flown: 1 for a cycle that ran to its
   * boundary, less for one a scripted interrupt cut short.
   */
  readonly cycleFractions: number[];
  /** Every tick, unwrapped. */
  readonly samples: TelemetrySample[];
  /** Largest single-tick displacement observed (px) — teleport detector. */
  readonly maxTickJumpPx: number;
}

/** A flight action fired at a simulation time. */
export interface TimedAction {
  readonly atMs: number;
  readonly action: MotionAction;
}

/** A turn the pilot requests at a simulation time (null = straight). */
export interface TimedInterrupt {
  readonly atMs: number;
  readonly direction: ManeuverDirection | null;
}

/** Options for flyArcadeShip. */
export interface FlightOptions {
  /** Start pose (default: battlefield centre, facing up). */
  readonly start?: Pose;
  /** Tick length; a function receives the tick index (default 60 Hz fixed). */
  readonly tickMs?: number | ((tick: number) => number);
  /** Flight actions (boost, barrel roll, Snap turn…) triggered at given times. */
  readonly actions?: ReadonlyArray<TimedAction>;
  /**
   * Human turns that cut the running cycle (instant turns). Each replaces the
   * plan step that would have followed the cycle it cuts: it is flown as a full
   * cycle from the cut pose, and the plan resumes with the step after it.
   */
  readonly interrupts?: ReadonlyArray<TimedInterrupt>;
  /** Battlefield edge length (default BATTLEFIELD_SIZE). */
  readonly worldSize?: number;
  /**
   * Fly with the ship's dial speed caps like the game does (default true);
   * false flies every plan speed as set (raw template geometry).
   */
  readonly dialCaps?: boolean;
}
