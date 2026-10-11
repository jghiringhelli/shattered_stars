/**
 * droneFlight — the flight path of one repair drone sortie. Pure math, no
 * Phaser; positions are written into a caller-owned point so the per-frame
 * update allocates nothing.
 *
 * A sortie: LAUNCH from the source ship to an orbit around the repaired
 * ship, ORBIT it (welding sparks), then RETURN to the source. Self-repair
 * sorties use the same path with source = target, so the drones pop out of
 * the hull, circle it, and dock again.
 */

/** Time to fly from the source to the repaired ship's orbit. */
export const DRONE_LAUNCH_MS = 450;

/** Time spent circling the repaired ship. */
export const DRONE_ORBIT_MS = 900;

/** Time to fly back and dock. */
export const DRONE_RETURN_MS = 450;

/** Whole sortie length. */
export const DRONE_SORTIE_MS =
  DRONE_LAUNCH_MS + DRONE_ORBIT_MS + DRONE_RETURN_MS;

/** Orbit speed, in turns per second. */
export const DRONE_ORBIT_TURNS_PER_SECOND = 1.1;

/** Milliseconds per second. */
const MS_PER_SECOND = 1000;

/** Full turn in radians. */
const TAU = Math.PI * 2;

/** Sortie phase. */
export type DronePhase = "launch" | "orbit" | "return" | "done";

/** A 2-D point. */
export interface DronePoint {
  readonly x: number;
  readonly y: number;
}

/** Caller-owned output point. */
export interface MutablePoint {
  x: number;
  y: number;
}

/**
 * Phase of a sortie at a given time.
 * @param elapsedMs - Time since launch.
 * @returns The phase.
 */
export function dronePhaseAt(elapsedMs: number): DronePhase {
  if (elapsedMs < DRONE_LAUNCH_MS) return "launch";
  if (elapsedMs < DRONE_LAUNCH_MS + DRONE_ORBIT_MS) return "orbit";
  if (elapsedMs < DRONE_SORTIE_MS) return "return";
  return "done";
}

/**
 * Smoothstep easing (gentle start and stop).
 * @param t - Progress 0–1.
 * @returns Eased progress.
 */
function ease(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Orbit angle at a time into the sortie.
 * @param elapsedMs - Time since launch.
 * @param phaseOffset - The drone's starting angle (radians).
 * @returns The angle (radians).
 */
function orbitAngle(elapsedMs: number, phaseOffset: number): number {
  const orbitMs = Math.min(
    DRONE_ORBIT_MS,
    Math.max(0, elapsedMs - DRONE_LAUNCH_MS),
  );
  return (
    phaseOffset + (TAU * DRONE_ORBIT_TURNS_PER_SECOND * orbitMs) / MS_PER_SECOND
  );
}

/**
 * Where a drone is at a time into its sortie.
 *
 * @param elapsedMs - Time since launch.
 * @param source - Ship the drone launched from (and returns to).
 * @param target - Ship being repaired.
 * @param orbitRadius - Orbit radius around the target.
 * @param phaseOffset - The drone's orbit start angle (spreads a wing).
 * @param out - Receives the position.
 */
export function dronePosition(
  elapsedMs: number,
  source: DronePoint,
  target: DronePoint,
  orbitRadius: number,
  phaseOffset: number,
  out: MutablePoint,
): void {
  const angle = orbitAngle(elapsedMs, phaseOffset);
  const orbitX = target.x + Math.cos(angle) * orbitRadius;
  const orbitY = target.y + Math.sin(angle) * orbitRadius;
  const phase = dronePhaseAt(elapsedMs);
  if (phase === "orbit") {
    out.x = orbitX;
    out.y = orbitY;
    return;
  }
  if (phase === "launch") {
    const t = ease(elapsedMs / DRONE_LAUNCH_MS);
    out.x = source.x + (orbitX - source.x) * t;
    out.y = source.y + (orbitY - source.y) * t;
    return;
  }
  const t = returnProgress(elapsedMs);
  out.x = orbitX + (source.x - orbitX) * t;
  out.y = orbitY + (source.y - orbitY) * t;
}

/**
 * Progress of the return leg, eased (for drones recalled early).
 * @param elapsedMs - Time since launch.
 * @returns Eased progress 0–1 of the return leg.
 */
export function returnProgress(elapsedMs: number): number {
  return ease((elapsedMs - DRONE_LAUNCH_MS - DRONE_ORBIT_MS) / DRONE_RETURN_MS);
}
