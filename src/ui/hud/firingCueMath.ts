/**
 * Pure rules of the firing cue: where the nearest hostiles are relative to
 * the player's primary weapon envelope (range + forward arc), which one the
 * cue talks about, whether the player has to turn and which way. Torus-aware
 * (every delta takes the short way across the seam). Render-only: it never
 * changes targeting or firing; it mirrors ArcTargeting's rule (strictly
 * inside the range, within half the arc of the nose). No Phaser.
 */

import { rotateToHeadingUp, shortestDelta } from "./hudMath";
import type { ContactHudState, HudPoint, HudPose } from "./types";

/** The cue appears while a hostile is within this many weapon ranges. */
export const FIRING_CUE_VISIBLE_RANGE_FACTOR = 2;
/** An arc this wide or wider is a turret: no heading to correct. */
const TURRET_ARC_DEG = 360;
const RAD_TO_DEG = 180 / Math.PI;

/** The primary weapon's reach. */
export interface FiringEnvelope {
  /** Maximum range in px (exclusive). */
  readonly rangePx: number;
  /** Full forward arc in degrees (half on each side of the nose). */
  readonly arcDeg: number;
}

/** Why the weapon can or cannot fire at a hostile. */
export type HostileFireState = "in_range" | "out_of_arc" | "out_of_range";

/** Which way to turn to bring a hostile into the arc. */
export type TurnHintSide = "left" | "right";

/** A hostile measured from the player's ship. */
export interface HostileReading {
  /** World offset from the player to the hostile's nearest torus image. */
  readonly dx: number;
  readonly dy: number;
  readonly distancePx: number;
  /** Degrees off the nose, right of the nose positive, in (-180, 180]. */
  readonly bearingDeg: number;
  readonly state: HostileFireState;
}

/** The hostile the cue talks about. */
export interface FocusReading extends HostileReading {
  readonly id: string;
}

/** Everything the cue draws for one frame. */
export interface FiringCueModel {
  readonly envelope: FiringEnvelope;
  /** True while at least one hostile can be fired at right now. */
  readonly anyInWedge: boolean;
  readonly focus: FocusReading;
  /** Turn direction toward the focus when nothing is in the wedge. */
  readonly turnHint: TurnHintSide | null;
}

/** Where the player and a hostile are. */
export interface HostileQuery {
  readonly pose: HudPose;
  readonly hostile: HudPoint;
  /** Torus side length (<= 0 for an unwrapped plane). */
  readonly worldSize: number;
}

/** Input of {@link buildFiringCue}. */
export interface FiringCueInput {
  readonly pose: HudPose;
  /** The weapon's envelope; null = unknown (no cue). */
  readonly envelope: FiringEnvelope | null;
  readonly contacts: ReadonlyArray<ContactHudState>;
  readonly worldSize: number;
}

const STATE_TEXT: Readonly<Record<HostileFireState, string>> = {
  in_range: "IN RANGE",
  out_of_arc: "OUT OF ARC",
  out_of_range: "OUT OF RANGE",
};

/**
 * @param state - A hostile's fire state.
 * @returns The short text shown on the hostile.
 */
export function firingStateText(state: HostileFireState): string {
  return STATE_TEXT[state];
}

/**
 * @param distancePx - Distance to the hostile.
 * @param bearingDeg - Degrees off the nose (either sign).
 * @param envelope - The weapon's range and arc.
 * @returns Out of range first (too far to matter which way it points), then
 * out of arc, else in range.
 */
export function classifyHostile(
  distancePx: number,
  bearingDeg: number,
  envelope: FiringEnvelope,
): HostileFireState {
  if (distancePx >= envelope.rangePx) return "out_of_range";
  if (envelope.arcDeg >= TURRET_ARC_DEG) return "in_range";
  return Math.abs(bearingDeg) < envelope.arcDeg / 2 ? "in_range" : "out_of_arc";
}

/**
 * @param bearingDeg - Degrees off the nose, right positive.
 * @param arcDeg - The weapon's full arc.
 * @returns The side to turn toward, or null inside the arc and for a turret.
 * A hostile dead astern gets "right".
 */
export function turnHintSide(
  bearingDeg: number,
  arcDeg: number,
): TurnHintSide | null {
  if (arcDeg >= TURRET_ARC_DEG) return null;
  if (Math.abs(bearingDeg) < arcDeg / 2) return null;
  return bearingDeg < 0 ? "left" : "right";
}

/**
 * @param query - Player pose, hostile position and world size.
 * @param envelope - The weapon's range and arc.
 * @returns Distance, bearing off the nose and fire state of the hostile.
 */
export function readHostile(
  query: HostileQuery,
  envelope: FiringEnvelope,
): HostileReading {
  const delta = shortestDelta(query.pose, query.hostile, query.worldSize);
  return readDelta(delta.x, delta.y, query.pose.angle, envelope);
}

function readDelta(
  dx: number,
  dy: number,
  headingDeg: number,
  envelope: FiringEnvelope,
): HostileReading {
  const local = rotateToHeadingUp({ x: dx, y: dy }, headingDeg);
  const distancePx = Math.hypot(dx, dy);
  const bearingDeg = Math.atan2(local.x, -local.y) * RAD_TO_DEG;
  return {
    dx,
    dy,
    distancePx,
    bearingDeg,
    state: classifyHostile(distancePx, bearingDeg, envelope),
  };
}

/** Focus rank: marked/locked in the wedge > nearest in the wedge > marked/locked > nearest. */
function focusRank(reading: HostileReading, contact: ContactHudState): number {
  const prioritised = contact.isTarget || contact.isMarked === true ? 1 : 0;
  return (reading.state === "in_range" ? 2 : 0) + prioritised;
}

/**
 * Picks the hostile the cue talks about and what to draw. Cheap when nothing
 * is near: one distance test per enemy contact, nothing allocated for those
 * beyond {@link FIRING_CUE_VISIBLE_RANGE_FACTOR} weapon ranges.
 *
 * @param input - Player pose, weapon envelope, contacts and world size.
 * @returns The cue model, or null with no envelope or no hostile near.
 */
export function buildFiringCue(input: FiringCueInput): FiringCueModel | null {
  const { envelope, pose } = input;
  if (envelope === null || !(envelope.rangePx > 0) || !(envelope.arcDeg > 0)) {
    return null;
  }
  const visibleRange = envelope.rangePx * FIRING_CUE_VISIBLE_RANGE_FACTOR;
  let focus: FocusReading | null = null;
  let focusScore = -1;
  let anyInWedge = false;
  for (const contact of input.contacts) {
    if (contact.side !== "enemy" || !contact.alive) continue;
    const delta = shortestDelta(pose, contact.pose, input.worldSize);
    if (Math.hypot(delta.x, delta.y) > visibleRange) continue;
    const reading = readDelta(delta.x, delta.y, pose.angle, envelope);
    anyInWedge ||= reading.state === "in_range";
    const rank = focusRank(reading, contact);
    const beats =
      rank > focusScore ||
      (rank === focusScore && focus !== null && reading.distancePx < focus.distancePx);
    if (!beats) continue;
    focus = { ...reading, id: contact.id };
    focusScore = rank;
  }
  if (focus === null) return null;
  return {
    envelope,
    anyInWedge,
    focus,
    turnHint: anyInWedge ? null : turnHintSide(focus.bearingDeg, envelope.arcDeg),
  };
}
