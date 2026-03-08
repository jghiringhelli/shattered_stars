/**
 * Flight Control System
 *
 * Implements momentum-based flying with granular speed control.
 * This provides more realistic arcade-style flight physics compared
 * to the discrete maneuver system used in tactical mode.
 *
 * Features:
 * - Continuous throttle control (0-100%)
 * - Momentum/inertia simulation
 * - Afterburner/boost mechanics
 * - Drift physics for tight turns
 * - Ship-specific handling characteristics
 */

import type { ShipSize } from '../config';
import type { ShipRole, ShipState, ShipStats } from '../core/types';

// ============================================
// Flight Physics Constants
// ============================================

export const FLIGHT_CONSTANTS = {
  // Speed scales (units per second)
  BASE_MAX_SPEED: 500,
  AFTERBURNER_MULTIPLIER: 1.5,

  // Acceleration (percentage of max speed per second)
  BASE_ACCELERATION: 0.8, // 80% of max speed per second
  BASE_DECELERATION: 0.6, // 60% per second when throttling down
  DRAG_COEFFICIENT: 0.1, // Natural slowdown at 0 throttle

  // Turn rates (degrees per second)
  BASE_TURN_RATE: 180,
  MIN_TURN_RATE_AT_MAX_SPEED: 0.4, // 40% of base at max speed

  // Drift mechanics
  DRIFT_THRESHOLD: 0.7, // Speed ratio where drift kicks in
  DRIFT_TURN_BONUS: 1.5, // Turn rate multiplier while drifting
  DRIFT_SPEED_DECAY: 0.3, // Speed loss per second while drifting

  // Throttle increments
  THROTTLE_INCREMENT: 0.1, // 10% per input
  THROTTLE_SMOOTH_RATE: 2.0, // How fast actual throttle catches up to target
} as const;

// ============================================
// Ship Handling Profiles
// ============================================

export interface HandlingProfile {
  readonly acceleration: number; // Multiplier
  readonly deceleration: number; // Multiplier
  readonly maxSpeed: number; // Multiplier
  readonly turnRate: number; // Multiplier
  readonly driftCapability: number; // 0-1, how well ship can drift
  readonly afterburnerDuration: number; // Seconds
  readonly afterburnerCooldown: number; // Seconds
  readonly inertia: number; // How sluggish the ship feels (higher = more sluggish)
}

/**
 * Default handling profiles by ship size and role
 */
export function getHandlingProfile(size: ShipSize, role: ShipRole): HandlingProfile {
  // Base by size
  const sizeProfiles: Record<ShipSize, HandlingProfile> = {
    tiny: {
      acceleration: 1.4,
      deceleration: 1.4,
      maxSpeed: 1.2,
      turnRate: 1.5,
      driftCapability: 0.9,
      afterburnerDuration: 2,
      afterburnerCooldown: 6,
      inertia: 0.5,
    },
    small: {
      acceleration: 1.2,
      deceleration: 1.2,
      maxSpeed: 1.1,
      turnRate: 1.3,
      driftCapability: 0.8,
      afterburnerDuration: 3,
      afterburnerCooldown: 8,
      inertia: 0.7,
    },
    medium: {
      acceleration: 1.0,
      deceleration: 1.0,
      maxSpeed: 1.0,
      turnRate: 1.0,
      driftCapability: 0.5,
      afterburnerDuration: 4,
      afterburnerCooldown: 10,
      inertia: 1.0,
    },
    large: {
      acceleration: 0.6,
      deceleration: 0.5,
      maxSpeed: 0.8,
      turnRate: 0.5,
      driftCapability: 0.2,
      afterburnerDuration: 6,
      afterburnerCooldown: 15,
      inertia: 1.5,
    },
    huge: {
      acceleration: 0.3,
      deceleration: 0.25,
      maxSpeed: 0.6,
      turnRate: 0.25,
      driftCapability: 0.0,
      afterburnerDuration: 8,
      afterburnerCooldown: 25,
      inertia: 2.5,
    },
  };

  // Role modifiers
  const roleModifiers: Partial<Record<ShipRole, Partial<HandlingProfile>>> = {
    interceptor: {
      acceleration: 1.3,
      maxSpeed: 1.2,
      turnRate: 1.2,
      driftCapability: 0.9,
    },
    light_fighter: {
      acceleration: 1.1,
      turnRate: 1.1,
      driftCapability: 0.7,
    },
    heavy_fighter: {
      acceleration: 0.9,
      maxSpeed: 0.95,
      turnRate: 0.9,
      inertia: 1.1,
    },
    bomber: {
      acceleration: 0.7,
      maxSpeed: 0.85,
      turnRate: 0.7,
      driftCapability: 0.3,
      inertia: 1.3,
    },
    gunship: {
      acceleration: 0.8,
      maxSpeed: 0.9,
      turnRate: 0.8,
      inertia: 1.2,
    },
    support: {
      acceleration: 0.85,
      maxSpeed: 0.9,
      turnRate: 0.85,
    },
    capital: {
      acceleration: 0.4,
      deceleration: 0.3,
      maxSpeed: 0.6,
      turnRate: 0.3,
      driftCapability: 0.0,
      afterburnerDuration: 10,
      afterburnerCooldown: 30,
      inertia: 2.5,
    },
  };

  const base = sizeProfiles[size];
  const mods = roleModifiers[role] ?? {};

  return {
    acceleration: base.acceleration * (mods.acceleration ?? 1),
    deceleration: base.deceleration * (mods.deceleration ?? 1),
    maxSpeed: base.maxSpeed * (mods.maxSpeed ?? 1),
    turnRate: base.turnRate * (mods.turnRate ?? 1),
    driftCapability: Math.min(1, base.driftCapability * (mods.driftCapability ?? 1)),
    afterburnerDuration: mods.afterburnerDuration ?? base.afterburnerDuration,
    afterburnerCooldown: mods.afterburnerCooldown ?? base.afterburnerCooldown,
    inertia: base.inertia * (mods.inertia ?? 1),
  };
}

