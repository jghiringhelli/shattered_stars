/**
 * ArcadeHitRate — headless hit-probability telemetry for arcade projectiles.
 *
 * Drives the REAL projectile functions (createProjectile, updateProjectile,
 * checkProjectileHit) so the numbers match live arcade combat. Answers the
 * design question "do turrets hit as reliably as front lasers?" — both fire the
 * same straight bolt aimed at the target's CURRENT position (no lead), so their
 * per-shot hit chance is identical; the turret's edge is that it auto-aims every
 * cooldown while a laser needs the whole ship pointed at the target. Homing
 * ordnance is modelled with its real steering to show its tracking advantage.
 */

import {
  createProjectile,
  updateProjectile,
  checkProjectileHit,
  isProjectileAlive,
} from "../core/Projectile";

/** Arcade laser/turret bolt speed (px/s) — see createProjectile. */
export const BOLT_SPEED = 2500;

/** Target hit radius used by ArcadeBattleScene.checkCollisions. */
const TARGET_RADIUS = 15;

/** Simulation step (matches the fixed 60 Hz arcade update). */
const STEP_MS = 1000 / 60;

/** Homing profiles from ArcadeOrdnance SLOT_TYPE_PROPS. */
export const HOMING_MISSILE = { turnRate: 90, turnBudget: 360 } as const;
export const HOMING_TORPEDO = { turnRate: 50, turnBudget: 240 } as const;

/** Parameters for a single hit-rate measurement. */
export interface HitRateParams {
  /** Initial shooter->target distance in pixels. */
  readonly range: number;
  /** Target speed in px/s (0 = stationary). */
  readonly targetSpeed: number;
  /** Projectile speed; defaults to the laser/turret bolt speed. */
  readonly projectileSpeed?: number;
  readonly isHoming?: boolean;
  readonly homingTurnRate?: number;
  readonly homingTurnBudget?: number;
  /** Number of target headings sampled around the circle. */
  readonly headingSamples?: number;
  /** Frame-phase offsets averaged per heading (removes frame-grid aliasing). */
  readonly phaseSamples?: number;
}

/** Scene angle convention: 0° points up, clockwise positive. */
function aimAngleTo(dx: number, dy: number): number {
  return ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
}

/**
 * Simulate one aimed shot at a target moving along `heading` (radians).
 * The shooter aims at the target's position at t=0 and fires a straight bolt
 * (or a homing missile that re-steers each frame). `phaseOffset` dithers the
 * start distance within one projectile step to integrate out frame-grid
 * aliasing (real engagements are not pixel-aligned to the frame boundary).
 * Returns true on a hit.
 */
function simulateShot(
  params: HitRateParams,
  heading: number,
  phaseOffset: number,
): boolean {
  const speed = params.projectileSpeed ?? BOLT_SPEED;
  let tx = params.range + phaseOffset;
  let ty = 0;
  const vx = Math.cos(heading) * params.targetSpeed;
  const vy = Math.sin(heading) * params.targetSpeed;

  const aim = aimAngleTo(tx, ty);
  const spawnRad = (aim - 90) * (Math.PI / 180);
  let proj = createProjectile(
    Math.cos(spawnRad) * 20,
    Math.sin(spawnRad) * 20,
    aim,
    "shooter",
    "team_a",
    1,
    params.isHoming ?? false,
    params.isHoming ? "target" : null,
    params.homingTurnRate ?? 0,
    params.homingTurnBudget ?? 0,
  );
  proj = { ...proj, speed };

  const maxSteps = Math.ceil(proj.maxLifetime / STEP_MS);
  for (let i = 0; i < maxSteps; i++) {
    tx += (vx * STEP_MS) / 1000;
    ty += (vy * STEP_MS) / 1000;
    proj = updateProjectile(proj, STEP_MS, tx, ty);
    if (checkProjectileHit(proj, tx, ty, TARGET_RADIUS, "team_b")) return true;
    if (!isProjectileAlive(proj)) return false;
  }
  return false;
}

/**
 * Fraction of aimed shots that connect against a target moving in a uniformly
 * random direction at the given speed and range. Averages over frame-phase
 * offsets so the result reflects continuous engagement geometry rather than a
 * single pixel-aligned snapshot. Deterministic (kinematic).
 */
export function measureHitRate(params: HitRateParams): number {
  const samples = params.headingSamples ?? 72;
  const phaseSamples = params.phaseSamples ?? 8;
  const stepDistance =
    ((params.projectileSpeed ?? BOLT_SPEED) * STEP_MS) / 1000;
  let hits = 0;
  for (let i = 0; i < samples; i++) {
    const heading = (i / samples) * Math.PI * 2;
    for (let p = 0; p < phaseSamples; p++) {
      const phaseOffset = (p / phaseSamples) * stepDistance;
      if (simulateShot(params, heading, phaseOffset)) hits++;
    }
  }
  return hits / (samples * phaseSamples);
}

/** Hit rates for the three arcade weapon families at one range/speed. */
export interface WeaponHitRates {
  readonly range: number;
  readonly targetSpeed: number;
  /** Front laser and auto-aim turret share this straight-bolt hit rate. */
  readonly boltHitRate: number;
  readonly homingMissileHitRate: number;
  readonly homingTorpedoHitRate: number;
}

/** Compare laser/turret bolts vs homing ordnance at a range and target speed. */
export function compareWeapons(
  range: number,
  targetSpeed: number,
  headingSamples = 72,
): WeaponHitRates {
  const base = { range, targetSpeed, headingSamples };
  return {
    range,
    targetSpeed,
    boltHitRate: measureHitRate(base),
    homingMissileHitRate: measureHitRate({
      ...base,
      projectileSpeed: 700,
      isHoming: true,
      homingTurnRate: HOMING_MISSILE.turnRate,
      homingTurnBudget: HOMING_MISSILE.turnBudget,
    }),
    homingTorpedoHitRate: measureHitRate({
      ...base,
      projectileSpeed: 700,
      isHoming: true,
      homingTurnRate: HOMING_TORPEDO.turnRate,
      homingTurnBudget: HOMING_TORPEDO.turnBudget,
    }),
  };
}

/** Sweep a grid of ranges x target speeds for the CLI report. */
export function sweepHitRates(
  ranges: readonly number[],
  speeds: readonly number[],
): WeaponHitRates[] {
  const rows: WeaponHitRates[] = [];
  for (const speed of speeds) {
    for (const range of ranges) {
      rows.push(compareWeapons(range, speed));
    }
  }
  return rows;
}
