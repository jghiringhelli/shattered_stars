/**
 * dialMarkers — pure layout of Continuous Tactical's maneuver dial: one
 * marker per maneuver offered at the ordered speed, placed around a circle
 * by direction and coloured by difficulty. No Phaser.
 */

import type {
  ManeuverDefinition,
  ManeuverDifficulty,
  ManeuverDirection,
} from "../../core/types";

/** Dial colour per maneuver difficulty. */
const DIFFICULTY_COLORS: Readonly<Record<ManeuverDifficulty, number>> = {
  green: 0x44ff44,
  white: 0xffffff,
  red: 0xff4444,
};

/** Where each direction sits on the dial (degrees, 0 = up, clockwise). */
const DIAL_ANGLES_DEG: Partial<Record<ManeuverDirection, number>> = {
  turn_left: -90,
  bank_left: -45,
  straight: 0,
  bank_right: 45,
  turn_right: 90,
  kturn: 180,
  segnor_left: 135,
  segnor_right: -135,
  tallon_left: -135,
  tallon_right: 135,
};

const DEG_TO_RAD = Math.PI / 180;
/** Screen angle of "up" (dial angles are measured from it). */
const UP_DEG = -90;

/** One dial marker, relative to the dial centre. */
export interface DialMarker {
  readonly direction: ManeuverDirection;
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly selected: boolean;
}

/**
 * @param difficulty - Maneuver difficulty.
 * @returns Its dial / preview colour.
 */
export function difficultyColor(difficulty: ManeuverDifficulty): number {
  return DIFFICULTY_COLORS[difficulty];
}

/**
 * Markers for the maneuvers a ship's dial offers at the ordered speed.
 *
 * @param dial - The ship's dial.
 * @param order - The standing order (its speed picks the ring shown).
 * @param radius - Dial radius in px.
 * @returns One marker per placeable maneuver at that speed.
 */
export function dialMarkers(
  dial: readonly ManeuverDefinition[],
  order: Pick<ManeuverDefinition, "direction" | "speed">,
  radius: number,
): DialMarker[] {
  return dial.flatMap((maneuver) => {
    if (maneuver.speed !== order.speed) return [];
    const angleDeg = DIAL_ANGLES_DEG[maneuver.direction];
    if (angleDeg === undefined) return [];
    const angle = (angleDeg + UP_DEG) * DEG_TO_RAD;
    return [
      {
        direction: maneuver.direction,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        color: difficultyColor(maneuver.difficulty),
        selected: maneuver.direction === order.direction,
      },
    ];
  });
}