// ============================================
// Flight State
// ============================================

export interface FlightState {
  // Ship reference
  readonly shipId: string;

  // Velocity (actual movement)
  velocityX: number; // Units per second
  velocityY: number;
  currentSpeed: number; // Magnitude of velocity

  // Throttle
  targetThrottle: number; // 0-1, what player is requesting
  currentThrottle: number; // 0-1, actual throttle (smoothed)

  // Rotation
  angularVelocity: number; // Degrees per second
  targetAngle: number; // Where player wants to face

  // Afterburner
  isAfterburnerActive: boolean;
  afterburnerFuel: number; // 0-1
  afterburnerCooldownRemaining: number;

  // Drift
  isDrifting: boolean;
  driftAngle: number; // Direction of drift vs facing

  // Stall (when damaged or at extremes)
  isStalled: boolean;
  stallRecoveryTime: number;

  // Handling profile (cached)
  handling: HandlingProfile;
}

// ============================================
// Flight Control Input
// ============================================

export interface FlightInput {
  throttleChange?: number; // -1 to 1 (negative = decelerate)
  turnDirection?: number; // -1 (left) to 1 (right)
  afterburner?: boolean; // Activate afterburner
  brake?: boolean; // Emergency brake
  drift?: boolean; // Initiate drift
}

// ============================================
// Flight Control Functions
// ============================================

/**
 * Create initial flight state for a ship
 */
export function createFlightState(
  shipId: string,
  size: ShipSize,
  role: ShipRole,
  initialAngle: number = 0
): FlightState {
  return {
    shipId,
    velocityX: 0,
    velocityY: 0,
    currentSpeed: 0,
    targetThrottle: 0,
    currentThrottle: 0,
    angularVelocity: 0,
    targetAngle: initialAngle,
    isAfterburnerActive: false,
    afterburnerFuel: 1,
    afterburnerCooldownRemaining: 0,
    isDrifting: false,
    driftAngle: 0,
    isStalled: false,
    stallRecoveryTime: 0,
    handling: getHandlingProfile(size, role),
  };
}

/**
 * Process flight input and return updated state
 */
