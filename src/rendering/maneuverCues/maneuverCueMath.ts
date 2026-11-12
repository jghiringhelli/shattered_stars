/**
 * Pure rules of the maneuver cue: which flight events the player's ship has
 * just performed (read from two consecutive control states), what glyph and
 * label each gets, and the fade timeline. Render-only: reads the control
 * state, never writes it, no randomness, no Phaser.
 */

import type { ShipControlState } from "../../core/ArcadeControls";
import { torusAxisDelta } from "../../core/Torus";
import type { ManeuverDirection } from "../../core/types";

/** What the cue announces. */
export type ManeuverCueKind = "snap" | "hook" | "knife" | "boost" | "roll";
/** Side of a hook, knife or roll; null for the rest. */
export type ManeuverCueSide = "left" | "right" | null;
/** Distinct glyph shapes (a cue never relies on colour alone). */
export type ManeuverGlyph =
  "hairpin" | "loop" | "blade" | "chevrons" | "ring_arrow";

/** A flight event the player's ship just performed. */
export interface ManeuverEvent {
  readonly kind: ManeuverCueKind;
  readonly side: ManeuverCueSide;
}

/** The control fields the detector reads. */
export type ManeuverSignals = Pick<
  ShipControlState,
  "currentManeuver" | "boostCooldown" | "barrelRollCooldown"
>;

/** A pose, degrees 0 = up, clockwise (ShipState convention). */
export interface MotionPose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** Two consecutive observations of the player's ship. */
export interface ManeuverObservation {
  /** Signals of the previous frame; null before the first one. */
  readonly prev: ManeuverSignals | null;
  readonly next: ManeuverSignals;
  readonly prevPose: MotionPose;
  readonly nextPose: MotionPose;
  /** Torus side length (<= 0 for an unwrapped plane). */
  readonly worldSize: number;
}

/** Fade-in, hold and fade-out of the glyph and label (ms). */
export const CUE_FADE_IN_MS = 100;
export const CUE_HOLD_MS = 600;
export const CUE_FADE_OUT_MS = 300;
export const CUE_TOTAL_MS = CUE_FADE_IN_MS + CUE_HOLD_MS + CUE_FADE_OUT_MS;
/** How long an afterimage lasts (ms). */
export const GHOST_LIFE_MS = 250;
/** Afterimages drawn per cue. */
export const GHOST_COUNT = 3;
/** Peak alpha of the nearest afterimage. */
const GHOST_PEAK_ALPHA = 0.45;
/** Each older afterimage keeps this fraction of the previous one's alpha. */
const GHOST_FALLOFF = 0.7;

const KIND_LABELS: Readonly<Record<ManeuverCueKind, string>> = {
  snap: "SNAP",
  hook: "HOOK",
  knife: "KNIFE",
  boost: "BOOST",
  roll: "ROLL",
};
const KIND_GLYPHS: Readonly<Record<ManeuverCueKind, ManeuverGlyph>> = {
  snap: "hairpin",
  hook: "loop",
  knife: "blade",
  boost: "chevrons",
  roll: "ring_arrow",
};
const SIDED_KINDS: ReadonlySet<ManeuverCueKind> = new Set([
  "hook",
  "knife",
  "roll",
]);

/** Special maneuvers and the cue each one raises. */
const SPECIAL_EVENTS: Readonly<
  Partial<Record<ManeuverDirection, ManeuverEvent>>
> = {
  kturn: { kind: "snap", side: null },
  segnor_left: { kind: "hook", side: "left" },
  segnor_right: { kind: "hook", side: "right" },
  tallon_left: { kind: "knife", side: "left" },
  tallon_right: { kind: "knife", side: "right" },
};

/** @returns The short HUD label of a cue. */
export function cueLabel(kind: ManeuverCueKind): string {
  return KIND_LABELS[kind];
}

/** @returns The glyph shape of a cue. */
export function cueGlyph(kind: ManeuverCueKind): ManeuverGlyph {
  return KIND_GLYPHS[kind];
}

/** @returns True when the cue shows a side arrow (hook, knife, roll). */
export function cueUsesSide(kind: ManeuverCueKind): boolean {
  return SIDED_KINDS.has(kind);
}

/**
 * @param observation - The previous and current signals and poses.
 * @returns The event performed between them (a special maneuver entering,
 * else a barrel roll or boost whose cooldown just restarted), or null.
 */
export function detectManeuverEvent(
  observation: ManeuverObservation,
): ManeuverEvent | null {
  const { prev, next } = observation;
  if (prev === null) return null;
  const special =
    next.currentManeuver !== prev.currentManeuver &&
    next.currentManeuver !== null
      ? SPECIAL_EVENTS[next.currentManeuver]
      : undefined;
  if (special) return special;
  if (next.barrelRollCooldown > prev.barrelRollCooldown) {
    return { kind: "roll", side: rollSide(observation) };
  }
  if (next.boostCooldown > prev.boostCooldown) {
    return { kind: "boost", side: null };
  }
  return null;
}

/** Roll side: the displacement's lateral part against the heading it started on. */
function rollSide(observation: ManeuverObservation): "left" | "right" {
  const { prevPose, nextPose, worldSize } = observation;
  const dx = wrappedDelta(prevPose.x, nextPose.x, worldSize);
  const dy = wrappedDelta(prevPose.y, nextPose.y, worldSize);
  const heading = (prevPose.angle * Math.PI) / 180;
  const lateral = dx * Math.cos(heading) + dy * Math.sin(heading);
  return lateral < 0 ? "left" : "right";
}

function wrappedDelta(from: number, to: number, worldSize: number): number {
  return worldSize > 0 ? torusAxisDelta(from, to, worldSize) : to - from;
}

/**
 * @param ageMs - Time since the cue started.
 * @returns Glyph and label alpha 0..1: ~100 ms fade in, ~600 ms hold, ~300 ms
 * fade out; 0 outside the cue.
 */
export function cueAlpha(ageMs: number): number {
  if (ageMs <= 0 || ageMs >= CUE_TOTAL_MS) return 0;
  if (ageMs < CUE_FADE_IN_MS) return ageMs / CUE_FADE_IN_MS;
  const fadeOutStart = CUE_FADE_IN_MS + CUE_HOLD_MS;
  if (ageMs <= fadeOutStart) return 1;
  return (CUE_TOTAL_MS - ageMs) / CUE_FADE_OUT_MS;
}

/**
 * @param ageMs - Time since the cue started.
 * @param index - 0 = nearest afterimage, higher = older and fainter.
 * @returns Afterimage alpha: linear fade over {@link GHOST_LIFE_MS}.
 */
export function ghostAlpha(ageMs: number, index: number): number {
  if (ageMs >= GHOST_LIFE_MS) return 0;
  const life = 1 - Math.max(0, ageMs) / GHOST_LIFE_MS;
  return GHOST_PEAK_ALPHA * life * GHOST_FALLOFF ** index;
}
