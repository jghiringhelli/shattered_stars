/**
 * Object pool for Projectile instances.
 * Avoids per-shot allocation and GC churn during large battles.
 */

import type { Projectile } from "./Projectile";

const DEFAULT_CAPACITY = 256;

export interface ProjectilePool {
  readonly capacity: number;
  readonly activeCount: number;
  acquire(
    x: number,
    y: number,
    angle: number,
    ownerId: string,
    ownerFaction: string,
    damage: number,
    isHoming: boolean,
    homingTargetId: string | null,
    homingTurnRate: number,
    homingTurnBudget: number,
  ): Projectile | null;
  release(projectile: Projectile): void;
  forEach(callback: (p: Projectile) => void): void;
  removeWhere(predicate: (p: Projectile) => boolean): void;
  clear(): void;
}

let poolIdCounter = 0;

/**
 * Creates a fixed-capacity projectile pool.
 *
 * @param capacity - Maximum concurrent projectiles (default 256).
 */
export function createProjectilePool(
  capacity: number = DEFAULT_CAPACITY,
): ProjectilePool {
  const live: Projectile[] = [];

  return {
    get capacity() {
      return capacity;
    },
    get activeCount() {
      return live.length;
    },

    acquire(
      x,
      y,
      angle,
      ownerId,
      ownerFaction,
      damage,
      isHoming,
      homingTargetId,
      homingTurnRate,
      homingTurnBudget,
    ): Projectile | null {
      if (live.length >= capacity) return null;

      const projectile: Projectile = {
        id: `pool_${poolIdCounter++}`,
        x,
        y,
        angle,
        speed: isHoming ? 700 : 2500,
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
      live.push(projectile);
      return projectile;
    },

    release(projectile: Projectile): void {
      const idx = live.indexOf(projectile);
      if (idx >= 0) {
        live[idx] = live[live.length - 1]!;
        live.pop();
      }
    },

    forEach(callback: (p: Projectile) => void): void {
      for (let i = 0; i < live.length; i++) {
        callback(live[i]!);
      }
    },

    removeWhere(predicate: (p: Projectile) => boolean): void {
      let i = 0;
      while (i < live.length) {
        if (predicate(live[i]!)) {
          live[i] = live[live.length - 1]!;
          live.pop();
        } else {
          i++;
        }
      }
    },

    clear(): void {
      live.length = 0;
    },
  };
}
