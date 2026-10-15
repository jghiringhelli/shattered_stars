/**
 * Projectile System
 * Handles laser bolts and other projectiles
 */

export interface Projectile {
  id: string;
  x: number;
  y: number;
  angle: number; // Direction of travel
  speed: number; // Pixels per second
  damage: number;
  ownerId: string; // Ship that fired it
  ownerFaction: string;
  lifetime: number; // ms remaining
  maxLifetime: number;
  /** If true, steers toward homingTargetId each frame */
  isHoming: boolean;
  /** ID of the ship this projectile is tracking (null = fly straight) */
  homingTargetId: string | null;
  /** Degrees per second the projectile can turn toward its target */
  homingTurnRate: number;
  /**
   * Total degrees of steering remaining. Decremented each frame by the
   * actual turn applied. When it reaches 0 the missile stops homing and
   * flies straight — it has "run out of maneuvering fuel".
   * Non-homing projectiles set this to 0.
   */
  homingTurnBudget: number;
  /** Stress (0–1 scale) added to the pilot this projectile hits. */
  stressOnHit?: number;
  /** Extra damage dealt when the target's shields are already down. */
  bonusDamageVsUnshielded?: number;
  /** A primary-laser bolt: pilot-ability hit bonuses apply to it. */
  isLaser?: boolean;
}

/** Secondary on-hit riders a weapon can attach to its projectiles. */
export interface ProjectileOnHit {
  readonly stressOnHit: number;
  readonly bonusDamageVsUnshielded: number;
}

/**
 * Attach on-hit riders to a freshly created projectile.
 *
 * @param projectile - The projectile to arm.
 * @param onHit - Riders from the firing weapon and ship upgrades.
 * @returns A copy of the projectile carrying the riders.
 */
export function withOnHit(
  projectile: Projectile,
  onHit: ProjectileOnHit,
): Projectile {
  return {
    ...projectile,
    stressOnHit: onHit.stressOnHit,
    bonusDamageVsUnshielded: onHit.bonusDamageVsUnshielded,
  };
}

/**
 * Damage a projectile deals to a target, before armour and mitigation.
 *
 * @param projectile - The hitting projectile.
 * @param targetShields - The target's current shields.
 * @returns Raw damage including the unshielded-target bonus.
 */
export function projectileRawDamage(
  projectile: Projectile,
  targetShields: number,
): number {
  const exposedBonus =
    targetShields <= 0 ? (projectile.bonusDamageVsUnshielded ?? 0) : 0;
  return projectile.damage + exposedBonus;
}

/** Hands out projectile ids for one battle (owned by whoever fires). */
export class ProjectileIdSequence {
  private issued = 0;

  /** @returns The next id of this battle. */
  next(): string {
    this.issued += 1;
    return `proj_${this.issued}`;
  }
}

/**
 * @param ids - The battle's id sequence; without one the id is derived from
 *   the shot itself (owner, origin, heading), never from global state.
 */
export function createProjectile(
  x: number,
  y: number,
  angle: number,
  ownerId: string,
  ownerFaction: string,
  damage: number = 1,
  isHoming: boolean = false,
  homingTargetId: string | null = null,
  homingTurnRate: number = 0,
  homingTurnBudget: number = 0,
  ids?: ProjectileIdSequence,
): Projectile {
  return {
    id: ids?.next() ?? `proj_${ownerId}_${x}_${y}_${angle}`,
    x,
    y,
    angle,
    speed: isHoming ? 700 : 2500, // Laser bolts are very fast; missiles track
    damage,
    ownerId,
    ownerFaction,
    lifetime: isHoming ? 4000 : 2000,
    maxLifetime: isHoming ? 4000 : 2000,
    isHoming,
    homingTargetId,
    homingTurnRate,
    homingTurnBudget,
  };
}

export function updateProjectile(
  projectile: Projectile,
  deltaMs: number,
  targetX?: number,
  targetY?: number,
): Projectile {
  let angle = projectile.angle;
  let homingTurnBudget = projectile.homingTurnBudget;

  // Homing steering: rotate toward target while turn budget remains
  if (
    projectile.isHoming &&
    homingTurnBudget > 0 &&
    targetX !== undefined &&
    targetY !== undefined
  ) {
    const dx = targetX - projectile.x;
    const dy = targetY - projectile.y;
    const desiredAngle =
      (Math.atan2(dy, dx) * (180 / Math.PI) + 90 + 360) % 360;
    const diff = ((desiredAngle - angle + 540) % 360) - 180; // -180..+180
    const maxTurn = projectile.homingTurnRate * (deltaMs / 1000);
    const actualTurn = Math.min(Math.abs(diff), maxTurn);
    angle = (angle + Math.sign(diff) * actualTurn + 360) % 360;
    homingTurnBudget = Math.max(0, homingTurnBudget - actualTurn);
  }

  const rad = (angle - 90) * (Math.PI / 180);
  const distance = (projectile.speed * deltaMs) / 1000;

  return {
    ...projectile,
    angle,
    homingTurnBudget,
    x: projectile.x + Math.cos(rad) * distance,
    y: projectile.y + Math.sin(rad) * distance,
    lifetime: projectile.lifetime - deltaMs,
  };
}

export function isProjectileAlive(projectile: Projectile): boolean {
  return projectile.lifetime > 0;
}

export function checkProjectileHit(
  projectile: Projectile,
  targetX: number,
  targetY: number,
  targetRadius: number,
  targetFaction: string,
  worldSize?: number,
): boolean {
  // Don't hit own faction
  if (projectile.ownerFaction === targetFaction) return false;

  let dx = projectile.x - targetX;
  let dy = projectile.y - targetY;

  // Torus wrap for hit-testing across the map seam
  if (worldSize !== undefined) {
    const half = worldSize / 2;
    if (dx > half) dx -= worldSize;
    else if (dx < -half) dx += worldSize;
    if (dy > half) dy -= worldSize;
    else if (dy < -half) dy += worldSize;
  }

  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < targetRadius + 5; // 5 = projectile radius
}
