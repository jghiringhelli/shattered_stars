/**
 * ShotLevers — what the attacker's position and its squad's mark do to a
 * dice shot, on top of the mode's hit chance and dice damage:
 * - from the target's rear arc (sitting on its tail): easier to hit and the
 *   hit does more damage;
 * - from inside the target's front cone (a head-on joust, where the target
 *   fires back): harder to hit — trading shots nose to nose is a poor bet;
 * - at the target your squad marked (SquadMark): easier to hit, more damage.
 *
 * The values are a struct so simulations can sweep them; the dice modes use
 * {@link DEFAULT_SHOT_LEVERS}. Pure: no Phaser.
 */

import type { ShipPose } from "../core/ArcadeControls";
import { headingDiffToTarget } from "../systems/MovementSystem";
import { describeShot } from "./ShotConditions";
import {
  SQUAD_MARK_DAMAGE_BONUS,
  SQUAD_MARK_HIT_BONUS,
} from "./systems/SquadMark";

/** Hit-chance bonus from the target's rear arc (sitting on its tail). */
export const REAR_ARC_HIT_BONUS = 0.15;

/** Extra damage per hit from the target's rear arc. */
export const REAR_ARC_DAMAGE_BONUS = 1;

/** Half-width of the target's front cone that makes a shot head-on (°). */
export const HEAD_ON_HALF_ARC_DEG = 40;

/**
 * Hit-chance penalty for a shot fired from inside the target's front cone:
 * trading fire nose to nose is a poor bet, so position beats a joust. 0.2
 * keeps normal-AI duels (which joust) near 40–110 s; 0.3 pushed them past 2 min.
 */
export const HEAD_ON_HIT_PENALTY = 0.2;

/** A lever never pushes the hit chance below this... */
export const LEVER_HIT_CHANCE_FLOOR = 0.05;

/** ...or above this. */
export const LEVER_HIT_CHANCE_CEILING = 0.95;

/** Lever values (sweepable). */
export interface ShotLevers {
  readonly rearArcHitBonus: number;
  readonly rearArcDamageBonus: number;
  readonly headOnHitPenalty: number;
  readonly markHitBonus: number;
  readonly markDamageBonus: number;
}

/** The values the dice modes fight with. */
export const DEFAULT_SHOT_LEVERS: ShotLevers = {
  rearArcHitBonus: REAR_ARC_HIT_BONUS,
  rearArcDamageBonus: REAR_ARC_DAMAGE_BONUS,
  headOnHitPenalty: HEAD_ON_HIT_PENALTY,
  markHitBonus: SQUAD_MARK_HIT_BONUS,
  markDamageBonus: SQUAD_MARK_DAMAGE_BONUS,
};

/** Every lever off: the bare dice model. */
export const NO_SHOT_LEVERS: ShotLevers = {
  rearArcHitBonus: 0,
  rearArcDamageBonus: 0,
  headOnHitPenalty: 0,
  markHitBonus: 0,
  markDamageBonus: 0,
};

/** Where the attacker fires from, as far as the levers care. */
export type ShotPosition = "rear" | "head_on" | "neutral";

/**
 * @param attacker - The firing ship's pose.
 * @param target - The target's pose.
 * @returns rear (in its rear arc), head_on (inside its front cone) or neutral.
 */
export function shotPosition(
  attacker: ShipPose,
  target: ShipPose,
): ShotPosition {
  if (describeShot(attacker, target).behindTarget) return "rear";
  const offTargetNose = headingDiffToTarget(
    target.x,
    target.y,
    target.angle,
    attacker.x,
    attacker.y,
  );
  return Math.abs(offTargetNose) <= HEAD_ON_HALF_ARC_DEG
    ? "head_on"
    : "neutral";
}

/** A shot after the levers. */
export interface LeveredShot {
  readonly hitChance: number;
  /** Damage to add to a hit (before the defender's mitigation). */
  readonly damageBonus: number;
}

/** Inputs for {@link leverShot}. */
export interface LeverShotInput {
  readonly hitChance: number;
  readonly position: ShotPosition;
  /** The target is the one the attacker's side marked. */
  readonly marked: boolean;
}

/**
 * Apply position and mark to a shot's odds and damage.
 *
 * @param shot - Mode hit chance, position and mark.
 * @param levers - Lever values.
 * @returns Hit chance (clamped only when a lever moved it) and damage bonus.
 */
export function leverShot(
  shot: LeverShotInput,
  levers: ShotLevers = DEFAULT_SHOT_LEVERS,
): LeveredShot {
  const hitDelta =
    (shot.position === "rear" ? levers.rearArcHitBonus : 0) -
    (shot.position === "head_on" ? levers.headOnHitPenalty : 0) +
    (shot.marked ? levers.markHitBonus : 0);
  const damageBonus =
    (shot.position === "rear" ? levers.rearArcDamageBonus : 0) +
    (shot.marked ? levers.markDamageBonus : 0);
  if (hitDelta === 0) return { hitChance: shot.hitChance, damageBonus };
  return {
    hitChance: Math.max(
      LEVER_HIT_CHANCE_FLOOR,
      Math.min(LEVER_HIT_CHANCE_CEILING, shot.hitChance + hitDelta),
    ),
    damageBonus,
  };
}
