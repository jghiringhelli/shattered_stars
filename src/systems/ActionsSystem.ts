/**
 * Actions System
 * Handles ship actions like Focus, Evade, Barrel Roll, etc.
 * Based on X-Wing Miniatures action mechanics
 */

import type { ShipState, ActionType, ManeuverDifficulty, ManeuverDefinition } from '../core/types';
import { resolveManeuver, distance } from './MovementSystem';

// ============================================
// Action Definitions
// ============================================

export interface ActionDefinition {
  readonly type: ActionType;
  readonly name: string;
  readonly description: string;
  /** Whether this action applies a stress token */
  readonly causesStress: boolean;
  /** Whether stressed ships can perform this action */
  readonly allowedWhenStressed: boolean;
  /** Whether this is a red (stressful) action by default */
  readonly isRed: boolean;
}

export const ACTION_DEFINITIONS: Record<ActionType, ActionDefinition> = {
  focus: {
    type: 'focus',
    name: 'Focus',
    description: 'Gain a focus token to convert focus results on dice',
    causesStress: false,
    allowedWhenStressed: true,
    isRed: false,
  },
  evade: {
    type: 'evade',
    name: 'Evade',
    description: 'Gain an evade token for +1 evade result when defending',
    causesStress: false,
    allowedWhenStressed: true,
    isRed: false,
  },
  target_lock: {
    type: 'target_lock',
    name: 'Target Lock',
    description: 'Lock onto an enemy to reroll attack dice',
    causesStress: false,
    allowedWhenStressed: true,
    isRed: false,
  },
  barrel_roll: {
    type: 'barrel_roll',
    name: 'Barrel Roll',
    description: 'Reposition laterally without changing facing',
    causesStress: false,
    allowedWhenStressed: true,
    isRed: false,
  },
  boost: {
    type: 'boost',
    name: 'Boost',
    description: 'Move forward with a speed 1 maneuver',
    causesStress: false,
    allowedWhenStressed: true,
    isRed: false,
  },
  coordinate: {
    type: 'coordinate',
    name: 'Coordinate',
    description: 'Grant an action to a nearby friendly ship',
    causesStress: false,
    allowedWhenStressed: true,
    isRed: false,
  },
  jam: {
    type: 'jam',
    name: 'Jam',
    description: 'Remove tokens from a nearby enemy ship',
    causesStress: false,
    allowedWhenStressed: true,
    isRed: false,
  },
  cloak: {
    type: 'cloak',
    name: 'Cloak',
    description: 'Become harder to hit but cannot attack',
    causesStress: false,
    allowedWhenStressed: true,
    isRed: false,
  },
  slam: {
    type: 'slam',
    name: 'SLAM',
    description: 'Perform an additional maneuver at the cost of attacking',
    causesStress: false,
    allowedWhenStressed: true,
    isRed: false,
  },
  calculate: {
    type: 'calculate',
    name: 'Calculate',
    description: 'Gain a calculate token (can convert 1 focus result)',
    causesStress: false,
    allowedWhenStressed: true,
    isRed: false,
  },
  reinforce: {
    type: 'reinforce',
    name: 'Reinforce',
    description: 'Add +1 defense result when attacked from a specific arc',
    causesStress: false,
    allowedWhenStressed: true,
    isRed: false,
  },
  rotate_arc: {
    type: 'rotate_arc',
    name: 'Rotate Arc',
    description: 'Rotate your mobile firing arc',
    causesStress: false,
    allowedWhenStressed: true,
    isRed: false,
  },
  reload: {
    type: 'reload',
    name: 'Reload',
    description: 'Recover charges on weapons or devices',
    causesStress: true,
    allowedWhenStressed: false,
    isRed: true,
  },
};

// ============================================
// Action Execution Results
// ============================================

export interface ActionResult {
  readonly success: boolean;
  readonly action: ActionType;
  readonly message: string;
  /** Changes to apply to the ship state */
  readonly stateChanges: Partial<ShipState>;
}

// ============================================
// Action Validation
// ============================================

/**
 * Check if a ship can perform a specific action
 */
