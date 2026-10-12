/**
 * FireControl — the rules the secondary-weapons runtime applies:
 *
 * - FIRE_SECONDARY on a launcher (missile, torpedo): the rack must be
 *   loaded and reloaded, the pilot's target locked (TargetLock), and the
 *   target inside the launcher's range band and front arc — otherwise it
 *   holds fire and reports why (HUD feedback). A device (bomb, mine) only
 *   needs a loaded, reloaded bay: it drops astern.
 * - Turrets track all round (360°) within their band, the pilot's target
 *   first, and swing at a finite traverse rate.
 * - A secondary hit: armour first, then the defender's mitigation (cards,
 *   wingman, aura — DamageRules), halved while the defender is cloaked;
 *   a landed hit always deals at least 1.
 *
 * Pure: no Phaser.
 */

import { applyArmor } from "../systems/DamageRules";
import type { SlotState, TurretState } from "./Arsenal";
import {
  headingTowardDeg,
  inArcEnvelope,
  torusRangePx,
  wrapDegrees,
  type FiringPose,
} from "./FiringGeometry";
import { isLockedOn, type LockState } from "./TargetLock";
import type { FireOutcome, OrdnanceView, WeaponBody } from "./weaponTypes";
import type { Arsenal } from "./Arsenal";
import { isLauncher } from "./weaponSpecs";

/** A cloaked ship takes half damage from every hit. */
export const CLOAKED_DAMAGE_FACTOR = 0.5;
/** Turret traverse speed (degrees per second). */
export const TURRET_TRAVERSE_DEG_PER_S = 240;
/** A turret fires once its aim is within this many degrees of the bearing. */
export const TURRET_ON_TARGET_DEG = 12;
const MS_PER_S = 1000;

/** The firing ship with its side. */
export interface FiringShip extends FiringPose {
  readonly id: string;
  readonly side: string;
}

/**
 * Whether the selected slot may fire now, and if not, why.
 *
 * @param slot - The selected slot.
 * @param lock - The ship's lock.
 * @param self - The firing ship.
 * @param target - The pilot's target (living), or null.
 * @param worldSize - Map edge length (px).
 * @returns "launched"/"dropped" when it may fire, else the refusal.
 */
export function checkSecondaryFire(
  slot: SlotState,
  lock: LockState,
  self: FiringPose,
  target: WeaponBody | null,
  worldSize: number,
): FireOutcome {
  if (slot.charges <= 0) return "empty";
  if (slot.cooldownMs > 0) return "reloading";
  const { spec } = slot;
  if (!isLauncher(spec)) return "dropped";
  if (!target) return "no_target";
  if (!isLockedOn(lock, target.id)) return "locking";
  const range = torusRangePx(self, target, worldSize);
  const { minRangePx, maxRangePx } = spec.envelope;
  if (range < minRangePx || range >= maxRangePx) return "out_of_range";
  if (!inArcEnvelope(self, target, spec.envelope, worldSize)) {
    return "out_of_arc";
  }
  return "launched";
}

/**
 * The ship a turret engages: the pilot's target when it is in the turret's
 * band, else the nearest hostile that is.
 *
 * @param self - The ship carrying the turret.
 * @param turret - The turret.
 * @param candidates - Eligible ships (living, not immune, not cloaked).
 * @param preferredId - The pilot's target, or null.
 * @param worldSize - Map edge length (px).
 * @returns The target, or null to hold fire.
 */
export function pickTurretTarget(
  self: FiringShip,
  turret: TurretState,
  candidates: Iterable<WeaponBody>,
  preferredId: string | null,
  worldSize: number,
): WeaponBody | null {
  let best: WeaponBody | null = null;
  let bestRange = Infinity;
  for (const body of candidates) {
    if (body.hull <= 0 || body.side === self.side || body.id === self.id) {
      continue;
    }
    if (!inArcEnvelope(self, body, turret.spec.envelope, worldSize)) continue;
    if (body.id === preferredId) return body;
    const range = torusRangePx(self, body, worldSize);
    if (range < bestRange) {
      best = body;
      bestRange = range;
    }
  }
  return best;
}

/**
 * @param facingDeg - Current aim (ship-angle convention).
 * @param bearingDeg - Wanted aim.
 * @param deltaMs - Frame length (ms).
 * @returns The new aim, swung the short way at the traverse rate.
 */
export function traverseTurret(
  facingDeg: number,
  bearingDeg: number,
  deltaMs: number,
): number {
  const error = wrapDegrees(bearingDeg - facingDeg);
  const step = Math.min(
    Math.abs(error),
    (TURRET_TRAVERSE_DEG_PER_S * deltaMs) / MS_PER_S,
  );
  return (((facingDeg + Math.sign(error) * step) % 360) + 360) % 360;
}

/**
 * @param self - The ship carrying the turret.
 * @param turret - The turret.
 * @param target - Its target.
 * @param worldSize - Map edge length (px).
 * @returns True when the aim is on the target's bearing.
 */
export function turretOnTarget(
  self: FiringPose,
  turret: TurretState,
  target: WeaponBody,
  worldSize: number,
): boolean {
  const bearing = headingTowardDeg(self, target, worldSize);
  return (
    Math.abs(wrapDegrees(bearing - turret.facingDeg)) <= TURRET_ON_TARGET_DEG
  );
}

/**
 * What a bot sees when it decides on ordnance: its target, the living
 * hostiles it can see (not cloaked) and its living friends.
 *
 * @param input - The bot's ship, arsenal, target, every ship, cloak test.
 * @returns The bot's view.
 */
export function ordnanceViewOf(input: {
  readonly self: WeaponBody;
  readonly arsenal: Arsenal;
  readonly target: WeaponBody | null;
  readonly bodies: Iterable<WeaponBody>;
  readonly isCloaked: (shipId: string) => boolean;
  readonly worldSize: number;
}): OrdnanceView {
  const { self } = input;
  const enemies: WeaponBody[] = [];
  const allies: WeaponBody[] = [];
  for (const body of input.bodies) {
    if (body.hull <= 0 || body.id === self.id) continue;
    if (body.side === self.side) allies.push(body);
    else if (!input.isCloaked(body.id)) enemies.push(body);
  }
  return {
    self,
    arsenal: input.arsenal,
    target: input.target,
    enemies,
    allies,
    worldSize: input.worldSize,
  };
}

/**
 * Damage a secondary hit deals.
 *
 * @param baseDamage - The weapon's damage (ordnance already ×10).
 * @param target - The ship hit (armour, mitigation).
 * @param cloaked - Whether the target is cloaked.
 * @returns Final damage, at least 1.
 */
export function weaponHitDamage(
  baseDamage: number,
  target: WeaponBody,
  cloaked: boolean,
): number {
  const armored = applyArmor(baseDamage, target.armor ?? 0);
  const factor =
    (target.damageTaken ?? 1) * (cloaked ? CLOAKED_DAMAGE_FACTOR : 1);
  return Math.max(1, Math.round(armored * factor));
}
