/**
 * ArcadeControls — Discrete cycle-based ship control for arcade dogfight mode.
 *
 * Movement model: ships are ALWAYS executing a maneuver. Each cycle is a fixed
 * CYCLE_DURATION_MS window during which the ship follows a pre-calculated
 * template path. Player input queues the NEXT maneuver; the queue commits at
 * cycle end. Default queue is 'straight' at current speed.
 *
 * This mirrors X-Wing TMG: you commit to a maneuver in advance and ride it out.
 * The template distance includes the ship's physical base size (front-to-back
 * geometry), so larger ships naturally cover more ground at the same speed.
 */

import type { ShipState, ManeuverDefinition, ManeuverDirection } from "./types";

/** The only part of a ship the flight engine reads: where it is and where it points. */
export type ShipPose = Pick<ShipState, "x" | "y" | "angle">;
import {
  resolveManeuver,
  generateManeuverPath,
} from "../systems/MovementSystem";
import { CYCLE_DURATION_MS } from "../config";
import type { MovementProfile } from "../data/ShipDefinitions";
import {
  UNRESTRICTED_CAPABILITIES,
  type FlightCapabilities,
} from "./flightCapabilityTypes";

/**
 * Floating-point slack when deciding a cycle is complete (ms). 30 ticks of
 * 1000/60 ms sum to 499.99999…, which must count as a full 500 ms cycle.
 */
const CYCLE_EPSILON_MS = 1e-6;

// ============================================
// Control State
// ============================================

export interface ShipControlState {
  speed: number;
  maxSpeed: number;
  minSpeed: number;

  /** Ship base size in pixels; injected from SHIP_SIZES at creation time. */
  baseSize: number;

  /** Movement interpolation profile: "fighter" (snap/smoothstep) or "capital" (boat easing). */
  movementProfile: MovementProfile;

  /** Maneuver currently being executed (always set after first cycle starts). */
  currentManeuver: ManeuverDirection | null;
  maneuverProgress: number; // 0–1 within the current cycle
  maneuverPath: Array<{ x: number; y: number; angle: number }>;
  maneuverTarget: { x: number; y: number; angle: number } | null;

  /** Maneuver queued for the next cycle (null = default straight). */
  nextManeuver: ManeuverDirection | null;

  /** True once the ship fires its primary laser this cycle; resets at cycle start. */
  firedLaserThisCycle: boolean;

  kturnCooldown: number;
  kturnCooldownMax: number;
  barrelRollCooldown: number;
  barrelRollCooldownMax: number;
  boostCooldown: number;
  boostCooldownMax: number;

  /**
   * Specials on the ship's dial and dashes on its action bar (stress and
   * card rules in src/arcade/systems/FlightCapabilities). Omitted =
   * unrestricted (legacy and test control states).
   */
  capabilities?: FlightCapabilities;
}

/**
 * Recharge times of the red specials and actions (ms). From the tempo
 * experiment (docs/telemetry/tempo-experiment.md): boost and barrel roll
 * recharge x1.5 (3 -> 4.5 s, 2 -> 3 s) lengthen matches without the DPS
 * and skill loss of a longer maneuver cycle. The K-turn family stays at 5 s:
 * slowing it dropped expert-vs-novice pairs below skill gate 1 (85%).
 */
/** K-turn, Segnor loop and Tallon roll share this recharge (ms). */
export const KTURN_RECHARGE_MS = 5000;
/** Boost recharge (ms). */
export const BOOST_RECHARGE_MS = 4500;
/** Barrel roll recharge (ms). */
export const BARREL_ROLL_RECHARGE_MS = 3000;

/**
 * Creates initial control state and immediately starts a straight maneuver
 * so the ship is never idle.
 *
 * @param ship            - Ship whose position/angle seeds the first path.
 * @param baseSize        - Ship base size in pixels (from SHIP_SIZES[size]).
 * @param movementProfile - "fighter" (default) or "capital" (boat easing).
 * @param speedBounds     - Ship's actual speed.min/max (from ShipDefinition.baseStats);
 *                          defaults to the generic 1-5 fighter range when omitted.
 * @param capabilities    - Specials/dashes the ship may fly (unrestricted when omitted).
 */
