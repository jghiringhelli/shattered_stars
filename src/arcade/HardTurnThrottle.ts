/**
 * HardTurnThrottle — the throttle a 90° turn (Q/E) is queued with, shared by
 * the player's controls and the bots' planner.
 *
 * Pure: no Phaser.
 */

import { flownSpeed, type DialSpeedTable } from "../core/speedCap";
import type { ManeuverDefinition } from "../core/types";
import { findBestTurnSpeed, lookupDialDifficulty } from "./ArcadeStress";
/** Inputs for {@link hardTurnThrottle}. */
export interface HardTurnInput {
  readonly dial: readonly ManeuverDefinition[];
  /** The ship's speed cap table; omitted = no cap (the throttle is retuned). */
  readonly dialSpeeds?: DialSpeedTable | undefined;
  /** The set throttle. */
  readonly speed: number;
  readonly minSpeed: number;
  readonly maxSpeed: number;
  readonly isStressed: boolean;
}

/**
 * The throttle a 90° turn is queued with. With the speed cap the turn is
 * flown at min(throttle, the dial's turn speed), so the throttle is left
 * alone (set and forget) — except for a stressed pilot whose capped turn
 * would be red, who is retuned to the best allowed turn speed
 * ({@link findBestTurnSpeed}). Without a cap table that retune always applies.
 *
 * @param input - Dial, cap table, throttle bounds and stress.
 * @returns The throttle to fly the turn with, or null when the dial has no turn.
 */
export function hardTurnThrottle(input: HardTurnInput): number | null {
  const retuned = findBestTurnSpeed(
    input.dial,
    input.speed,
    input.minSpeed,
    input.maxSpeed,
    input.isStressed,
  );
  if (retuned === null || !input.dialSpeeds) return retuned;
  if (!input.isStressed) return input.speed;
  const flown = flownSpeed(input.dialSpeeds, "turn_left", input.speed);
  const difficulty = lookupDialDifficulty("turn_left", flown, input.dial);
  return difficulty === "red" ? retuned : input.speed;
}
