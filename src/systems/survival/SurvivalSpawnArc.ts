/**
 * Survival — where wave ships enter (pure). Waves arrive on an arc around
 * the arena centre just inside the asteroid belt's current safe radius,
 * every ship facing inward. They used to spawn in a row 100–200 px below
 * the top edge (2 800–2 950 px from the centre), i.e. inside the belt and,
 * once it had squeezed a few times, beyond its wall — where they died
 * within a second.
 *
 * Headings follow the cycle engine: 0° faces up (−y), 90° faces right.
 */

import type { BeltConfig } from "../arena/ArenaBoundary";

/**
 * Survival's asteroid belt before any squeeze (survivalBelt shrinks it and
 * ramps its damage, capped — see SurvivalBelt). 0.5 miniature points/s at
 * the wall = 6 HP/s in real time.
 */
export const SURVIVAL_BASE_BELT: BeltConfig = {
  safeRadius: 2600,
  wallRadius: 3000,
  maxDamagePerSecond: 0.5,
};

/** Wave ships enter this far inside the safe radius (px). */
export const SPAWN_MARGIN_PX = 400;
/** Preferred minimum entry radius (px), never more than half the safe radius. */
export const MIN_SPAWN_RADIUS = 600;
/** Angular span of the entry arc, centred on the top of the arena (deg). */
export const SPAWN_ARC_DEG = 120;
/** Minimum chord between neighbours on one arc row (px). */
export const SPAWN_SPACING_PX = 90;
/** Extra rows of a crowded wave sit this much further in (px). */
export const SPAWN_ROW_STEP_PX = 90;
/** Elites enter this far inside the regulars' arc (px). */
export const ELITE_INSET_PX = 120;
/** The boss enters this far inside the regulars' arc (px). */
export const BOSS_INSET_PX = 200;
/** Angular gap between neighbouring elites (deg). */
export const ELITE_SPREAD_DEG = 10;
/** Innermost row radius, as a fraction of the entry radius. */
const MIN_ROW_FRACTION = 0.3;

/** A spawn position and inward heading. */
export interface SpawnPoint {
  readonly x: number;
  readonly y: number;
  /** Heading (deg) pointing at the arena centre. */
  readonly angle: number;
}

/** A wave to place. */
export interface WaveSpawnRequest {
  readonly center: { readonly x: number; readonly y: number };
  readonly safeRadius: number;
  readonly regulars: number;
  readonly elites: number;
  readonly boss: boolean;
}

/** The placed wave. */
export interface WaveSpawnLayout {
  readonly regulars: readonly SpawnPoint[];
  readonly elites: readonly SpawnPoint[];
  readonly boss: SpawnPoint | null;
}

/**
 * @param safeRadius - The belt's current safe radius (px).
 * @returns Radius of the regulars' entry arc — always inside the safe zone.
 */
export function spawnRadius(safeRadius: number): number {
  const preferredMin = Math.min(MIN_SPAWN_RADIUS, safeRadius * 0.5);
  return Math.max(preferredMin, safeRadius - SPAWN_MARGIN_PX);
}

/**
 * @param center - Arena centre.
 * @param radius - Distance from the centre (px).
 * @param bearing - Bearing from the centre (deg, 0 = up, clockwise).
 * @returns The point, facing the centre.
 */
export function pointOnArc(
  center: { readonly x: number; readonly y: number },
  radius: number,
  bearing: number,
): SpawnPoint {
  const rad = (bearing * Math.PI) / 180;
  return {
    x: center.x + Math.sin(rad) * radius,
    y: center.y - Math.cos(rad) * radius,
    angle: (((bearing + 180) % 360) + 360) % 360,
  };
}

/**
 * Lays out a wave: regulars spread evenly over the entry arc (crowded waves
 * wrap onto rows further in), elites a little inside it, the boss at its
 * middle further in.
 *
 * @param request - Centre, safe radius and ship counts.
 * @returns Every ship's spawn point and heading.
 */
export function layoutWave(request: WaveSpawnRequest): WaveSpawnLayout {
  const radius = spawnRadius(request.safeRadius);
  const elites = Array.from({ length: request.elites }, (_, i) =>
    pointOnArc(
      request.center,
      Math.max(radius * MIN_ROW_FRACTION, radius - ELITE_INSET_PX),
      (i - (request.elites - 1) / 2) * ELITE_SPREAD_DEG,
    ),
  );
  const boss = request.boss
    ? pointOnArc(
        request.center,
        Math.max(radius * MIN_ROW_FRACTION, radius - BOSS_INSET_PX),
        0,
      )
    : null;
  return {
    regulars: arcRows(request.center, radius, request.regulars),
    elites,
    boss,
  };
}

function arcRows(
  center: { readonly x: number; readonly y: number },
  radius: number,
  count: number,
): SpawnPoint[] {
  const points: SpawnPoint[] = [];
  let rowRadius = radius;
  while (points.length < count) {
    const arcLength = (SPAWN_ARC_DEG / 360) * 2 * Math.PI * rowRadius;
    const capacity = Math.max(1, Math.floor(arcLength / SPAWN_SPACING_PX) + 1);
    const inRow = Math.min(capacity, count - points.length);
    for (let i = 0; i < inRow; i++) {
      const bearing =
        inRow === 1
          ? 0
          : -SPAWN_ARC_DEG / 2 + (i * SPAWN_ARC_DEG) / (inRow - 1);
      points.push(pointOnArc(center, rowRadius, bearing));
    }
    rowRadius = Math.max(
      radius * MIN_ROW_FRACTION,
      rowRadius - SPAWN_ROW_STEP_PX,
    );
  }
  return points;
}

/**
 * Reinforcements a boss calls in: on its sides, pulled inside the entry arc.
 *
 * @param boss - The boss's position.
 * @param count - Ships to place.
 * @param center - Arena centre.
 * @param safeRadius - The belt's current safe radius.
 * @param offsetPx - Sideways distance from the boss.
 * @returns Their spawn points, facing the centre.
 */
export function reinforcementPoints(
  boss: { readonly x: number; readonly y: number },
  count: number,
  center: { readonly x: number; readonly y: number },
  safeRadius: number,
  offsetPx: number,
): SpawnPoint[] {
  const limit = spawnRadius(safeRadius);
  return Array.from({ length: count }, (_, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const x = boss.x + side * offsetPx * (1 + Math.floor(i / 2));
    const dx = x - center.x;
    const dy = boss.y - center.y;
    const dist = Math.hypot(dx, dy);
    const scale = dist > limit ? limit / dist : 1;
    const bearing = (Math.atan2(dx, -dy) * 180) / Math.PI;
    return pointOnArc(center, Math.max(1, dist * scale), bearing);
  });
}