export function canPerformAction(
  ship: ShipState,
  action: ActionType,
  availableActions: readonly ActionType[]
): { valid: boolean; reason?: string } {
  // Check if action is in ship's action bar
  if (!availableActions.includes(action)) {
    return { valid: false, reason: 'Action not available to this ship' };
  }

  const definition = ACTION_DEFINITIONS[action];

  // Check stress restriction
  if (ship.isStressed && !definition.allowedWhenStressed) {
    return { valid: false, reason: 'Cannot perform this action while stressed' };
  }

  // Check if already has the token (for focus/evade)
  if (action === 'focus' && ship.hasFocus) {
    return { valid: false, reason: 'Already has focus token' };
  }
  if (action === 'evade' && ship.hasEvade) {
    return { valid: false, reason: 'Already has evade token' };
  }

  // Check cloak status
  if (ship.isCloaked && action !== 'cloak') {
    // Most actions are restricted while cloaked
    if (!['focus', 'evade', 'barrel_roll'].includes(action)) {
      return { valid: false, reason: 'Cannot perform this action while cloaked' };
    }
  }

  return { valid: true };
}

/**
 * Get all actions a ship can currently perform
 */
export function getAvailableActions(
  ship: ShipState,
  actionBar: readonly ActionType[]
): ActionType[] {
  return actionBar.filter(
    (action) => canPerformAction(ship, action, actionBar).valid
  );
}

// ============================================
// Action Execution
// ============================================

/**
 * Execute Focus action
 */
export function executeFocus(ship: ShipState): ActionResult {
  return {
    success: true,
    action: 'focus',
    message: `${ship.id} gained a focus token`,
    stateChanges: { hasFocus: true },
  };
}

/**
 * Execute Evade action
 */
export function executeEvade(ship: ShipState): ActionResult {
  return {
    success: true,
    action: 'evade',
    message: `${ship.id} gained an evade token`,
    stateChanges: { hasEvade: true },
  };
}

/**
 * Execute Target Lock action
 */
export function executeTargetLock(
  ship: ShipState,
  targetId: string
): ActionResult {
  return {
    success: true,
    action: 'target_lock',
    message: `${ship.id} acquired target lock on ${targetId}`,
    stateChanges: { hasTargetLock: targetId },
  };
}

/**
 * Execute Barrel Roll action
 * @param direction 'left' or 'right'
 */
