/**
 * SurvivalBelt — Survival's asteroid belt at a given squeeze (pure). The
 * belt still gets denser every wave (smaller safe zone, closer wall, more
 * damage per squeeze) but its damage is capped: the old belt dealt up to
 * 36 HP/s unsqueezed (more when tight) and caused every lost regular
 * combat node in the ADR-0004 sweep. A ship at the wall now takes at most
 * a third of that, so straying is punished without being a death sentence.
 */

import { DURABILITY_SCALE } from "../../config";
import {
  tightenBelt,
  type BeltConfig,
  type BeltDamageRamp,
} from "../arena/ArenaBoundary";
import { SURVIVAL_BASE_BELT } from "./SurvivalSpawnArc";

/**
 * Survival's damage ramp, in miniature points per second (scaled by
 * DURABILITY_SCALE in real time): +0.05/s per squeeze, never above 1/s
 * (12 HP/s, reached at the 10th squeeze).
 */
export const SURVIVAL_BELT_DAMAGE_RAMP: BeltDamageRamp = {
  perStep: 0.05,
  maxPerSecond: 1,
};

/** Most real-time damage the belt deals per second, at its wall (HP/s). */
export const SURVIVAL_BELT_MAX_REAL_DPS =
  SURVIVAL_BELT_DAMAGE_RAMP.maxPerSecond * DURABILITY_SCALE;

/**
 * @param steps - Squeezes so far (node plan + waves).
 * @returns The Survival belt after that many squeezes.
 */
export function survivalBelt(steps: number): BeltConfig {
  return tightenBelt(SURVIVAL_BASE_BELT, steps, SURVIVAL_BELT_DAMAGE_RAMP);
}
