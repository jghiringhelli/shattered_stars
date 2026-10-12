/**
 * Key-combo telemetry harness — plays a scripted keyboard timeline through
 * the real player flight path (PlayerFlightPilot → PilotFlightControls →
 * CycleFlight) and records every completed maneuver cycle, so tests can
 * compare where the ship ended with where the X-Wing oracle puts it.
 */

import type {
  ActionIntent,
  InputEvent,
} from "../../../../src/input/InputTypes";
import {
  PlayerFlightPilot,
  type IntentSource,
} from "../../../../src/arcade/systems/PlayerFlightPilot";
import {
  createCycleFlight,
  tickCycleFlight,
  type CycleFlightState,
} from "../../../../src/arcade/systems/CycleFlight";
import { UNRESTRICTED_CAPABILITIES } from "../../../../src/core/flightCapabilityTypes";
import type { FlightEvent } from "../../../../src/arcade/systems/PilotFlightTypes";
import { getShipDial } from "../../../../src/data/ShipDefinitions";
import { BATTLEFIELD_SIZE, CYCLE_DURATION_MS } from "../../../../src/config";
import type { ManeuverDirection } from "../../../../src/core/types";
import type { Pose } from "../../../../src/simulation/flight/XWingFlightOracle";

/** Fixed simulation tick (60 Hz). */
export const TICK_MS = 1000 / 60;

/** A held key (arrows) or a press of a bound action key. */
export type ScriptKey = "LEFT" | "RIGHT" | "UP" | "DOWN";

/** One step of a keyboard timeline. */
export type ScriptEvent =
  | { readonly atMs: number; readonly down: ScriptKey }
  | { readonly atMs: number; readonly up: ScriptKey }
  | { readonly atMs: number; readonly press: ActionIntent };

/** A completed maneuver cycle. */
export interface FlownCycle {
  readonly direction: ManeuverDirection;
  readonly speed: number;
  readonly start: Pose;
  readonly end: Pose;
}

/** Everything the timeline produced. */
export interface FlightTrace {
  readonly cycles: FlownCycle[];
  readonly events: { atMs: number; event: FlightEvent }[];
  readonly final: CycleFlightState;
  readonly peakStress: number;
}

const HELD_INTENT: Record<ScriptKey, ActionIntent> = {
  LEFT: "STEER_LEFT",
  RIGHT: "STEER_RIGHT",
  UP: "THRUST_UP",
  DOWN: "THRUST_DOWN",
};

/** Keyboard stand-in: held intents plus press events, like InputManager. */
class ScriptedIntents implements IntentSource {
  readonly held = new Set<ActionIntent>();
  private readonly listeners = new Map<number, (event: InputEvent) => void>();
  private nextId = 1;
  isHeld(intent: ActionIntent): boolean {
    return this.held.has(intent);
  }
  onAny(callback: (event: InputEvent) => void): number {
    this.listeners.set(this.nextId, callback);
    return this.nextId++;
  }
  off(id: number): boolean {
    return this.listeners.delete(id);
  }
  press(intent: ActionIntent): void {
    for (const listener of this.listeners.values()) {
      listener({
        intent,
        value: 1,
        source: "keyboard",
        timestamp: 0,
      } as InputEvent);
    }
  }
}

/** Options for {@link flyScript}. */
export interface ScriptOptions {
  readonly shipId: string;
  readonly start: Pose;
  readonly durationMs: number;
  readonly events: readonly ScriptEvent[];
}

/**
 * Fly a keyboard timeline on the real engine.
 * @param options - Ship, start pose, duration and timeline.
 * @returns Every completed cycle and flight event.
 */
export function flyScript(options: ScriptOptions): FlightTrace {
  const intents = new ScriptedIntents();
  const pilot = new PlayerFlightPilot(intents);
  pilot.attach();
  const dial = getShipDial(options.shipId);
  // Keys → geometry only: fly the trainer configuration (every special and
  // dash unlocked, as in Flight School). Card limits have their own specs
  // (FlightCapabilities, PilotFlightControls, e2e key-bindings).
  const built = createCycleFlight(options.shipId, options.start);
  let flight: CycleFlightState = {
    ...built,
    motion: {
      ...built.motion,
      control: {
        ...built.motion.control,
        capabilities: UNRESTRICTED_CAPABILITIES,
      },
    },
  };
  let cycleStart: Pose = options.start;
  const pending = [...options.events].sort((a, b) => a.atMs - b.atMs);
  const trace: FlightTrace = {
    cycles: [],
    events: [],
    final: flight,
    peakStress: 0,
  };

  for (let now = 0; now < options.durationMs; now += TICK_MS) {
    while (pending.length > 0 && pending[0]!.atMs <= now)
      applyEvent(intents, pending.shift()!);
    const flown = pilot.fly({
      flight,
      ship: flight.motion,
      dial,
      nowMs: now,
      deltaMs: TICK_MS,
      worldSize: BATTLEFIELD_SIZE,
    });
    flight = { motion: flown.motion, stress: flown.stress };
    for (const event of flown.events) trace.events.push({ atMs: now, event });
    const tick = tickCycleFlight(flight, {
      deltaMs: TICK_MS,
      worldSize: BATTLEFIELD_SIZE,
      dial,
      cycleMs: CYCLE_DURATION_MS,
    });
    flight = tick.state;
    trace.peakStress = Math.max(trace.peakStress, flight.stress.level);
    if (!tick.completed) continue;
    const { direction, speed, endPose } = tick.completed;
    trace.cycles.push({ direction, speed, start: cycleStart, end: endPose });
    cycleStart = endPose;
    pilot.onCycleCommitted(flight.motion.control.currentManeuver ?? "straight");
  }
  return { ...trace, final: flight };
}

function applyEvent(intents: ScriptedIntents, event: ScriptEvent): void {
  if ("down" in event) intents.held.add(HELD_INTENT[event.down]);
  else if ("up" in event) intents.held.delete(HELD_INTENT[event.up]);
  else intents.press(event.press);
}

/**
 * A quick key press: down at `atMs`, up `holdMs` later.
 * @param key - The held key.
 * @param atMs - Press time.
 * @param holdMs - How long it stays down.
 * @returns The two timeline events.
 */
export function tap(key: ScriptKey, atMs: number, holdMs = 60): ScriptEvent[] {
  return [
    { atMs, down: key },
    { atMs: atMs + holdMs, up: key },
  ];
}
