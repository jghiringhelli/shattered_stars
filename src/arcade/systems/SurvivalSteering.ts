/**
 * SurvivalSteering — Survival's AI pilots (wave enemies and escorts)
 * expressed as cycle-engine steering orders for {@link steerAiFlight}.
 *
 * Enemies chase their nearest foe; from {@link ENEMY_KTURN_UNLOCK_WAVE} on
 * they may K-turn onto a target behind them. Escorts chase too, cruising
 * faster with the run's speed bonus but never K-turning (weak basic bodies).
 *
 * Pure: no Phaser.
 */

import type { ShipControlState } from "../../core/ArcadeControls";
import {
  AI_SLOW_TURN_ERROR_DEG,
  pursuitSpeed,
  type AiSteerOrder,
} from "./CycleFlight";
import { seekSteerOrder } from "./AiPursuit";

/** First wave whose enemies may K-turn — after the first milestone boss. */
export const ENEMY_KTURN_UNLOCK_WAVE = 6;

/** Most speed notches the run's speed bonus can add to an escort's cruise. */
export const MAX_ESCORT_SPEED_BONUS = 3;

/** Which side an AI pilot flies for. */
export type SurvivalPilotRole = "enemy" | "escort";

/** A position and heading on the battlefield. */
interface SteerPose {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** What a Survival AI pilot knows this frame. */
export interface SurvivalSteerInput {
  readonly role: SurvivalPilotRole;
  readonly pose: SteerPose;
  readonly target: { readonly x: number; readonly y: number };
  readonly control: Pick<ShipControlState, "minSpeed" | "maxSpeed">;
  /** True on the frame this ship's cycle committed. */
  readonly cycleCommitted: boolean;
  /** Current wave number (1-based). */
  readonly wave: number;
  /** The run's speed bonus (fractional points; escorts only). */
  readonly speedBonus: number;
}

/**
 * The steering order for one Survival AI pilot this frame.
 *
 * @param input - The pilot's pose, target, speed bounds and run context.
 * @returns Heading error, wanted speed and K-turn permission.
 */
export function survivalSteerOrder(input: SurvivalSteerInput): AiSteerOrder {
  const seek = seekSteerOrder({
    flight: { motion: { ...input.pose, control: input.control } },
    target: input.target,
    cycleCommitted: input.cycleCommitted,
    allowKTurn: input.role === "enemy" && input.wave >= ENEMY_KTURN_UNLOCK_WAVE,
  });
  return { ...seek, desiredSpeed: desiredSpeed(input, seek.headingErrorDeg) };
}

/**
 * Pursuit speed, plus the escort speed bonus while lined up on the target.
 *
 * @param input - The pilot's context.
 * @param headingErrorDeg - Signed heading error to the target (°).
 * @returns The speed to aim for, within the ship's bounds.
 */
function desiredSpeed(
  input: SurvivalSteerInput,
  headingErrorDeg: number,
): number {
  const base = pursuitSpeed(input.control, headingErrorDeg);
  const turning = Math.abs(headingErrorDeg) >= AI_SLOW_TURN_ERROR_DEG;
  if (input.role !== "escort" || turning) return base;
  const bonus = Math.min(MAX_ESCORT_SPEED_BONUS, Math.floor(input.speedBonus));
  return Math.min(input.control.maxSpeed, base + Math.max(0, bonus));
}
