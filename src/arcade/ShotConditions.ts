/**
 * ShotConditions — when a pilot ability's conditional knobs apply.
 *
 * Pilot abilities in tabletop are conditional ("at range 1", "while behind
 * the target", "while stressed"...). In real time those conditions are read
 * at the moment a laser bolt hits: the attacker's pose against the target's,
 * whether a wingman flies close, and the attacker's own state.
 *
 * Pure: no Phaser.
 */

import { RANGE_1, RANGE_2 } from "../config";
import {
  MIN_DAMAGE_TAKEN_MULTIPLIER,
  type CombatModifiers,
} from "../core/CombatModifiers";
import type { ShipPose } from "../core/ArcadeControls";
import { headingDiffToTarget } from "../systems/MovementSystem";

/** Range 1 (px, centre to centre). */
export const CLOSE_RANGE_PX = RANGE_1;

/** Half-width of the bullseye arc (tabletop bullseye: a narrow 20° strip). */
export const BULLSEYE_HALF_ARC_DEG = 10;

/** Half-width of a ship's rear arc. */
export const REAR_ARC_HALF_DEG = 45;

/** A friendly within this distance (range 2) counts as a wingman. */
export const WINGMAN_RADIUS_PX = RANGE_2;

/** How long the kill frenzy lasts after a kill (ms). */
export const KILL_FRENZY_MS = 4000;

/** Radius of the blast when a ship with a death blast is destroyed (px). */
export const DEATH_BLAST_RADIUS_PX = RANGE_1;

/** Every condition a pilot-ability knob can depend on. */
export interface ShotConditions {
  readonly closeRange: boolean;
  readonly behindTarget: boolean;
  readonly inBullseye: boolean;
  readonly allyNear: boolean;
  readonly isStressed: boolean;
  readonly isDamaged: boolean;
  readonly frenzyActive: boolean;
}

/** No condition holds. */
export const NO_SHOT_CONDITIONS: ShotConditions = {
  closeRange: false,
  behindTarget: false,
  inBullseye: false,
  allyNear: false,
  isStressed: false,
  isDamaged: false,
  frenzyActive: false,
};

/** Geometric conditions of a shot (the attacker's own state is added by the caller). */
export type ShotGeometry = Pick<
  ShotConditions,
  "closeRange" | "behindTarget" | "inBullseye"
>;

/**
 * Where the attacker stands relative to the target.
 *
 * @param attacker - The firing ship's pose.
 * @param target - The target's pose.
 * @returns Range 1, inside the target's rear arc, and target in bullseye.
 */
export function describeShot(
  attacker: ShipPose,
  target: ShipPose,
): ShotGeometry {
  const range = Math.hypot(target.x - attacker.x, target.y - attacker.y);
  const offNose = headingDiffToTarget(
    attacker.x,
    attacker.y,
    attacker.angle,
    target.x,
    target.y,
  );
  const fromTargetNose = headingDiffToTarget(
    target.x,
    target.y,
    target.angle,
    attacker.x,
    attacker.y,
  );
  return {
    closeRange: range <= CLOSE_RANGE_PX,
    behindTarget: Math.abs(fromTargetNose) >= 180 - REAR_ARC_HALF_DEG,
    inBullseye: Math.abs(offNose) <= BULLSEYE_HALF_ARC_DEG,
  };
}

/**
 * Laser damage the attacker's conditional knobs add for this hit.
 *
 * @param modifiers - The attacker's modifier sheet.
 * @param shot - Which conditions hold at the moment of the hit.
 * @returns Extra damage (0 when no knob's condition holds).
 */
export function conditionalLaserBonus(
  modifiers: CombatModifiers,
  shot: ShotConditions,
): number {
  const knobs: ReadonlyArray<[boolean, number]> = [
    [shot.closeRange, modifiers.closeRangeLaserBonus],
    [shot.behindTarget, modifiers.rearArcLaserBonus],
    [shot.inBullseye, modifiers.bullseyeLaserBonus],
    [shot.allyNear, modifiers.wingmanLaserBonus],
    [shot.isStressed, modifiers.stressedLaserBonus],
    [shot.isDamaged, modifiers.damagedLaserBonus],
    [shot.frenzyActive, modifiers.killFrenzyLaserBonus],
  ];
  return knobs.reduce((sum, [holds, bonus]) => (holds ? sum + bonus : sum), 0);
}

/**
 * Multiplier on damage the defender takes from a hit.
 *
 * @param modifiers - The defender's modifier sheet.
 * @param allyNear - Whether a friendly ship flies near the defender.
 * @returns The multiplier, never below the damage floor.
 */
export function incomingDamageMultiplier(
  modifiers: CombatModifiers,
  allyNear: boolean,
): number {
  const wingman = allyNear ? modifiers.wingmanDamageTakenMultiplier : 1;
  return Math.max(
    MIN_DAMAGE_TAKEN_MULTIPLIER,
    modifiers.damageTakenMultiplier * wingman,
  );
}
