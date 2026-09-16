/**
 * ArcadeAI — Pure tactical decision module for arcade AI pilots.
 *
 * No Phaser dependency. Produces an AIDecision each frame that
 * ArcadeBattleScene applies to steering, speed, and actions.
 *
 * Tactical priorities:
 *  - Escort ships (interceptor / fighter) protect bombers, support,
 *    gunships, and capitals — targeting enemies closest to those ships.
 *  - Rear-attack preference: blend aim toward target's 6 o'clock at close range.
 *  - K-turn on overshoot (angleDiff > 150°).
 *  - Boost on long range + low stress.
 *  - Barrel roll to evade close pursuers who are facing us.
 *  - Slow down under stress; accelerate when far and clear.
 */

import type { ShipRole, ManeuverDefinition } from "../core/types";
import type { StressState } from "../arcade/ArcadeStress";
import type { ShipControlState } from "../core/ArcadeControls";
import { canFire } from "../core/ArcadeControls";
import {
  getFormationTarget,
  blendFormationTarget,
  ENGAGE_RADIUS,
  WING_SLOTS,
} from "../ai/FormationAI";
import { torusDelta, torusDistance } from "../core/Torus";

// ============================================
// Tuning constants
// ============================================

/** Roles that escorts should actively protect. */
const PROTECTED_ROLES: readonly ShipRole[] = [
  "bomber",
  "support",
  "gunship",
  "capital",
];

/** Roles that will prioritise protecting the above ships. */
const ESCORT_ROLES: readonly ShipRole[] = [
  "interceptor",
  "light_fighter",
  "heavy_fighter",
];

/** Radius (px) an escort watches around each protected ally for incoming threats. */
const PROTECT_RADIUS = 500;

/** Blend weight toward target's 6 o'clock at very close range. */
const AMBUSH_WEIGHT = 0.45;

/** Range (px) at which full ambush weight applies; tapers to 0 at AMBUSH_RANGE. */
const AMBUSH_RANGE = 300;

/** Offset (px) behind the target for the 6 o'clock aim point. */
const AMBUSH_OFFSET = 200;

/** Angle threshold (deg) past which the ship has overshot and should K-turn. */
const KTURN_OVERSHOOT_DEG = 150;

/** Range (px) — boost when the target is farther than this. */
const BOOST_RANGE = 650;

/** Stress level above which boost is suppressed. */
const BOOST_MAX_STRESS = 0.35;

/** Range (px) — check for barrel-roll-worthy attackers within this radius. */
const BARREL_ROLL_THREAT_RANGE = 250;

/** Attacker must be aiming within this arc (deg) of us to trigger evasive roll. */
const BARREL_ROLL_FACING_ARC = 35;

// ============================================
// Interfaces
// ============================================

/** Read-only ship snapshot consumed by the AI — no mutation. */
export interface AIShipView {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly faction: string;
  readonly role: ShipRole;
  readonly hull: number;
  readonly stress: StressState;
  readonly control: ShipControlState;
  readonly shipDial: readonly ManeuverDefinition[];
  readonly maxAngularVelocity: number;
  /** ID of the ship this wingman should form up with, or null for independent flight. */
  readonly wingLeaderId: string | null;
  /** Index into WING_SLOTS (0 = port, 1 = starboard). */
  readonly wingSlotIndex: number;
}

/** Decision produced for one AI ship this frame. */
export interface AIDecision {
  /** Degrees to rotate this frame (positive = clockwise). */
  readonly turnDelta: number;
  /** Desired speed setting (1–5). */
  readonly desiredSpeed: number;
  readonly doKturn: boolean;
  readonly doBoost: boolean;
  /** When true, fire a barrel roll evasion. */
  readonly doBarrelRoll: boolean;
  /** Direction for the barrel roll. */
  readonly barrelRollDir: "left" | "right";
  readonly firePrimary: boolean;
  /** -1 = no ordnance; 0/1/2 = fire this ordnance slot. */
  readonly firingOrdnanceSlot: number;
}

// ============================================
// Internal helpers
// ============================================

/** Signed angle from point A to point B in degrees, torus-aware. */
function headingToward(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  worldSize: number,
): number {
  const { dx, dy } = torusDelta(ax, ay, bx, by, worldSize);
  return ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360;
}