export function createControlState(
  ship: ShipPose,
  baseSize: number = 0,
  movementProfile: MovementProfile = "fighter",
  speedBounds: { min: number; max: number } = { min: 1, max: 5 },
  capabilities: FlightCapabilities = UNRESTRICTED_CAPABILITIES,
): ShipControlState {
  const minSpeed = speedBounds.min;
  const maxSpeed = speedBounds.max;
  const base: ShipControlState = {
    speed: Math.min(Math.max(3, minSpeed), maxSpeed),
    maxSpeed,
    minSpeed,
    baseSize,
    movementProfile,
    currentManeuver: null,
    maneuverProgress: 0,
    maneuverPath: [],
    maneuverTarget: null,
    nextManeuver: null,
    firedLaserThisCycle: false,
    kturnCooldown: 0,
    kturnCooldownMax: KTURN_RECHARGE_MS,
    barrelRollCooldown: 0,
    barrelRollCooldownMax: BARREL_ROLL_RECHARGE_MS,
    boostCooldown: 0,
    boostCooldownMax: BOOST_RECHARGE_MS,
    capabilities,
  };
  return startManeuver(ship, base, "straight");
}

// ============================================
// Input Commands
// ============================================

export type FlightCommand =
  | "thrust_increase"
  | "thrust_decrease"
  /** Sustained shallow turn — what a held steering key queues. */
  | "drift_left"
  | "drift_right"
  | "turn_left"
  | "turn_right"
  | "bank_left"
  | "bank_right"
  | "kturn"
  | "tallon_left"
  | "tallon_right"
  | "segnor_left"
  | "segnor_right"
  | "fire"
  | "focus"
  | "evade";

// ============================================
// Cycle Execution
// ============================================

/**
 * Starts the given maneuver immediately, overwriting any in-progress one.
 * Called by createControlState (first cycle) and advanceCycle (each subsequent cycle).
 *
 * @param ship      - Current ship state (position/angle used as path start).
 * @param control   - Control state; baseSize drives template length.
 * @param direction - Maneuver direction to execute.
 */
export function startManeuver(
  ship: ShipPose,
  control: ShipControlState,
  direction: ManeuverDirection,
): ShipControlState {
  const maneuver: ManeuverDefinition = {
    direction,
    speed: control.speed,
    difficulty: getManeuverDifficulty(direction, control.speed),
  };

  const path = generateManeuverPath(
    ship.x,
    ship.y,
    ship.angle,
    maneuver,
    20,
    control.baseSize,
    control.movementProfile,
  );
  const result = resolveManeuver(
    ship.x,
    ship.y,
    ship.angle,
    maneuver,
    control.baseSize,
  );

  return {
    ...control,
    currentManeuver: direction,
    maneuverProgress: 0,
    maneuverPath: path,
    maneuverTarget: {
      x: result.targetX,
      y: result.targetY,
      angle: result.targetAngle,
    },
    firedLaserThisCycle: false,
  };
}

/**
 * Pose at a fraction of a sampled maneuver path, interpolated between the two
 * nearest waypoints so motion is smooth at any tick rate (no 25 ms steps).
 *
 * @param path - Waypoints from start to end of the cycle.
 * @param progress - Fraction of the cycle elapsed, 0–1.
 * @returns The interpolated pose, or null for an empty path.
 */
export function samplePath(
  path: ReadonlyArray<{ x: number; y: number; angle: number }>,
  progress: number,
): { x: number; y: number; angle: number } | null {
  if (path.length === 0) return null;
  const scaled = Math.max(0, Math.min(1, progress)) * (path.length - 1);
  const index = Math.min(path.length - 2, Math.floor(scaled));
  const from = path[Math.max(0, index)]!;
  const to = path[Math.max(0, index) + 1] ?? from;
  const f = scaled - Math.max(0, index);
  const turn = ((to.angle - from.angle + 540) % 360) - 180;
  return {
    x: from.x + (to.x - from.x) * f,
    y: from.y + (to.y - from.y) * f,
    angle: (((from.angle + turn * f) % 360) + 360) % 360,
  };
}

/**
 * Advances the current maneuver by one frame.
 *
 * Returns `cycleComplete: true` when the cycle finishes; the caller must then
 * invoke {@link advanceCycle} to commit the queued maneuver and begin the next one.
 *
 * @param control  - Current control state.
 * @param deltaMs  - Elapsed frame time in ms.
 */
