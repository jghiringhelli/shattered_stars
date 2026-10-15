/**
 * Action definitions — the catalogue of ship actions (Focus, Evade, Barrel Roll...)
 * shown in the ship detail panels. Pure data; the real-time action rules live in
 * src/arcade/ (FlightCapabilities, ShipMotion).
 */

import type { ActionType } from '../core/types';

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
