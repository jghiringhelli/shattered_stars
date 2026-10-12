/**
 * BeltWarning — when the asteroid-belt warning sounds and what it says
 * (pure). The HUD shows the warning while the player's ship is near or in
 * the belt; the audio cue sounds once on each approach, on entering the
 * belt, and keeps repeating while the ship stays inside it.
 */

import type { BeltWarningLevel } from "./ArenaBoundary";

/** While inside the belt, the cue repeats this often (ms). */
export const BELT_CUE_REPEAT_MS = 1500;

/** What the cue remembers between frames. */
export interface BeltCueState {
  readonly level: BeltWarningLevel;
  /** Time the cue last sounded (ms), or null when it has not yet. */
  readonly lastCueMs: number | null;
}

/** The cue before the battle starts. */
export const INITIAL_BELT_CUE: BeltCueState = {
  level: "clear",
  lastCueMs: null,
};

/** Severity order of the warning levels. */
const SEVERITY: Readonly<Record<BeltWarningLevel, number>> = {
  clear: 0,
  near: 1,
  inside: 2,
};

/**
 * @param state - The cue so far.
 * @param level - The ship's warning level this frame.
 * @param nowMs - The current time (ms).
 * @returns Whether the cue sounds now, and the cue's next state.
 */
export function beltCue(
  state: BeltCueState,
  level: BeltWarningLevel,
  nowMs: number,
): { readonly play: boolean; readonly state: BeltCueState } {
  const worsened = SEVERITY[level] > SEVERITY[state.level];
  const repeatDue =
    level === "inside" &&
    state.level === "inside" &&
    state.lastCueMs !== null &&
    nowMs - state.lastCueMs >= BELT_CUE_REPEAT_MS;
  const play = worsened || repeatDue;
  return {
    play,
    state: { level, lastCueMs: play ? nowMs : state.lastCueMs },
  };
}

/** Warning line per level (the HUD pairs it with an icon and a pulse). */
const WARNING_TEXT: Readonly<Record<BeltWarningLevel, string>> = {
  clear: "",
  near: "BELT AHEAD — STEER TO CENTRE",
  inside: "ASTEROID BELT — TURN BACK",
};

/**
 * @param level - The ship's warning level.
 * @returns The warning line to show ("" when clear).
 */
export function beltWarningText(level: BeltWarningLevel): string {
  return WARNING_TEXT[level];
}

/** Lowest opacity of the pulsing warning (it never fades out completely). */
export const BELT_PULSE_MIN_ALPHA = 0.35;

/** Pulse period per level (ms): faster once inside the belt. */
export const BELT_PULSE_PERIOD_MS: Readonly<
  Record<Exclude<BeltWarningLevel, "clear">, number>
> = { near: 1200, inside: 600 };

/**
 * @param level - The ship's warning level.
 * @param nowMs - The current time (ms).
 * @returns The warning's opacity now (0 when clear, else pulsing between
 *   BELT_PULSE_MIN_ALPHA and 1).
 */
export function beltPulseAlpha(level: BeltWarningLevel, nowMs: number): number {
  if (level === "clear") return 0;
  const phase = (nowMs / BELT_PULSE_PERIOD_MS[level]) * Math.PI;
  const wave = Math.abs(Math.sin(phase));
  return BELT_PULSE_MIN_ALPHA + (1 - BELT_PULSE_MIN_ALPHA) * wave;
}
