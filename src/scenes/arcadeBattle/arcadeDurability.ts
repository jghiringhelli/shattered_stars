/**
 * arcadeDurability — real-time hit points for the Skirmish scene.
 *
 * Ship cards, upgrade effects and repair orders are written in miniature
 * points; the X-Wing round tempo (one attack per maneuver cycle) needs
 * DURABILITY_SCALE times as many hit points for a fight to last a comparable
 * number of rounds. Every scene-local HP source goes through here so the
 * scale is applied exactly once. Pure: no Phaser.
 */

import { DURABILITY_SCALE, ORDNANCE_DAMAGE_SCALE } from "../../config";
import {
  EMERGENCY_REPAIR_HULL_AMOUNT,
  EMERGENCY_REPAIR_SHIELD_AMOUNT,
  MAIN_BEAM_DAMAGE,
  POWER_REDIRECT_ENGINE_REPAIR_PER_SEC,
  POWER_REDIRECT_SHIELD_REGEN_PER_SEC,
} from "../../systems/ShipCrew";

/** Card hull assumed for a ship id that has no definition (miniature points). */
const FALLBACK_CARD_HULL = 4;
/** Card shields assumed for a ship id that has no definition (miniature points). */
const FALLBACK_CARD_SHIELDS = 2;

/** Minimum hull of the player's own ship (miniature points 6, scaled). */
export const PLAYER_HULL_FLOOR = 6 * DURABILITY_SCALE;
/** Minimum shields of the player's own ship (miniature points 3, scaled). */
export const PLAYER_SHIELD_FLOOR = 3 * DURABILITY_SCALE;
/** Minimum hull of an AI wingman, so glass-cannon fighters survive a hit. */
export const WINGMAN_HULL_FLOOR = 4 * DURABILITY_SCALE;

/** Durability of the built-in demo squad used when no battleConfig is set. */
export const DEFAULT_SQUAD_DURABILITY = {
  player: { hull: 8 * DURABILITY_SCALE, shields: 4 * DURABILITY_SCALE },
  wingman: { hull: 5 * DURABILITY_SCALE, shields: 3 * DURABILITY_SCALE },
} as const;

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

/** A ship card's durability, as printed. */
export interface CardDurability {
  readonly hull: number;
  readonly shields: number;
}

/**
 * Real-time hit points for a ship card.
 *
 * @param card - The card's printed hull/shields; undefined for an unknown id.
 * @returns Hull and shields at DURABILITY_SCALE.
 */
export function realTimeDurability(
  card: CardDurability | undefined,
): CardDurability {
  return {
    hull: (card?.hull ?? FALLBACK_CARD_HULL) * DURABILITY_SCALE,
    shields: (card?.shields ?? FALLBACK_CARD_SHIELDS) * DURABILITY_SCALE,
  };
}

/**
 * Shields after a frame of regeneration at a rate given in miniature shield
 * points per second (support aura, power redirect), scaled to real-time HP.
 *
 * @param shields - Current shields.
 * @param maxShields - Shield cap.
 * @param miniaturePerSecond - Regeneration rate in miniature points / s.
 * @param deltaMs - Frame length (ms).
 * @returns New shields (fractional), never above the cap and never lowered.
 */
export function regenerateScaledShields(
  shields: number,
  maxShields: number,
  miniaturePerSecond: number,
  deltaMs: number,
): number {
  if (miniaturePerSecond <= 0 || shields >= maxShields) return shields;
  const gain = (miniaturePerSecond * DURABILITY_SCALE * deltaMs) / 1000;
  return Math.min(maxShields, shields + gain);
}

/** Shield regen while the commander's power is on shields (miniature pts / s). */
export const POWER_SHIELD_REGEN_PER_SECOND =
  POWER_REDIRECT_SHIELD_REGEN_PER_SEC;
