/**
 * ArcadeCombatSystem — Pure projectile-vs-ship collision resolution.
 * Extracted from ArcadeBattleScene.checkCollisions() to eliminate
 * per-frame array reallocation and enable unit testing.
 */

import type { Projectile } from "../../core/Projectile";
import { checkProjectileHit } from "../../core/Projectile";
import type { ArcadeShipView } from "./ArcadeFrameCache";

export interface HitResult {
  readonly projectileId: string;
  readonly targetId: string;
  readonly damage: number;
  readonly ownerFaction: string;
}

/**
 * Resolves all projectile-ship collisions for this tick.
 * Returns hit results without mutating any input — caller applies damage.
 *
 * @param projectiles  - Live projectile array (from pool.forEach or similar).
 * @param aliveShips   - Pre-filtered alive ships from frame cache.
 * @param hitRadius    - Collision radius per ship (simplified uniform radius).
 */
export function resolveCollisions(
  projectiles: readonly Projectile[],
  aliveShips: readonly ArcadeShipView[],
  hitRadius: number = 15,
): HitResult[] {
  const hits: HitResult[] = [];

  for (const proj of projectiles) {
    for (const ship of aliveShips) {
      if (ship.id === proj.ownerId) continue;
      if (checkProjectileHit(proj, ship.x, ship.y, hitRadius, ship.faction)) {
        hits.push({
          projectileId: proj.id,
          targetId: ship.id,
          damage: proj.damage,
          ownerFaction: proj.ownerFaction,
        });
        break;
      }
    }
  }

  return hits;
}
