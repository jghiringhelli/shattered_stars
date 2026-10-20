/**
 * arcadeDurability — real-time HP sources local to the Skirmish scene.
 *
 * Ship hull and shields come from getModeCombatStats (the path every mode
 * spawns by). Commander repair orders are written in miniature points; the
 * Tabletop round tempo (one attack per maneuver cycle) needs DURABILITY_SCALE
 * times as many hit points, so every scene-local HP source goes through here
 * and the scale is applied exactly once. Pure: no Phaser.
 */

import { DURABILITY_SCALE, ORDNANCE_DAMAGE_SCALE } from "../../config";
import {
  EMERGENCY_REPAIR_HULL_AMOUNT,
  EMERGENCY_REPAIR_SHIELD_AMOUNT,
  MAIN_BEAM_DAMAGE,
  POWER_REDIRECT_ENGINE_REPAIR_PER_SEC,
  POWER_REDIRECT_SHIELD_REGEN_PER_SEC,
} from "../../systems/ShipCrew";

/** Commander main beam: a charged one-shot hit, scaled like ordnance. */
export const MAIN_BEAM_HIT_DAMAGE = MAIN_BEAM_DAMAGE * ORDNANCE_DAMAGE_SCALE;
/** Shields restored by the commander's emergency repair order. */
export const EMERGENCY_SHIELD_REPAIR =
  EMERGENCY_REPAIR_SHIELD_AMOUNT * DURABILITY_SCALE;
/** Hull restored to the worst capital system by emergency repair. */
export const EMERGENCY_HULL_REPAIR =
  EMERGENCY_REPAIR_HULL_AMOUNT * DURABILITY_SCALE;
/** Engine-system hull repaired per second while power is on engines. */
export const ENGINE_REPAIR_PER_SECOND =
  POWER_REDIRECT_ENGINE_REPAIR_PER_SEC * DURABILITY_SCALE;

/** Milliseconds per second (rate conversion). */
const MS_PER_SECOND = 1000;

/**
 * Shields after a frame of regeneration at a rate given in real-time shield
 * HP per second (power redirect). Every regen rate is HP/s; the scale is
 * applied once, where a miniature constant is converted (below), never here.
 *
 * @param shields - Current shields.
 * @param maxShields - Shield cap.
 * @param hpPerSecond - Regeneration rate in real-time HP / s.
 * @param deltaMs - Frame length (ms).
 * @returns New shields (fractional), never above the cap and never lowered.
 */
export function regenerateScaledShields(
  shields: number,
  maxShields: number,
  hpPerSecond: number,
  deltaMs: number,
): number {
  if (hpPerSecond <= 0 || shields >= maxShields) return shields;
  const gain = (hpPerSecond * deltaMs) / MS_PER_SECOND;
  return Math.min(maxShields, shields + gain);
}

/** Shield regen while the commander's power is on shields (real-time HP / s). */
export const POWER_SHIELD_REGEN_PER_SECOND =
  POWER_REDIRECT_SHIELD_REGEN_PER_SEC * DURABILITY_SCALE;
