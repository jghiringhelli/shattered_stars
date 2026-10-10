/**
 * PlayerFlightPilot — the human pilot of a cycle-engine ship.
 *
 * Reads held steering/throttle and edge-triggered flight intents from an
 * injected intent source (the scene passes InputManager), keeps the pilot's
 * input memory between frames and runs PilotFlightControls. One instance per
 * scene; attach() on create, detach() on shutdown.
 */

import type { ActionIntent, InputEvent } from "../../input/InputTypes";
import type { ShipPose } from "../../core/ArcadeControls";
import type { ManeuverDefinition, ManeuverDirection } from "../../core/types";
import {
  applyPilotFlightInput,
  onPilotCycleCommitted,
  INITIAL_PILOT_CONTROL,
} from "./PilotFlightControls";
import type {
  FlightControlResult,
  FlightEdge,
  PilotControlState,
} from "./PilotFlightTypes";
import type { CycleFlightState } from "./CycleFlight";

/** The slice of InputManager a pilot needs. */
export interface IntentSource {
  isHeld(intent: ActionIntent): boolean;
  onAny(callback: (event: InputEvent) => void): number;
  off(subscriptionId: number): boolean;
}

/** Edge intents that drive flight, consumed once per frame. */
export const FLIGHT_EDGES: readonly FlightEdge[] = [
  "THRUST_UP",
  "THRUST_DOWN",
  "KTURN",
  "SHARP_TURN_LEFT",
  "SHARP_TURN_RIGHT",
  "SEGNOR_LEFT",
  "SEGNOR_RIGHT",
  "TALLON_LEFT",
  "TALLON_RIGHT",
  "BOOST",
];

/** Edges delivered as press events (throttle is detected from held state). */
const EVENT_EDGES: ReadonlySet<string> = new Set(
  FLIGHT_EDGES.filter((edge) => edge !== "THRUST_UP" && edge !== "THRUST_DOWN"),
);

/** One frame of the player's flight, as the scene supplies it. */
export interface PlayerFlightFrame {
  readonly flight: CycleFlightState;
  readonly ship: ShipPose;
  readonly dial: readonly ManeuverDefinition[];
  readonly nowMs: number;
  readonly deltaMs: number;
  readonly worldSize: number;
}

export class PlayerFlightPilot {
  private memory: PilotControlState = INITIAL_PILOT_CONTROL;
  private pending = new Set<FlightEdge>();
  private thrustUpWasHeld = false;
  private thrustDownWasHeld = false;
  private subscriptionId: number | null = null;

  /**
   * @param source - Where intents come from (InputManager in scenes).
   * @param allowChordBarrelRoll - Whether left+right chords barrel roll.
   */
  constructor(
    private readonly source: IntentSource,
    private readonly allowChordBarrelRoll = true,
  ) {}

  /** Start listening for edge-triggered flight intents. */
  attach(): void {
    if (this.subscriptionId !== null) return;
    this.subscriptionId = this.source.onAny((event) => {
      if (EVENT_EDGES.has(event.intent))
        this.pending.add(event.intent as FlightEdge);
    });
  }

  /** Stop listening and forget all input memory. */
  detach(): void {
    if (this.subscriptionId !== null) this.source.off(this.subscriptionId);
    this.subscriptionId = null;
    this.reset();
  }

  /** Forget input memory (new round / respawn). */
  reset(): void {
    this.memory = INITIAL_PILOT_CONTROL;
    this.pending.clear();
    this.thrustUpWasHeld = false;
    this.thrustDownWasHeld = false;
  }

  /**
   * Fly one frame of player input.
   * @param frame - The player's ship and the frame timing.
   * @returns New motion, stress and the effect events to play.
   */
  fly(frame: PlayerFlightFrame): FlightControlResult {
    const result = applyPilotFlightInput(
      this.memory,
      {
        ship: frame.ship,
        motion: frame.flight.motion,
        stress: frame.flight.stress,
        dial: frame.dial,
      },
      {
        left: this.source.isHeld("STEER_LEFT"),
        right: this.source.isHeld("STEER_RIGHT"),
        up: this.source.isHeld("THRUST_UP"),
        down: this.source.isHeld("THRUST_DOWN"),
        edges: this.drainEdges(),
        nowMs: frame.nowMs,
        deltaMs: frame.deltaMs,
        allowChordBarrelRoll: this.allowChordBarrelRoll,
      },
      frame.worldSize,
    );
    this.memory = result.pilot;
    return result;
  }

  /**
   * Tell the pilot a cycle committed on its ship.
   * @param started - The maneuver the new cycle started.
   */
  onCycleCommitted(started: ManeuverDirection): void {
    this.memory = onPilotCycleCommitted(this.memory, started);
  }

  /**
   * Edges since the last frame, including throttle rising edges.
   * @returns The edges, drained.
   */
  private drainEdges(): ReadonlySet<FlightEdge> {
    const up = this.source.isHeld("THRUST_UP");
    const down = this.source.isHeld("THRUST_DOWN");
    if (up && !this.thrustUpWasHeld) this.pending.add("THRUST_UP");
    if (down && !this.thrustDownWasHeld) this.pending.add("THRUST_DOWN");
    this.thrustUpWasHeld = up;
    this.thrustDownWasHeld = down;
    const edges = this.pending;
    this.pending = new Set();
    return edges;
  }
}