export function updateManeuver(
  control: ShipControlState,
  deltaMs: number,
): {
  control: ShipControlState;
  position: { x: number; y: number; angle: number } | null;
  cycleComplete: boolean;
  /** Time left over after the cycle completed, owed to the next cycle (ms). */
  overflowMs: number;
} {
  if (control.currentManeuver === null || control.maneuverPath.length === 0) {
    return { control, position: null, cycleComplete: false, overflowMs: 0 };
  }

  // Accumulate in milliseconds: summing dt/CYCLE fractions drifts below 1.0
  // at 60 Hz and stretched every 500 ms cycle to 31 ticks (516.7 ms).
  const elapsedMs = control.maneuverProgress * CYCLE_DURATION_MS + deltaMs;
  const newProgress = Math.min(1, elapsedMs / CYCLE_DURATION_MS);
  const pathPoint = samplePath(control.maneuverPath, newProgress);

  if (elapsedMs >= CYCLE_DURATION_MS - CYCLE_EPSILON_MS) {
    return {
      control: { ...control, maneuverProgress: 1 },
      position: control.maneuverTarget,
      cycleComplete: true,
      overflowMs: Math.max(0, elapsedMs - CYCLE_DURATION_MS),
    };
  }

  return {
    control: { ...control, maneuverProgress: newProgress },
    position: pathPoint ?? null,
    cycleComplete: false,
    overflowMs: 0,
  };
}

/**
 * Commits the queued maneuver and starts the next cycle.
 * Must be called immediately when {@link updateManeuver} returns cycleComplete=true,
 * with the ship's position already updated to the cycle's final target.
 *
 * @param ship    - Ship state at the end of the completed cycle.
 * @param control - Control state (reads nextManeuver; clears it after commit).
 */
export function advanceCycle(
  ship: ShipPose,
  control: ShipControlState,
): ShipControlState {
  const direction: ManeuverDirection = control.nextManeuver ?? "straight";
  return startManeuver(ship, { ...control, nextManeuver: null }, direction);
}

// ============================================
// Cooldown Management
// ============================================

/**
 * Drains all per-frame cooldown timers (actions only, not weapon fire).
 *
 * @param control  - Current control state.
 * @param deltaMs  - Elapsed frame time in ms.
 */
export function updateCooldowns(
  control: ShipControlState,
  deltaMs: number,
): ShipControlState {
  return {
    ...control,
    kturnCooldown: Math.max(0, control.kturnCooldown - deltaMs),
    barrelRollCooldown: Math.max(0, control.barrelRollCooldown - deltaMs),
    boostCooldown: Math.max(0, control.boostCooldown - deltaMs),
  };
}

/** @returns true when the ship can fire its primary laser (once per cycle). */
export function canFire(control: ShipControlState): boolean {
  return !control.firedLaserThisCycle;
}

/** Marks the primary laser as fired for this cycle. */
export function fireWeapon(control: ShipControlState): ShipControlState {
  return { ...control, firedLaserThisCycle: true };
}

/** @returns true when a K-turn (or Tallon/Segnor) can be queued. */
export function canKTurn(control: ShipControlState): boolean {
  return control.kturnCooldown <= 0;
}

/** @returns true when a barrel roll can be queued. */
export function canBarrelRoll(control: ShipControlState): boolean {
  return control.barrelRollCooldown <= 0;
}

/**
 * Returns true when the boost dash is off cooldown.
 *
 * @param control - Current control state.
 */
export function canBoost(control: ShipControlState): boolean {
  return control.boostCooldown <= 0;
}

export function useKTurn(control: ShipControlState): ShipControlState {
  return { ...control, kturnCooldown: control.kturnCooldownMax };
}

export function useBarrelRoll(control: ShipControlState): ShipControlState {
  return { ...control, barrelRollCooldown: control.barrelRollCooldownMax };
}

/**
 * Starts the boost cooldown timer.
 *
 * @param control - Current control state.
 * @returns Updated state with boost on cooldown.
 */
export function useBoost(control: ShipControlState): ShipControlState {
  return { ...control, boostCooldown: control.boostCooldownMax };
}

