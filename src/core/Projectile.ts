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
}

let projectileIdCounter = 0;

export function createProjectile(
  x: number,
  y: number,
  angle: number,
  ownerId: string,
  ownerFaction: string,
  damage: number = 1
): Projectile {
  return {
    id: `proj_${projectileIdCounter++}`,
    x,
    y,
    angle,
    speed: 600, // Fast!
    damage,
    ownerId,
    ownerFaction,
    lifetime: 2000, // 2 seconds
    maxLifetime: 2000,
  };
}

export function updateProjectile(projectile: Projectile, deltaMs: number): Projectile {
  const rad = (projectile.angle - 90) * (Math.PI / 180);
  const distance = (projectile.speed * deltaMs) / 1000;

  return {
    ...projectile,
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
  targetFaction: string
): boolean {
  // Don't hit own faction
  if (projectile.ownerFaction === targetFaction) return false;

  // Simple circle collision
  const dx = projectile.x - targetX;
  const dy = projectile.y - targetY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  return dist < targetRadius + 5; // 5 = projectile radius
}
