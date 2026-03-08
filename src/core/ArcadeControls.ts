/**
 * Arcade Controls
 * Real-time ship control with X-Wing style maneuvers mapped to arcade inputs
 */

import type { ShipState, ManeuverDefinition, ManeuverDirection } from './types';
import { resolveManeuver, generateManeuverPath } from '../systems/MovementSystem';

// ============================================
// Control State
// ============================================

export interface ShipControlState {
  // Current speed (1-5)
  speed: number;
  maxSpeed: number;
  minSpeed: number;

  // Current maneuver being executed
  currentManeuver: ManeuverDirection | null;
  maneuverProgress: number; // 0-1
  maneuverPath: Array<{ x: number; y: number; angle: number }>;
  maneuverTarget: { x: number; y: number; angle: number } | null;

  // Weapons
  weaponCooldown: number; // ms until can fire again
  weaponCooldownMax: number;

  // Special maneuvers cooldown
  kturnCooldown: number;
  kturnCooldownMax: number;
  barrelRollCooldown: number;
  barrelRollCooldownMax: number;
}

export function createControlState(ship: ShipState): ShipControlState {
  return {
    speed: 3,
    maxSpeed: 5,
    minSpeed: 1,
    currentManeuver: null,
    maneuverProgress: 0,
    maneuverPath: [],
    maneuverTarget: null,
    weaponCooldown: 0,
    weaponCooldownMax: 500, // 0.5s between shots
    kturnCooldown: 0,
    kturnCooldownMax: 5000, // 5s cooldown
    barrelRollCooldown: 0,
    barrelRollCooldownMax: 2000, // 2s cooldown
  };
}

// ============================================
// Input Commands
// ============================================

export type FlightCommand =
  | 'thrust_increase'
  | 'thrust_decrease'
  | 'turn_left'
  | 'turn_right'
  | 'bank_left'
  | 'bank_right'
  | 'kturn'
  | 'barrel_roll_left'
  | 'barrel_roll_right'
  | 'fire'
  | 'focus'
  | 'evade';

// ============================================
// Movement Execution
// ============================================

/**
 * Start a maneuver from current position
 */
export function startManeuver(
  ship: ShipState,
  control: ShipControlState,
  direction: ManeuverDirection
): ShipControlState {
  // Can't start new maneuver while one is in progress
  if (control.currentManeuver !== null && control.maneuverProgress < 1) {
    return control;
  }

  const maneuver: ManeuverDefinition = {
    direction,
    speed: control.speed,
    difficulty: getManeuverDifficulty(direction, control.speed),
  };

  const path = generateManeuverPath(ship.x, ship.y, ship.angle, maneuver, 20);
  const result = resolveManeuver(ship.x, ship.y, ship.angle, maneuver);

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
  };
}

/**
 * Update maneuver progress based on delta time
 */
export function updateManeuver(
  control: ShipControlState,
  deltaMs: number
): { control: ShipControlState; position: { x: number; y: number; angle: number } | null } {
  if (control.currentManeuver === null || control.maneuverPath.length === 0) {
    return { control, position: null };
  }

  // Maneuver duration based on speed (faster = quicker maneuver)
  const baseDuration = 800; // ms for speed 1
  const duration = baseDuration / (control.speed * 0.5);

  const newProgress = Math.min(1, control.maneuverProgress + deltaMs / duration);

  // Get interpolated position from path
  const pathIndex = Math.floor(newProgress * (control.maneuverPath.length - 1));
  const position = control.maneuverPath[pathIndex] ?? control.maneuverTarget;

  // Check if maneuver is complete
  if (newProgress >= 1) {
    return {
      control: {
        ...control,
        currentManeuver: null,
        maneuverProgress: 0,
        maneuverPath: [],
        maneuverTarget: null,
      },
      position: control.maneuverTarget,
    };
  }

  return {
    control: { ...control, maneuverProgress: newProgress },
    position: position ?? null,
  };
}

/**
 * Continuous forward movement when no maneuver active
 */