export function executeBarrelRoll(
  ship: ShipState,
  direction: 'left' | 'right'
): ActionResult {
  // Calculate new position (speed 1 bank without angle change)
  const lateralDistance = 40; // Standard barrel roll distance
  const dx = direction === 'left' ? -lateralDistance : lateralDistance;

  // Rotate the movement by ship's facing
  const rad = (ship.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const newX = ship.x + dx * cos;
  const newY = ship.y + dx * sin;

  return {
    success: true,
    action: 'barrel_roll',
    message: `${ship.id} barrel rolled ${direction}`,
    stateChanges: { x: newX, y: newY },
  };
}

/**
 * Execute Boost action
 * @param boostType 'straight', 'bank_left', or 'bank_right'
 */
export function executeBoost(
  ship: ShipState,
  boostType: 'straight' | 'bank_left' | 'bank_right'
): ActionResult {
  const maneuver = {
    direction: boostType,
    speed: 1,
    difficulty: 'white' as ManeuverDifficulty,
  };

  const result = resolveManeuver(ship.x, ship.y, ship.angle, maneuver);

  return {
    success: true,
    action: 'boost',
    message: `${ship.id} boosted ${boostType}`,
    stateChanges: {
      x: result.targetX,
      y: result.targetY,
      angle: result.targetAngle,
    },
  };
}

/**
 * Execute Cloak action
 */
export function executeCloak(ship: ShipState): ActionResult {
  return {
    success: true,
    action: 'cloak',
    message: `${ship.id} cloaked`,
    stateChanges: { isCloaked: true },
  };
}

/**
 * Execute Decloak action (reverse of cloak)
 */
export function executeDecloak(ship: ShipState): ActionResult {
  return {
    success: true,
    action: 'cloak', // Same action type, different effect
    message: `${ship.id} decloaked`,
    stateChanges: { isCloaked: false },
  };
}

// ============================================
// Stress Management
// ============================================

/**
 * Apply stress based on maneuver difficulty
 */
export function applyManeuverStress(
  ship: ShipState,
  difficulty: ManeuverDifficulty
): { isStressed: boolean; message: string } {
  if (difficulty === 'red') {
    return {
      isStressed: true,
      message: `${ship.id} gained stress from red maneuver`,
    };
  }

  if (difficulty === 'green' && ship.isStressed) {
    return {
      isStressed: false,
      message: `${ship.id} removed stress from green maneuver`,
    };
  }

  return {
    isStressed: ship.isStressed,
    message: '',
  };
}

/**
 * Remove stress token from ship
 */
export function removeStress(ship: ShipState): ShipState {
  return { ...ship, isStressed: false };
}

/**
 * Add stress token to ship
 */
export function addStress(ship: ShipState): ShipState {
  return { ...ship, isStressed: true };
}

// ============================================
// Token Management
// ============================================

/**
 * Clear all round-based tokens (focus, evade) at end of round
 */
export function clearRoundTokens(ship: ShipState): ShipState {
  return {
    ...ship,
    hasFocus: false,
    hasEvade: false,
    // Note: Target lock persists across rounds
  };
}

/**
 * Spend focus token (typically during attack/defense)
 */
export function spendFocus(ship: ShipState): ShipState {
  return { ...ship, hasFocus: false };
}

/**
 * Spend evade token (typically during defense)
 */
export function spendEvade(ship: ShipState): ShipState {
  return { ...ship, hasEvade: false };
}

/**
 * Spend target lock (for rerolls)
 */
export function spendTargetLock(ship: ShipState): ShipState {
  return { ...ship, hasTargetLock: null };
}

// ============================================
// Coordinate Action
// ============================================

/**
 * Check if a ship can coordinate another ship
 */
export function canCoordinate(
  coordinator: ShipState,
  target: ShipState,
  coordinateRange: number = 200
): boolean {
  // Must be same faction
  if (coordinator.faction !== target.faction) return false;

  // Can't coordinate self
  if (coordinator.id === target.id) return false;

  // Must be in range
  const dist = distance(coordinator.x, coordinator.y, target.x, target.y);
  return dist <= coordinateRange;
}

/**
 * Get ships that can be coordinated
 */
export function getCoordinateableShips(
  coordinator: ShipState,
  allShips: readonly ShipState[],
  coordinateRange: number = 200
): ShipState[] {
  return allShips.filter((ship) => canCoordinate(coordinator, ship, coordinateRange));
}

// ============================================
// Jam Action
// ============================================

/**
 * Check if a ship can jam another ship
 */
export function canJam(
  jammer: ShipState,
  target: ShipState,
  jamRange: number = 150
): boolean {
  // Must be different faction
  if (jammer.faction === target.faction) return false;

  // Can't jam self
  if (jammer.id === target.id) return false;

  // Must be in range
  const dist = distance(jammer.x, jammer.y, target.x, target.y);
  return dist <= jamRange;
}

/**
 * Execute jam on a target
 * Removes one green token (focus or evade) from target
 */
export function executeJam(
  _jammer: ShipState,
  target: ShipState
): ActionResult {
  const changes: Partial<ShipState> = {};
  let message: string;

  // Prioritize removing focus over evade
  if (target.hasFocus) {
    changes.hasFocus = false;
    message = `Jammed ${target.id}, removed focus token`;
  } else if (target.hasEvade) {
    changes.hasEvade = false;
    message = `Jammed ${target.id}, removed evade token`;
  } else {
    message = `Jammed ${target.id}, no tokens to remove`;
  }

  return {
    success: true,
    action: 'jam',
    message,
    stateChanges: changes,
  };
}

// ============================================
// Coordinate Action Execution
// ============================================

/**
 * Execute coordinate action
 * Returns the action result - the actual action granted to the target
 * must be executed separately
 */
export function executeCoordinate(
  coordinator: ShipState,
  target: ShipState,
  grantedAction: ActionType
): ActionResult {
  // Validate the granted action is performable by the target
  // (Note: In full implementation, this would trigger the target's action)
  return {
    success: true,
    action: 'coordinate',
    message: `${coordinator.id} coordinated ${target.id} to perform ${grantedAction}`,
    stateChanges: {},
  };
}

// ============================================
// Rotate Arc Action
// ============================================

export type ArcDirection = 'front' | 'rear' | 'left' | 'right';

/**
 * Execute rotate arc action
 * Rotates the ship's mobile firing arc to a new direction
 */
export function executeRotateArc(
  ship: ShipState,
  newDirection: ArcDirection
): ActionResult {
  // Validate the direction is different from current
  if (ship.mobileArcDirection === newDirection) {
    return {
      success: false,
      action: 'rotate_arc',
      message: `${ship.id} arc already facing ${newDirection}`,
      stateChanges: {},
    };
  }

  return {
    success: true,
    action: 'rotate_arc',
    message: `${ship.id} rotated arc to ${newDirection}`,
    stateChanges: { mobileArcDirection: newDirection },
  };
}

/**
 * Get valid arc rotation options
 */
export function getArcRotationOptions(ship: ShipState): ArcDirection[] {
  const allDirections: ArcDirection[] = ['front', 'rear', 'left', 'right'];
  return allDirections.filter((dir) => dir !== ship.mobileArcDirection);
}

// ============================================
// Reload Action
// ============================================

/**
 * Execute reload action
 * Recovers one charge on the ship's weapons/abilities
 * This is a red action (causes stress)
 */
export function executeReload(ship: ShipState): ActionResult {
  // Check if charges need reloading
  if (ship.charges >= ship.maxCharges) {
    return {
      success: false,
      action: 'reload',
      message: `${ship.id} already at max charges`,
      stateChanges: {},
    };
  }

  // Reload recovers 1 charge and adds stress
  const newCharges = Math.min(ship.charges + 1, ship.maxCharges);

  return {
    success: true,
    action: 'reload',
    message: `${ship.id} reloaded (${ship.charges} -> ${newCharges} charges)`,
    stateChanges: {
      charges: newCharges,
      isStressed: true, // Reload is a red action
    },
  };
}

/**
 * Check if a ship can reload
 */
export function canReload(ship: ShipState): boolean {
  // Can't reload if stressed (reload is a red action)
  if (ship.isStressed) return false;

  // Can't reload if already at max charges
  if (ship.charges >= ship.maxCharges) return false;

  return true;
}

// ============================================
// Calculate Action
// ============================================

/**
 * Execute calculate action (for droid ships)
 * Similar to focus but weaker - only converts 1 focus result
 */
export function executeCalculate(ship: ShipState): ActionResult {
  return {
    success: true,
    action: 'calculate',
    message: `${ship.id} gained a calculate token`,
    stateChanges: { hasFocus: true }, // Reuse hasFocus for simplicity
  };
}

// ============================================
// Reinforce Action
// ============================================

export type ReinforceDirection = 'fore' | 'aft';

/**
 * Execute reinforce action
 * Adds a defense die when attacked from the specified arc
 */
export function executeReinforce(
  ship: ShipState,
  _direction: ReinforceDirection
): ActionResult {
  // In a full implementation, this would track the reinforce direction
  // For now, we'll just indicate the ship is reinforced
  return {
    success: true,
    action: 'reinforce',
    message: `${ship.id} reinforced`,
    stateChanges: { hasEvade: true }, // Simplified - reuse evade for now
  };
}

// ============================================
// SLAM Action
// ============================================

/**
 * Execute SLAM action
 * Performs an additional maneuver but the ship cannot attack this round
 */
export function executeSLAM(
  ship: ShipState,
  maneuver: ManeuverDefinition
): ActionResult {
  const result = resolveManeuver(ship.x, ship.y, ship.angle, maneuver);

  return {
    success: true,
    action: 'slam',
    message: `${ship.id} performed SLAM maneuver`,
    stateChanges: {
      x: result.targetX,
      y: result.targetY,
      angle: result.targetAngle,
      // Note: The caller should track that this ship cannot attack
    },
  };
}