export function processFlightInput(
  state: FlightState,
  input: FlightInput,
  deltaTime: number
): FlightState {
  let newState = { ...state };

  // Handle stall recovery
  if (newState.isStalled) {
    newState.stallRecoveryTime -= deltaTime;
    if (newState.stallRecoveryTime <= 0) {
      newState.isStalled = false;
      newState.stallRecoveryTime = 0;
    } else {
      // Still stalled, limited control
      newState.currentThrottle *= 0.5;
      return newState;
    }
  }

  // Process throttle input
  if (input.throttleChange !== undefined) {
    newState.targetThrottle = Math.max(
      0,
      Math.min(1, newState.targetThrottle + input.throttleChange * FLIGHT_CONSTANTS.THROTTLE_INCREMENT)
    );
  }

  // Emergency brake
  if (input.brake) {
    newState.targetThrottle = 0;
    newState.isDrifting = true; // Brake induces drift
  }

  // Smooth throttle transition
  const throttleDiff = newState.targetThrottle - newState.currentThrottle;
  const throttleRate =
    throttleDiff > 0
      ? state.handling.acceleration * FLIGHT_CONSTANTS.THROTTLE_SMOOTH_RATE
      : state.handling.deceleration * FLIGHT_CONSTANTS.THROTTLE_SMOOTH_RATE;

  newState.currentThrottle +=
    Math.sign(throttleDiff) * Math.min(Math.abs(throttleDiff), throttleRate * deltaTime);

  // Afterburner handling
  newState = processAfterburner(newState, input, deltaTime);

  // Calculate max speed for current state
  let effectiveMaxSpeed = FLIGHT_CONSTANTS.BASE_MAX_SPEED * state.handling.maxSpeed;
  if (newState.isAfterburnerActive) {
    effectiveMaxSpeed *= FLIGHT_CONSTANTS.AFTERBURNER_MULTIPLIER;
  }

  // Calculate target speed
  const targetSpeed = effectiveMaxSpeed * newState.currentThrottle;

  // Apply acceleration/deceleration with inertia
  const speedDiff = targetSpeed - newState.currentSpeed;
  const accelRate =
    speedDiff > 0
      ? FLIGHT_CONSTANTS.BASE_ACCELERATION * state.handling.acceleration
      : FLIGHT_CONSTANTS.BASE_DECELERATION * state.handling.deceleration;

  // Inertia makes acceleration slower
  const effectiveAccel = accelRate / state.handling.inertia;
  newState.currentSpeed +=
    Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), effectiveAccel * effectiveMaxSpeed * deltaTime);

  // Apply drag at low throttle
  if (newState.currentThrottle < 0.1 && newState.currentSpeed > 0) {
    const drag = FLIGHT_CONSTANTS.DRAG_COEFFICIENT * effectiveMaxSpeed * deltaTime;
    newState.currentSpeed = Math.max(0, newState.currentSpeed - drag);
  }

  // Process turning
  newState = processTurning(newState, input, deltaTime);

  // Process drift
  newState = processDrift(newState, input, deltaTime);

  // Update velocity vector
  const facingRadians = (newState.targetAngle * Math.PI) / 180;
  if (newState.isDrifting) {
    // During drift, velocity doesn't fully align with facing
    const driftRadians = (newState.driftAngle * Math.PI) / 180;
    const blendFactor = 0.3; // How much facing affects velocity during drift
    const effectiveAngle = driftRadians + (facingRadians - driftRadians) * blendFactor;
    newState.velocityX = Math.sin(effectiveAngle) * newState.currentSpeed;
    newState.velocityY = -Math.cos(effectiveAngle) * newState.currentSpeed;
  } else {
    newState.velocityX = Math.sin(facingRadians) * newState.currentSpeed;
    newState.velocityY = -Math.cos(facingRadians) * newState.currentSpeed;
  }

  return newState;
}

/**
 * Process afterburner state
 */
function processAfterburner(
  state: FlightState,
  input: FlightInput,
  deltaTime: number
): FlightState {
  const newState = { ...state };

  // Cooldown timer
  if (newState.afterburnerCooldownRemaining > 0) {
    newState.afterburnerCooldownRemaining -= deltaTime;
  }

  // Recharge fuel when not in use
  if (!newState.isAfterburnerActive && newState.afterburnerFuel < 1) {
    const rechargeRate = 1 / state.handling.afterburnerCooldown;
    newState.afterburnerFuel = Math.min(1, newState.afterburnerFuel + rechargeRate * deltaTime);
  }

  // Activate afterburner
  if (input.afterburner && newState.afterburnerFuel > 0 && newState.afterburnerCooldownRemaining <= 0) {
    newState.isAfterburnerActive = true;
  }

  // Deactivate when released or empty
  if (!input.afterburner || newState.afterburnerFuel <= 0) {
    if (newState.isAfterburnerActive) {
      newState.afterburnerCooldownRemaining = state.handling.afterburnerCooldown * 0.3; // Partial cooldown
    }
    newState.isAfterburnerActive = false;
  }

  // Consume fuel while active
  if (newState.isAfterburnerActive) {
    const consumeRate = 1 / state.handling.afterburnerDuration;
    newState.afterburnerFuel -= consumeRate * deltaTime;
    if (newState.afterburnerFuel <= 0) {
      newState.afterburnerFuel = 0;
      newState.isAfterburnerActive = false;
      newState.afterburnerCooldownRemaining = state.handling.afterburnerCooldown;
    }
  }

  return newState;
}