/** Signed shortest-path difference: result in [-180, 180]. */
function signedDiff(from: number, to: number): number {
  let d = (((to - from) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

// ============================================
// Target selection
// ============================================

/**
 * Selects the best AI target.
 *
 * Escort-role ships first look for enemies threatening protected allies
 * (bomber/support/gunship/capital within PROTECT_RADIUS). If none found,
 * all ships fall back to nearest live enemy.
 *
 * @param ship    - Decision-making ship.
 * @param allies  - All friendly ships (including self).
 * @param enemies - All hostile live ships.
 * @returns Best target, or null if no enemies remain.
 */
export function selectAITarget(
  ship: AIShipView,
  allies: readonly AIShipView[],
  enemies: readonly AIShipView[],
  worldSize: number,
): AIShipView | null {
  const liveEnemies = enemies.filter((e) => e.hull > 0);
  if (liveEnemies.length === 0) return null;

  if (ESCORT_ROLES.includes(ship.role)) {
    const protectedAllies = allies.filter(
      (a) => PROTECTED_ROLES.includes(a.role) && a.hull > 0,
    );
    let closestThreat: AIShipView | null = null;
    let closestThreatDist = Infinity;

    for (const ally of protectedAllies) {
      for (const enemy of liveEnemies) {
        const dist = torusDistance(ally.x, ally.y, enemy.x, enemy.y, worldSize);
        if (dist < PROTECT_RADIUS && dist < closestThreatDist) {
          closestThreatDist = dist;
          closestThreat = enemy;
        }
      }
    }
    if (closestThreat) return closestThreat;
  }

  let nearest: AIShipView | null = null;
  let nearestDist = Infinity;
  for (const enemy of liveEnemies) {
    const d = torusDistance(ship.x, ship.y, enemy.x, enemy.y, worldSize);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = enemy;
    }
  }
  return nearest;
}

// ============================================
// Sub-decision helpers
// ============================================

/**
 * Computes turn delta toward a world position, clamped to ship max turn rate.
 *
 * @param ship    - Turning ship.
 * @param aimX    - World X of steering target.
 * @param aimY    - World Y of steering target.
 * @param deltaMs - Frame time.
 */
function turnToward(
  ship: AIShipView,
  aimX: number,
  aimY: number,
  deltaMs: number,
  worldSize: number,
): number {
  const desiredHeading = headingToward(ship.x, ship.y, aimX, aimY, worldSize);
  const diff = signedDiff(ship.angle, desiredHeading);
  const maxTurn = ship.maxAngularVelocity * (deltaMs / 1000);
  return Math.max(-maxTurn, Math.min(maxTurn, diff));
}

/**
 * Computes turn delta toward target, blending in a rear-attack offset at
 * close range for a more realistic ambush approach.
 *
 * @param ship      - Attacker.
 * @param target    - Lock-on target.
 * @param deltaMs   - Frame time.
 * @returns Clamped turn amount in degrees.
 */
function computeTurnDelta(
  ship: AIShipView,
  target: AIShipView,
  deltaMs: number,
  worldSize: number,
): number {
  const { dx, dy } = torusDelta(ship.x, ship.y, target.x, target.y, worldSize);
  const dist = Math.sqrt(dx * dx + dy * dy);

  // 6 o'clock offset: 200 px directly behind target
  const targetRad = (target.angle - 90) * (Math.PI / 180);
  const sixOclockX = target.x - Math.cos(targetRad) * AMBUSH_OFFSET;
  const sixOclockY = target.y - Math.sin(targetRad) * AMBUSH_OFFSET;

  const ambushBlend = AMBUSH_WEIGHT * Math.max(0, 1 - dist / AMBUSH_RANGE);
  const aimX = target.x + (sixOclockX - target.x) * ambushBlend;
  const aimY = target.y + (sixOclockY - target.y) * ambushBlend;

  return turnToward(ship, aimX, aimY, deltaMs, worldSize);
}

/**
 * Computes formation-blended turn delta for a wingman with an assigned leader.
 * Steers toward formation slot when enemies are distant; breaks off to engage
 * when they close inside ENGAGE_RADIUS.
 *
 * @param ship    - Wingman ship.
 * @param leader  - Formation leader.
 * @param target  - Current enemy target for combat blend.
 * @param dist    - Distance to nearest enemy.
 * @param deltaMs - Frame time.
 */
function computeFormationTurn(
  ship: AIShipView,
  leader: AIShipView,
  target: AIShipView,
  dist: number,
  deltaMs: number,
  worldSize: number,
): number {
  const slot = WING_SLOTS[ship.wingSlotIndex] ?? WING_SLOTS[0]!;
  const formPos = getFormationTarget(leader.x, leader.y, leader.angle, slot);
  const blended = blendFormationTarget(
    formPos,
    { x: target.x, y: target.y },
    dist,
    ENGAGE_RADIUS,
  );
  return turnToward(ship, blended.x, blended.y, deltaMs, worldSize);
}

/**
 * Desired speed driven by stress level and target range.
 *
 * @param ship - Ship whose stress and speed limit are read.
 * @param dist - Distance to current target.
 * @returns Desired speed setting 1–5.
 */
function computeDesiredSpeed(ship: AIShipView, dist: number): number {
  if (ship.stress.isStressed) return 1;
  if (ship.stress.level > 0.5) return 2;
  if (dist > BOOST_RANGE)
    return Math.min(ship.control.maxSpeed, ship.control.speed + 1);
  return ship.control.speed;
}

/**
 * Detects close enemies facing us and returns the evasive barrel-roll
 * direction, or null if no evasive roll is warranted.
 *
 * @param ship    - Evading ship.
 * @param enemies - Live enemy ships.
 */
function selectBarrelRollDir(
  ship: AIShipView,
  enemies: readonly AIShipView[],
  worldSize: number,
): "left" | "right" | null {
  for (const enemy of enemies) {
    if (enemy.hull <= 0) continue;
    const dist = torusDistance(ship.x, ship.y, enemy.x, enemy.y, worldSize);
    if (dist > BARREL_ROLL_THREAT_RANGE) continue;

    const enemyFacingUs = headingToward(
      enemy.x,
      enemy.y,
      ship.x,
      ship.y,
      worldSize,
    );
    if (
      Math.abs(signedDiff(enemy.angle, enemyFacingUs)) > BARREL_ROLL_FACING_ARC
    )
      continue;

    // Roll away from the attacker's relative position
    const relativeBearing = signedDiff(
      ship.angle,
      headingToward(ship.x, ship.y, enemy.x, enemy.y, worldSize),
    );
    return relativeBearing >= 0 ? "left" : "right";
  }
  return null;
}

// ============================================
// Main decision function
// ============================================

/**
 * Computes one frame of AI decisions for a single ship.
 *
 * @param ship    - AI-controlled ship.
 * @param target  - Current locked target.
 * @param allies  - All friendly ships.
 * @param enemies - All hostile live ships.
 * @param deltaMs - Elapsed frame time.
 * @returns Complete decision for this frame.
 */
export function computeAIDecision(
  ship: AIShipView,
  target: AIShipView,
  allies: readonly AIShipView[],
  enemies: readonly AIShipView[],
  deltaMs: number,
  worldSize: number,
): AIDecision {
  const dist = torusDistance(ship.x, ship.y, target.x, target.y, worldSize);

  const leader = ship.wingLeaderId
    ? (allies.find((a) => a.id === ship.wingLeaderId) ?? null)
    : null;
  const turnDelta = leader
    ? computeFormationTurn(ship, leader, target, dist, deltaMs, worldSize)
    : computeTurnDelta(ship, target, deltaMs, worldSize);

  const desiredSpeed = computeDesiredSpeed(ship, dist);

  const aimHeading = headingToward(
    ship.x,
    ship.y,
    target.x,
    target.y,
    worldSize,
  );
  const angleDiffToTarget = Math.abs(signedDiff(ship.angle, aimHeading));

  const doKturn =
    angleDiffToTarget > KTURN_OVERSHOOT_DEG &&
    ship.control.kturnCooldown <= 0 &&
    ship.control.currentManeuver === null;

  const doBoost =
    dist > BOOST_RANGE &&
    ship.stress.level < BOOST_MAX_STRESS &&
    ship.control.boostCooldown <= 0;

  const rollDir = selectBarrelRollDir(ship, enemies, worldSize);
  const doBarrelRoll =
    rollDir !== null &&
    ship.control.barrelRollCooldown <= 0 &&
    angleDiffToTarget >= 45;

  const firePrimary =
    angleDiffToTarget < 30 && dist < 1200 && canFire(ship.control);
  const firingOrdnanceSlot = angleDiffToTarget < 45 && dist < 1500 ? 0 : -1;

  return {
    turnDelta,
    desiredSpeed,
    doKturn,
    doBoost,
    doBarrelRoll,
    barrelRollDir: rollDir ?? "left",
    firePrimary,
    firingOrdnanceSlot,
  };
}
