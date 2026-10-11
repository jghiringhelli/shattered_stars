/**
 * PilotThrottle — ↑/↓ step the throttle one notch per press, except when
 * the press is the second tap of a gesture (↑↑ boost / Tallon, ↓↓ K-turn /
 * Segnor): then both taps were the gesture, not throttle, and the speed goes
 * back to what it was before the first tap.
 *
 * Pure: no Phaser.
 */

import type { ShipControlState } from "../../core/ArcadeControls";

/** Speed before the latest single ↑ / ↓ tap (null = none pending). */
export interface ThrottleMemory {
  readonly up: number | null;
  readonly down: number | null;
}

/** No tap pending. */
export const IDLE_THROTTLE: ThrottleMemory = { up: null, down: null };

/** This frame's throttle input. */
export interface ThrottleInput {
  readonly upPressed: boolean;
  readonly downPressed: boolean;
  /** The ↑ press completed a ↑↑ gesture (boost / Tallon). */
  readonly upGesture: boolean;
  /** The ↓ press completed a ↓↓ gesture (K-turn / Segnor). */
  readonly downGesture: boolean;
}

/** Result of one frame of throttle input. */
export interface ThrottleResult {
  readonly control: ShipControlState;
  readonly memory: ThrottleMemory;
}

/**
 * Apply one frame of ↑/↓ presses to the throttle.
 *
 * @param control - Control state before the frame.
 * @param memory - Speeds remembered from earlier taps.
 * @param input - Presses and whether they completed a gesture.
 * @returns New control state and memory.
 */
export function applyThrottle(
  control: ShipControlState,
  memory: ThrottleMemory,
  input: ThrottleInput,
): ThrottleResult {
  let speed = control.speed;
  let { up, down } = memory;
  if (input.upPressed) {
    if (input.upGesture) {
      speed = up ?? speed;
      up = null;
    } else {
      up = speed;
      speed = Math.min(control.maxSpeed, speed + 1);
    }
  }
  if (input.downPressed) {
    if (input.downGesture) {
      speed = down ?? speed;
      down = null;
    } else {
      down = speed;
      speed = Math.max(control.minSpeed, speed - 1);
    }
  }
  return { control: { ...control, speed }, memory: { up, down } };
}