/**
 * Process turning mechanics
 */
function processTurning(
  state: FlightState,
  input: FlightInput,
  deltaTime: number
): FlightState {
  const newState = { ...state };

  if (input.turnDirection === undefined || input.turnDirection === 0) {
    // No turn input, reduce angular velocity
    newState.angularVelocity *= 0.9;
    return newState;
  }

  // Calculate base turn rate
  let baseTurnRate = FLIGHT_CONSTANTS.BASE_TURN_RATE * state.handling.turnRate;

  // Turn rate decreases at higher speeds
  const speedRatio = state.currentSpeed / (FLIGHT_CONSTANTS.BASE_MAX_SPEED * state.handling.maxSpeed);
  const speedPenalty =
    1 - speedRatio * (1 - FLIGHT_CONSTANTS.MIN_TURN_RATE_AT_MAX_SPEED);
  baseTurnRate *= speedPenalty;

  // Drift bonus
  if (state.isDrifting) {
    baseTurnRate *= FLIGHT_CONSTANTS.DRIFT_TURN_BONUS;
  }

  // Apply turn with inertia
  const targetAngularVelocity = input.turnDirection * baseTurnRate;
  const angularAccel = baseTurnRate * 2 / state.handling.inertia;
  const angularDiff = targetAngularVelocity - newState.angularVelocity;

  newState.angularVelocity +=
    Math.sign(angularDiff) * Math.min(Math.abs(angularDiff), angularAccel * deltaTime);

  // Apply rotation
  newState.targetAngle += newState.angularVelocity * deltaTime;

  // Normalize angle
  while (newState.targetAngle < 0) newState.targetAngle += 360;
  while (newState.targetAngle >= 360) newState.targetAngle -= 360;

  return newState;
}

/**
 * Process drift mechanics
 */
function processDrift(
  state: FlightState,
  input: FlightInput,
  deltaTime: number
): FlightState {
  const newState = { ...state };

  // Check if ship can drift
  if (state.handling.driftCapability <= 0) {
    newState.isDrifting = false;
    return newState;
  }

  // Initiate drift
  if (input.drift && !state.isDrifting) {
    const speedRatio = state.currentSpeed / (FLIGHT_CONSTANTS.BASE_MAX_SPEED * state.handling.maxSpeed);
    if (speedRatio >= FLIGHT_CONSTANTS.DRIFT_THRESHOLD) {
      newState.isDrifting = true;
      // Store current velocity direction as drift angle
      newState.driftAngle = Math.atan2(state.velocityX, -state.velocityY) * (180 / Math.PI);
    }
  }

  // Maintain or exit drift
  if (newState.isDrifting) {
    // Speed decay during drift
    const decay = FLIGHT_CONSTANTS.DRIFT_SPEED_DECAY * state.handling.driftCapability;
    newState.currentSpeed = Math.max(0, newState.currentSpeed - decay * deltaTime * 100);

    // Exit drift at low speed
    const speedRatio = newState.currentSpeed / (FLIGHT_CONSTANTS.BASE_MAX_SPEED * state.handling.maxSpeed);
    if (speedRatio < FLIGHT_CONSTANTS.DRIFT_THRESHOLD * 0.5 || !input.drift) {
      newState.isDrifting = false;
    }
  }

  return newState;
}

/**
 * Apply flight state to ship position
 */
export function applyFlightMovement(
  ship: ShipState,
  flightState: FlightState,
  deltaTime: number
): { x: number; y: number; angle: number } {
  return {
    x: ship.x + flightState.velocityX * deltaTime,
    y: ship.y + flightState.velocityY * deltaTime,
    angle: flightState.targetAngle,
  };
}

