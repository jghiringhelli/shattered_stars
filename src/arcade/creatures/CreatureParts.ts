/**
 * CreatureParts — a creature's body parts as hit pools. A hit lands on the
 * part whose bearing arc (off the creature's nose, orbiting pods drift with
 * time) holds the attacker; while shields are up nothing is exposed. A
 * part's multiplier scales the hull damage of hits that land on it (weak
 * point > 1, armoured plate < 1); a destroyed part stops exposing anything
 * and disables the powers that need it. Pure.
 */

import { DURABILITY_SCALE } from "../../config";
import type { CreaturePartSpec } from "../../data/creatures/creatureTypes";
import { wrapDegrees } from "../weapons/FiringGeometry";

const MS_PER_S = 1000;

/** A part's runtime state. */
export interface PartState {
  readonly spec: CreaturePartSpec;
  hp: number;
  readonly maxHp: number;
  alive: boolean;
}

/**
 * @param specs - The creature's parts.
 * @returns Fresh part states at full hit points (× DURABILITY_SCALE).
 */
export function createParts(specs: readonly CreaturePartSpec[]): PartState[] {
  return specs.map((spec) => {
    const maxHp = spec.hpPoints * DURABILITY_SCALE;
    return { spec, hp: maxHp, maxHp, alive: true };
  });
}

/**
 * @param part - A part.
 * @param nowMs - Sim time (ms).
 * @returns The part's bearing off the nose now (deg).
 */
export function partBearingDeg(part: PartState, nowMs: number): number {
  const drift = (part.spec.orbitDegPerS ?? 0) * (nowMs / MS_PER_S);
  return wrapDegrees(part.spec.bearingDeg + drift);
}

/**
 * @param parts - The creature's parts.
 * @param attackerBearingDeg - Bearing of the attacker off the nose.
 * @param nowMs - Sim time (ms).
 * @returns The living part the attacker is aligned with (the closest one when
 *   arcs overlap), or null when the hit lands on bare body.
 */
export function findHitPart(
  parts: readonly PartState[],
  attackerBearingDeg: number,
  nowMs: number,
): PartState | null {
  let best: PartState | null = null;
  let bestOffset = Infinity;
  for (const part of parts) {
    if (!part.alive) continue;
    const offset = Math.abs(
      wrapDegrees(attackerBearingDeg - partBearingDeg(part, nowMs)),
    );
    if (offset > part.spec.arcDeg / 2 || offset >= bestOffset) continue;
    best = part;
    bestOffset = offset;
  }
  return best;
}

/**
 * Damages a part.
 *
 * @param part - The part hit (mutated).
 * @param damage - Raw damage taken.
 * @returns True when this hit destroyed it.
 */
export function damagePart(part: PartState, damage: number): boolean {
  part.hp = Math.max(0, part.hp - damage);
  if (part.hp > 0) return false;
  part.alive = false;
  return true;
}

/**
 * @param parts - The creature's parts.
 * @param partId - A part id.
 * @returns False once that part is destroyed (true for unknown ids).
 */
export function isPartAlive(
  parts: readonly PartState[],
  partId: string,
): boolean {
  for (const part of parts) if (part.spec.id === partId) return part.alive;
  return true;
}