// ============================================
// Helpers
// ============================================

export function getManeuverDifficulty(
  direction: ManeuverDirection,
  speed: number,
): "green" | "white" | "red" {
  if (direction === "kturn") return "red";
  if (direction.includes("tallon") || direction.includes("segnor"))
    return "red";
  if ((direction === "turn_left" || direction === "turn_right") && speed >= 3)
    return "red";
  // A sustained shallow turn is the arcade equivalent of holding course, so it
  // drains stress at low speed exactly like flying straight. Classifying it as
  // a dial turn would mean a held steering key pinned stress at maximum.
  if (direction === "drift_left" || direction === "drift_right")
    return speed <= 2 ? "green" : "white";
  if (direction === "straight" && speed <= 2) return "green";
  return "white";
}

/**
 * Process a flight command and return updated control state.
 *
 * Movement commands (bank, turn, kturn, etc.) write to `nextManeuver` and
 * take effect at the next cycle boundary — they do NOT interrupt the current
 * executing maneuver. Speed changes, fire, focus, and evade are immediate.
 *
 * @param ship    - Ship state (position/angle used if a maneuver must start immediately).
 * @param control - Current control state.
 * @param command - The command to process.
 */
export function processCommand(
  ship: ShipPose,
  control: ShipControlState,
  command: FlightCommand,
): ShipControlState {
  switch (command) {
    case "thrust_increase":
      return {
        ...control,
        speed: Math.min(control.maxSpeed, control.speed + 1),
      };

    case "thrust_decrease":
      return {
        ...control,
        speed: Math.max(control.minSpeed, control.speed - 1),
      };

    // Standard direction queues — take effect next cycle
    case "drift_left":
      return { ...control, nextManeuver: "drift_left" };
    case "drift_right":
      return { ...control, nextManeuver: "drift_right" };
    case "turn_left":
      return { ...control, nextManeuver: "turn_left" };
    case "turn_right":
      return { ...control, nextManeuver: "turn_right" };
    case "bank_left":
      return { ...control, nextManeuver: "bank_left" };
    case "bank_right":
      return { ...control, nextManeuver: "bank_right" };

    // Special maneuvers — consume cooldown at queue time
    case "kturn":
      if (canKTurn(control))
        return { ...useKTurn(control), nextManeuver: "kturn" };
      return control;

    case "tallon_left":
      if (canKTurn(control))
        return { ...useKTurn(control), nextManeuver: "tallon_left" };
      return control;

    case "tallon_right":
      if (canKTurn(control))
        return { ...useKTurn(control), nextManeuver: "tallon_right" };
      return control;

    case "segnor_left":
      if (canKTurn(control))
        return { ...useKTurn(control), nextManeuver: "segnor_left" };
      return control;

    case "segnor_right":
      if (canKTurn(control))
        return { ...useKTurn(control), nextManeuver: "segnor_right" };
      return control;

    case "fire":
      if (canFire(control)) return fireWeapon(control);
      return control;

    default:
      return control;
  }
}

// ============================================
// Legacy helpers (kept for turn-based scene compatibility)
// ============================================

export const SIZE_BASE_SPEED: Readonly<Record<string, number>> = {
  tiny: 140,
  small: 120,
  medium: 105,
  large: 90,
  huge: 70,
};

/**
 * Returns the pixels-per-speed-unit for the given size category.
 * Used by the turn-based battle scene; arcade mode uses the cycle system instead.
 */
export function getSizeMovementBase(size: string): number {
  return SIZE_BASE_SPEED[size] ?? 120;
}

/**
 * @deprecated Arcade mode uses the discrete cycle system. This remains for
 * turn-based compatibility but should not be used in ArcadeBattleScene.
 */
export function getContinuousMovement(
  ship: ShipPose,
  control: ShipControlState,
  deltaMs: number,
  speedBase = 120,
): { x: number; y: number } {
  if (control.currentManeuver !== null) return { x: ship.x, y: ship.y };
  const dist = (speedBase * control.speed * deltaMs) / 1000;
  const rad = (ship.angle - 90) * (Math.PI / 180);
  return { x: ship.x + Math.cos(rad) * dist, y: ship.y + Math.sin(rad) * dist };
}