/**
 * Apply damage effects to flight state
 */
export function applyDamageToFlight(
  state: FlightState,
  damagePercent: number
): FlightState {
  const newState = { ...state };

  // Heavy damage causes stall
  if (damagePercent > 30) {
    newState.isStalled = true;
    newState.stallRecoveryTime = damagePercent * 0.03; // 0.9s for 30%, 3s for 100%
  }

  // Moderate damage reduces throttle
  if (damagePercent > 15) {
    newState.currentThrottle *= 0.7;
    newState.targetThrottle *= 0.8;
  }

  return newState;
}

/**
 * Get throttle control increments for UI
 * This implements "increasingly shorter speed change deltas" for fine control
 */
export function getThrottleIncrements(): number[] {
  return [
    0.25, // 25% - Large change
    0.10, // 10% - Medium change
    0.05, // 5% - Small change
    0.02, // 2% - Fine adjustment
    0.01, // 1% - Precision
  ];
}

/**
 * Calculate recommended throttle for given target speed
 */
export function calculateThrottleForSpeed(
  targetSpeed: number,
  handling: HandlingProfile
): number {
  const maxSpeed = FLIGHT_CONSTANTS.BASE_MAX_SPEED * handling.maxSpeed;
  return Math.max(0, Math.min(1, targetSpeed / maxSpeed));
}

/**
 * Get flight telemetry for HUD display
 */
export interface FlightTelemetry {
  readonly speedPercent: number;
  readonly throttlePercent: number;
  readonly turnRatePercent: number;
  readonly afterburnerPercent: number;
  readonly afterburnerReady: boolean;
  readonly isDrifting: boolean;
  readonly isStalled: boolean;
  readonly heading: number;
}

export function getFlightTelemetry(state: FlightState): FlightTelemetry {
  const maxSpeed = FLIGHT_CONSTANTS.BASE_MAX_SPEED * state.handling.maxSpeed;
  const maxTurnRate = FLIGHT_CONSTANTS.BASE_TURN_RATE * state.handling.turnRate;

  return {
    speedPercent: (state.currentSpeed / maxSpeed) * 100,
    throttlePercent: state.currentThrottle * 100,
    turnRatePercent: (Math.abs(state.angularVelocity) / maxTurnRate) * 100,
    afterburnerPercent: state.afterburnerFuel * 100,
    afterburnerReady: state.afterburnerCooldownRemaining <= 0 && state.afterburnerFuel > 0.1,
    isDrifting: state.isDrifting,
    isStalled: state.isStalled,
    heading: Math.round(state.targetAngle),
  };
}

/**
 * Predict position after given time
 */
export function predictPosition(
  currentX: number,
  currentY: number,
  flightState: FlightState,
  seconds: number
): { x: number; y: number } {
  // Simple linear prediction (doesn't account for acceleration)
  return {
    x: currentX + flightState.velocityX * seconds,
    y: currentY + flightState.velocityY * seconds,
  };
}

/**
 * Calculate intercept course to target
 */
export function calculateInterceptAngle(
  shipX: number,
  shipY: number,
  targetX: number,
  targetY: number,
  targetVelocityX: number,
  targetVelocityY: number,
  projectileSpeed: number
): number | null {
  // Vector to target
  const dx = targetX - shipX;
  const dy = targetY - shipY;

  // Quadratic formula for intercept time
  const a = targetVelocityX * targetVelocityX + targetVelocityY * targetVelocityY - projectileSpeed * projectileSpeed;
  const b = 2 * (dx * targetVelocityX + dy * targetVelocityY);
  const c = dx * dx + dy * dy;

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    // No intercept possible
    return null;
  }

  // Get positive time solution
  const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
  const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);
  const t = t1 > 0 ? (t2 > 0 ? Math.min(t1, t2) : t1) : t2;

  if (t <= 0) {
    return null;
  }

  // Calculate intercept point
  const interceptX = targetX + targetVelocityX * t;
  const interceptY = targetY + targetVelocityY * t;

  // Calculate angle to intercept point
  const angle = Math.atan2(interceptX - shipX, -(interceptY - shipY)) * (180 / Math.PI);
  return (angle + 360) % 360;
}