export function getContinuousMovement(
  ship: ShipState,
  control: ShipControlState,
  deltaMs: number
): { x: number; y: number } {
  if (control.currentManeuver !== null) {
    return { x: ship.x, y: ship.y };
  }

  // Move forward based on current speed
  const pixelsPerSecond = control.speed * 60; // 60 pixels per speed unit per second
  const distance = (pixelsPerSecond * deltaMs) / 1000;

  const rad = (ship.angle - 90) * (Math.PI / 180); // -90 because 0 = up
  return {
    x: ship.x + Math.cos(rad) * distance,
    y: ship.y + Math.sin(rad) * distance,
  };
}

// ============================================
// Cooldown Management
// ============================================

export function updateCooldowns(
  control: ShipControlState,
  deltaMs: number
): ShipControlState {
  return {
    ...control,
    weaponCooldown: Math.max(0, control.weaponCooldown - deltaMs),
    kturnCooldown: Math.max(0, control.kturnCooldown - deltaMs),
    barrelRollCooldown: Math.max(0, control.barrelRollCooldown - deltaMs),
  };
}

export function canFire(control: ShipControlState): boolean {
  return control.weaponCooldown <= 0;
}

export function canKTurn(control: ShipControlState): boolean {
  return control.kturnCooldown <= 0 && control.currentManeuver === null;
}

export function canBarrelRoll(control: ShipControlState): boolean {
  return control.barrelRollCooldown <= 0 && control.currentManeuver === null;
}

export function fireWeapon(control: ShipControlState): ShipControlState {
  return { ...control, weaponCooldown: control.weaponCooldownMax };
}

export function useKTurn(control: ShipControlState): ShipControlState {
  return { ...control, kturnCooldown: control.kturnCooldownMax };
}

export function useBarrelRoll(control: ShipControlState): ShipControlState {
  return { ...control, barrelRollCooldown: control.barrelRollCooldownMax };
}

// ============================================
// Helpers
// ============================================

function getManeuverDifficulty(
  direction: ManeuverDirection,
  speed: number
): 'green' | 'white' | 'red' {
  // K-turns and high-speed turns are red
  if (direction === 'kturn') return 'red';
  if (direction.includes('tallon') || direction.includes('segnor')) return 'red';
  if ((direction === 'turn_left' || direction === 'turn_right') && speed >= 3) return 'red';

  // Straight at low speed is green
  if (direction === 'straight' && speed <= 2) return 'green';

  return 'white';
}

/**
 * Process a flight command and return updated control state
 */
export function processCommand(
  ship: ShipState,
  control: ShipControlState,
  command: FlightCommand
): ShipControlState {
  switch (command) {
    case 'thrust_increase':
      return {
        ...control,
        speed: Math.min(control.maxSpeed, control.speed + 1),
      };

    case 'thrust_decrease':
      return {
        ...control,
        speed: Math.max(control.minSpeed, control.speed - 1),
      };

    case 'turn_left':
      if (control.currentManeuver === null) {
        return startManeuver(ship, control, 'turn_left');
      }
      return control;

    case 'turn_right':
      if (control.currentManeuver === null) {
        return startManeuver(ship, control, 'turn_right');
      }
      return control;

    case 'bank_left':
      if (control.currentManeuver === null) {
        return startManeuver(ship, control, 'bank_left');
      }
      return control;

    case 'bank_right':
      if (control.currentManeuver === null) {
        return startManeuver(ship, control, 'bank_right');
      }
      return control;

    case 'kturn':
      if (canKTurn(control)) {
        let newControl = useKTurn(control);
        return startManeuver(ship, newControl, 'kturn');
      }
      return control;

    case 'barrel_roll_left':
      if (canBarrelRoll(control)) {
        let newControl = useBarrelRoll(control);
        // Barrel roll is a lateral move, we'll handle it specially
        return startManeuver(ship, newControl, 'bank_left');
      }
      return control;

    case 'barrel_roll_right':
      if (canBarrelRoll(control)) {
        let newControl = useBarrelRoll(control);
        return startManeuver(ship, newControl, 'bank_right');
      }
      return control;

    case 'fire':
      if (canFire(control)) {
        return fireWeapon(control);
      }
      return control;

    default:
      return control;
  }
}
