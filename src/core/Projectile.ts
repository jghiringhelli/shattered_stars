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
}

let projectileIdCounter = 0;

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
): Projectile {
  return {
    id: `proj_${projectileIdCounter++}`,
    x,
    y,
    angle,
    speed: isHoming ? 450 : 600, // Missiles slightly slower than lasers
    damage,
    ownerId,
    ownerFaction,
    lifetime: isHoming ? 4000 : 2000, // Missiles travel longer
    maxLifetime: isHoming ? 4000 : 2000,
    isHoming,
    homingTargetId,
    homingTurnRate,
  };
}

export function updateProjectile(
  projectile: Projectile,
  deltaMs: number,
  targetX?: number,
  targetY?: number,
): Projectile {
  let angle = projectile.angle;

  // Homing steering: rotate toward target
  if (projectile.isHoming && targetX !== undefined && targetY !== undefined) {
    const dx = targetX - projectile.x;
    const dy = targetY - projectile.y;
    const desiredAngle =
      (Math.atan2(dy, dx) * (180 / Math.PI) + 90 + 360) % 360;
    const diff = ((desiredAngle - angle + 540) % 360) - 180; // -180..+180
    const maxTurn = projectile.homingTurnRate * (deltaMs / 1000);
    angle =
      (angle + Math.sign(diff) * Math.min(Math.abs(diff), maxTurn) + 360) % 360;
  }

  const rad = (angle - 90) * (Math.PI / 180);
  const distance = (projectile.speed * deltaMs) / 1000;

  return {
    ...projectile,
    angle,
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
): boolean {
  // Don't hit own faction
  if (projectile.ownerFaction === targetFaction) return false;

  // Simple circle collision
  const dx = projectile.x - targetX;
  const dy = projectile.y - targetY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  return dist < targetRadius + 5; // 5 = projectile radius
}
