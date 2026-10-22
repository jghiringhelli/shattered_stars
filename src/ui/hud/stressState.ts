/**
 * Stress readout state — pure, no Phaser. Classifies the player's stress into
 * CALM / NORMAL / RECOVERING / STRESSED using only the current level, the
 * latched `isStressed` flag and the HUD's own memory of the previous level
 * (an extremum anchor), so a tiny hysteresis keeps the label from flickering.
 */

import { clamp01 } from "../theme/colorMath";

/** Level at or below which the pilot reads as CALM. */
export const CALM_ENTER_LEVEL = 0.02;
/** A calm pilot stays calm until the level reaches this (hysteresis gap). */
export const CALM_EXIT_LEVEL = 0.05;
/** Drop below the tracked peak that counts as "falling" (fraction of the bar). */
export const FALL_EPSILON = 0.01;
/**
 * Rise above the tracked trough that ends "recovering". Wider than the fall
 * epsilon: red flying adds ~0.005 per frame and frame batching jitters the
 * level, but a real push (boost +0.15, Snap Turn +0.5) clears it at once.
 */
export const RISE_EPSILON = 0.03;
/** Emphasis length on entering/leaving STRESSED (ms). */
export const EMPHASIS_MS = 700;
/** Reduced-motion emphasis: a steady highlight held this long (ms). */
export const EMPHASIS_HOLD_MS = 1500;
/** Peak emphasis opacity. */
const EMPHASIS_PEAK = 0.5;
/** Reduced-motion emphasis opacity (constant, no animation). */
const EMPHASIS_STEADY = 0.3;

/** The four HUD stress states (CALM and NORMAL are the "calm/normal" group). */
export type StressKind = "calm" | "normal" | "recovering" | "stressed";

/** The HUD's memory between frames. */
export interface StressTrack {
  readonly kind: StressKind;
  /** Running peak (or, while recovering, trough) of the level. */
  readonly anchor: number;
  /** Latched stressed flag: red maneuvers and actions are still refused. */
  readonly locked: boolean;
}

/** Track of a fresh HUD. */
export const INITIAL_STRESS_TRACK: StressTrack = {
  kind: "calm",
  anchor: 0,
  locked: false,
};

/**
 * Advance the stress state by one frame.
 *
 * @param previous - Track from the previous frame.
 * @param level - Stress level 0..1 (NaN/out of range tolerated).
 * @param isStressed - Latched stressed flag from the stress simulation.
 * @returns The new track.
 */
export function stepStressTrack(
  previous: StressTrack,
  level: number,
  isStressed: boolean,
): StressTrack {
  const current = Number.isNaN(level) ? 0 : clamp01(level);
  const wasCalm = previous.kind === "calm";
  const calmLimit = wasCalm ? CALM_EXIT_LEVEL : CALM_ENTER_LEVEL;
  const calm = wasCalm ? current < calmLimit : current <= calmLimit;
  if (!isStressed && calm) {
    return { kind: "calm", anchor: current, locked: false };
  }
  let recovering = previous.kind === "recovering";
  let anchor: number;
  if (recovering) {
    anchor = Math.min(previous.anchor, current);
    if (current >= anchor + RISE_EPSILON) {
      recovering = false;
      anchor = current;
    }
  } else {
    anchor = wasCalm ? current : Math.max(previous.anchor, current);
    if (current <= anchor - FALL_EPSILON) {
      recovering = true;
      anchor = current;
    }
  }
  let kind: StressKind = isStressed ? "stressed" : "normal";
  if (recovering) kind = "recovering";
  return { kind, anchor, locked: isStressed };
}

/**
 * @param level - Stress level 0..1.
 * @returns Whole percent, clamped to 0..100 (NaN → 0).
 */
export function stressPercent(level: number): number {
  return Math.round((Number.isNaN(level) ? 0 : clamp01(level)) * 100);
}

/**
 * @param level - Stress level 0..1.
 * @returns The numeric counter text, e.g. "STRESS 42%".
 */
export function stressCounterText(level: number): string {
  return `STRESS ${stressPercent(level)}%`;
}

/** Suffix while a recovering pilot is still locked out of red moves. */
const LOCKED_SUFFIX = " !";

/**
 * @param track - Current track.
 * @returns The state label; a still-latched recovery carries "!".
 */
export function stressLabel(track: StressTrack): string {
  if (track.kind === "recovering") {
    return track.locked ? `RECOVERING${LOCKED_SUFFIX}` : "RECOVERING";
  }
  return track.kind.toUpperCase();
}

/**
 * Opacity of the enter/leave-STRESSED highlight.
 *
 * @param elapsedMs - Time since the transition.
 * @param reducedMotion - Reduce Motion / Reduce Flashes: steady, no fade.
 * @returns Opacity 0..1; a single fade, never a repeating flash.
 */
export function emphasisAlpha(
  elapsedMs: number,
  reducedMotion: boolean,
): number {
  if (elapsedMs < 0) return 0;
  if (reducedMotion) return elapsedMs < EMPHASIS_HOLD_MS ? EMPHASIS_STEADY : 0;
  if (elapsedMs >= EMPHASIS_MS) return 0;
  return EMPHASIS_PEAK * (1 - elapsedMs / EMPHASIS_MS);
}
