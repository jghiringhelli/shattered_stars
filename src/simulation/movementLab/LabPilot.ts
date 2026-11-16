/**
 * LabPilot — the key-pressing styles the movement lab compares, each written
 * for both engines the way a person would play it there.
 *
 * - proportional: presses what the heading error asks for. Template: Q/E for
 *   a big error, the arrow (bank, then drifts) for a medium one, nothing
 *   when close. Analog: the one key while there is error.
 * - tapper: only ever taps the arrow in short pulses while there is error,
 *   one pulse at least 233 ms after the last (never reads as a roll).
 * - fast-tapper: the same at 150 ms between pulses, inside the roll
 *   double-tap window (220 ms): shows what frantic tapping does.
 *
 * Pure: no Phaser.
 */

import type { FlightEdge } from "../../arcade/systems/PilotFlightControls";
import type { SteeringMode } from "../../core/steeringMode";
import type { ManeuverDirection } from "../../core/types";
import { NO_KEYS, TICK_MS, type LabKeys } from "./LabShip";

export type LabPilotKind = "proportional" | "tapper" | "fast-tapper";

/**
 * Heading error (°) from which the template pilot flies a hard turn: the
 * best of a 12-67° sweep on the duel (aggressive Q/E beats cautious banking).
 */
const TEMPLATE_HARD_TURN_ERROR_DEG = 18;
/** Heading error (°) from which the template pilot holds the arrow. */
const TEMPLATE_BANK_ERROR_DEG = 5;
/** The analog pilot lets go this close to the wanted heading (°). */
const ANALOG_RELEASE_ERROR_DEG = 1.5;
/** The tapper starts a pulse only beyond this heading error (°). */
const TAPPER_START_ERROR_DEG = 4;

/** Press time and time between pulse starts (ms) of each tapper. */
export const TAPPER_TIMING: Readonly<
  Record<"tapper" | "fast-tapper", { pressMs: number; periodMs: number }>
> = {
  tapper: { pressMs: 100, periodMs: 233 },
  "fast-tapper": { pressMs: 75, periodMs: 150 },
};

/** What a pilot sees each tick. */
export interface LabPilotView {
  /** Wanted heading minus heading (°, + = turn right). */
  readonly errorDeg: number;
  /** Ticks flown so far. */
  readonly tick: number;
  readonly currentManeuver: ManeuverDirection | null;
  readonly nextManeuver: ManeuverDirection | null;
}

/** A pilot: the keys it presses given what it sees. */
export type LabPilot = (view: LabPilotView) => LabKeys;

/**
 * @param side - The way to turn.
 * @returns Keys holding that arrow.
 */
function arrow(side: "left" | "right"): LabKeys {
  return { left: side === "left", right: side === "right", edges: NO_KEYS.edges };
}

/**
 * @param view - What the pilot sees.
 * @returns The proportional pilot's keys on the template engine.
 */
function templateProportional(view: LabPilotView): LabKeys {
  const magnitude = Math.abs(view.errorDeg);
  const side = view.errorDeg > 0 ? "right" : "left";
  if (magnitude >= TEMPLATE_HARD_TURN_ERROR_DEG) {
    const turn = `turn_${side}` as const;
    const queued = view.currentManeuver === turn || view.nextManeuver === turn;
    const edge: FlightEdge =
      side === "left" ? "SHARP_TURN_LEFT" : "SHARP_TURN_RIGHT";
    return queued ? NO_KEYS : { ...NO_KEYS, edges: new Set([edge]) };
  }
  return magnitude >= TEMPLATE_BANK_ERROR_DEG ? arrow(side) : NO_KEYS;
}

/**
 * @param view - What the pilot sees.
 * @returns The proportional pilot's keys on the analog engine.
 */
function analogProportional(view: LabPilotView): LabKeys {
  return Math.abs(view.errorDeg) > ANALOG_RELEASE_ERROR_DEG
    ? arrow(view.errorDeg > 0 ? "right" : "left")
    : NO_KEYS;
}

/**
 * @param kind - Which tapper.
 * @returns A tapper: a pulse towards the error, then a wait for the next slot.
 */
function tapper(kind: "tapper" | "fast-tapper"): LabPilot {
  const pressTicks = Math.round(TAPPER_TIMING[kind].pressMs / TICK_MS);
  const periodTicks = Math.round(TAPPER_TIMING[kind].periodMs / TICK_MS);
  let pulseStart = Number.NEGATIVE_INFINITY;
  let side: "left" | "right" = "right";
  return (view) => {
    if (view.tick - pulseStart < pressTicks) return arrow(side);
    const ready = view.tick - pulseStart >= periodTicks;
    if (!ready || Math.abs(view.errorDeg) <= TAPPER_START_ERROR_DEG)
      return NO_KEYS;
    pulseStart = view.tick;
    side = view.errorDeg > 0 ? "right" : "left";
    return arrow(side);
  };
}

/**
 * @param kind - Pilot style.
 * @param engine - Steering engine of the ship.
 * @returns A fresh pilot (tappers keep their pulse timing).
 */
export function createLabPilot(
  kind: LabPilotKind,
  engine: SteeringMode,
): LabPilot {
  if (kind !== "proportional") return tapper(kind);
  return engine === "template" ? templateProportional : analogProportional;
}
