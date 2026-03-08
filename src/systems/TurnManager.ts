/**
 * Turn Manager
 *
 * Manages the X-Wing style turn flow:
 * 1. PLANNING - All players secretly choose maneuvers
 * 2. ACTIVATION - Ships reveal and execute maneuvers in pilot skill order (low to high)
 * 3. COMBAT - Ships attack in pilot skill order (high to low)
 * 4. END - Cleanup stress, check victory
 */

import type { ManeuverDefinition } from '../core/types';

export type TurnPhase = 'planning' | 'activation' | 'combat' | 'end';

export interface PlannedManeuver {
  shipId: string;
  maneuver: ManeuverDefinition;
  revealed: boolean;
}

export interface ShipActivationOrder {
  shipId: string;
  pilotSkill: number;
  initiative: number; // Tiebreaker
}

export interface TurnState {
  turnNumber: number;
  phase: TurnPhase;
  plannedManeuvers: Map<string, PlannedManeuver>;
  activationOrder: ShipActivationOrder[];
  currentActivationIndex: number;
  combatOrder: ShipActivationOrder[];
  currentCombatIndex: number;
  actionsPerformed: Map<string, string[]>;
}

export function createTurnState(): TurnState {
  return {
    turnNumber: 1,
    phase: 'planning',
    plannedManeuvers: new Map(),
    activationOrder: [],
    currentActivationIndex: 0,
    combatOrder: [],
    currentCombatIndex: 0,
    actionsPerformed: new Map(),
  };
}

/**
 * Set a ship's planned maneuver during planning phase
 */
export function planManeuver(
  state: TurnState,
  shipId: string,
  maneuver: ManeuverDefinition
): TurnState {
  if (state.phase !== 'planning') {
    console.warn('Cannot plan maneuver outside planning phase');
    return state;
  }

  const newPlanned = new Map(state.plannedManeuvers);
  newPlanned.set(shipId, {
    shipId,
    maneuver,
    revealed: false,
  });

  return {
    ...state,
    plannedManeuvers: newPlanned,
  };
}

/**
 * Transition from planning to activation phase
 */
export function startActivationPhase(
  state: TurnState,
  ships: Array<{ id: string; pilotSkill: number; initiative: number }>
): TurnState {
  // Sort by pilot skill (low to high for activation)
  // Ties broken by initiative (higher initiative activates first among ties)
  const activationOrder = [...ships].sort((a, b) => {
    if (a.pilotSkill !== b.pilotSkill) {
      return a.pilotSkill - b.pilotSkill; // Lower skill moves first
    }
    return b.initiative - a.initiative; // Higher initiative among ties
  });

  // Combat order is reverse (high skill shoots first)
  const combatOrder = [...ships].sort((a, b) => {
    if (a.pilotSkill !== b.pilotSkill) {
      return b.pilotSkill - a.pilotSkill; // Higher skill shoots first
    }
    return b.initiative - a.initiative;
  });

  return {
    ...state,
    phase: 'activation',
    activationOrder: activationOrder.map((s) => ({
      shipId: s.id,
      pilotSkill: s.pilotSkill,
      initiative: s.initiative,
    })),
    currentActivationIndex: 0,
    combatOrder: combatOrder.map((s) => ({
      shipId: s.id,
      pilotSkill: s.pilotSkill,
      initiative: s.initiative,
    })),
    currentCombatIndex: 0,
  };
}

/**
 * Get the current ship that should activate
 */
export function getCurrentActivatingShip(state: TurnState): string | null {
  if (state.phase !== 'activation') return null;
  if (state.currentActivationIndex >= state.activationOrder.length) return null;
  return state.activationOrder[state.currentActivationIndex]?.shipId ?? null;
}

/**
 * Reveal and execute a ship's maneuver, then allow action
 */
export function revealManeuver(state: TurnState, shipId: string): TurnState {
  const planned = state.plannedManeuvers.get(shipId);
  if (!planned) return state;

  const newPlanned = new Map(state.plannedManeuvers);
  newPlanned.set(shipId, { ...planned, revealed: true });

  return {
    ...state,
    plannedManeuvers: newPlanned,
  };
}

/**
 * Record that a ship performed an action
 */
export function recordAction(state: TurnState, shipId: string, action: string): TurnState {
  const newActions = new Map(state.actionsPerformed);
  const shipActions = newActions.get(shipId) ?? [];
  newActions.set(shipId, [...shipActions, action]);

  return {
    ...state,
    actionsPerformed: newActions,
  };
}

/**
 * Move to the next ship in activation order
 */
export function nextActivation(state: TurnState): TurnState {
  const nextIndex = state.currentActivationIndex + 1;

  // If all ships have activated, move to combat phase
  if (nextIndex >= state.activationOrder.length) {
    return {
      ...state,
      phase: 'combat',
      currentActivationIndex: nextIndex,
    };
  }

  return {
    ...state,
    currentActivationIndex: nextIndex,
  };
}

/**
 * Get the current ship that should attack
 */
export function getCurrentCombatShip(state: TurnState): string | null {
  if (state.phase !== 'combat') return null;
  if (state.currentCombatIndex >= state.combatOrder.length) return null;
  return state.combatOrder[state.currentCombatIndex]?.shipId ?? null;
}

/**
 * Move to the next ship in combat order
 */
export function nextCombat(state: TurnState): TurnState {
  const nextIndex = state.currentCombatIndex + 1;

  // If all ships have attacked, move to end phase
  if (nextIndex >= state.combatOrder.length) {
    return {
      ...state,
      phase: 'end',
      currentCombatIndex: nextIndex,
    };
  }

  return {
    ...state,
    currentCombatIndex: nextIndex,
  };
}

/**
 * End the turn and start a new one
 */
export function endTurn(state: TurnState): TurnState {
  return {
    ...createTurnState(),
    turnNumber: state.turnNumber + 1,
  };
}

/**
 * Check if all ships have planned their maneuvers
 */
export function allShipsPlanned(state: TurnState, allShipIds: string[]): boolean {
  return allShipIds.every((id) => state.plannedManeuvers.has(id));
}

/**
 * Get maneuver difficulty color
 */
export function getDifficultyColor(difficulty: 'green' | 'white' | 'red'): number {
  switch (difficulty) {
    case 'green':
      return 0x44ff44;
    case 'red':
      return 0xff4444;
    default:
      return 0xffffff;
  }
}
