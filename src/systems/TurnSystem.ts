/**
 * Turn System
 * Manages game phases and turn structure
 * Based on X-Wing Miniatures turn sequence
 */

import type { ShipState, ManeuverDefinition } from "../core/types";
import { resolveManeuver, generateManeuverPath } from "./MovementSystem";
import { applyManeuverStress, clearRoundTokens } from "./ActionsSystem";
import { isEnginesOffline } from "./CapitalSystems";

// ============================================
// Phase Definitions
// ============================================

export type TurnPhase =
  | "planning" // Players select maneuvers
  | "system" // System phase (decloak, etc.)
  | "activation" // Ships move and perform actions
  | "engagement" // Combat
  | "end"; // Cleanup

export interface PhaseDefinition {
  readonly phase: TurnPhase;
  readonly name: string;
  readonly description: string;
  readonly order: number;
}

export const PHASE_ORDER: PhaseDefinition[] = [
  {
    phase: "planning",
    name: "Planning Phase",
    description: "All players secretly select maneuvers for their ships",
    order: 0,
  },
  {
    phase: "system",
    name: "System Phase",
    description: "Special abilities trigger (decloak, SLAM setup, etc.)",
    order: 1,
  },
  {
    phase: "activation",
    name: "Activation Phase",
    description: "Ships reveal maneuvers, move, and perform actions",
    order: 2,
  },
  {
    phase: "engagement",
    name: "Engagement Phase",
    description: "Ships attack enemies in arc and range",
    order: 3,
  },
  {
    phase: "end",
    name: "End Phase",
    description: "Cleanup tokens, check victory conditions",
    order: 4,
  },
];

// ============================================
// Turn State
// ============================================

export interface TurnState {
  readonly turnNumber: number;
  readonly currentPhase: TurnPhase;
  readonly phaseStep: number;
  /** Ships that have activated this turn (by ID) */
  readonly activatedShips: ReadonlySet<string>;
  /** Ships that have attacked this turn (by ID) */
  readonly attackedShips: ReadonlySet<string>;
  /** Planned maneuvers by ship ID */
  readonly plannedManeuvers: ReadonlyMap<string, ManeuverDefinition>;
  /** Whether the phase is waiting for player input */
  readonly waitingForInput: boolean;
  /** Current ship being activated (if any) */
  readonly activeShipId: string | null;
}

/**
 * Create initial turn state
 */
export function createInitialTurnState(): TurnState {
  return {
    turnNumber: 1,
    currentPhase: "planning",
    phaseStep: 0,
    activatedShips: new Set(),
    attackedShips: new Set(),
    plannedManeuvers: new Map(),
    waitingForInput: true,
    activeShipId: null,
  };
}

// ============================================
// Activation Order
// ============================================

export interface ShipInitiative {
  readonly shipId: string;
  readonly initiative: number;
  readonly pilotSkill: number;
}

/**
 * Sort ships by activation order
 * Lower initiative moves first (disadvantage)
 * Ties broken by player choice (simplified: lower ID first)
 */
export function getActivationOrder(
  ships: readonly ShipState[],
  getInitiative: (ship: ShipState) => number,
): string[] {
  return [...ships]
    .sort((a, b) => {
      const initA = getInitiative(a);
      const initB = getInitiative(b);
      if (initA !== initB) return initA - initB;
      return a.id.localeCompare(b.id);
    })
    .map((ship) => ship.id);
}

/**
 * Sort ships by engagement order (combat)
 * Higher initiative attacks first (advantage)
 */
export function getEngagementOrder(
  ships: readonly ShipState[],
  getInitiative: (ship: ShipState) => number,
): string[] {
  return [...ships]
    .sort((a, b) => {
      const initA = getInitiative(a);
      const initB = getInitiative(b);
      if (initA !== initB) return initB - initA; // Reversed!
      return a.id.localeCompare(b.id);
    })
    .map((ship) => ship.id);
}

// ============================================
// Phase Transitions
// ============================================

/**
 * Get the next phase in sequence
 */
export function getNextPhase(current: TurnPhase): TurnPhase {
  const currentIndex = PHASE_ORDER.findIndex((p) => p.phase === current);
  const nextIndex = (currentIndex + 1) % PHASE_ORDER.length;
  const nextPhase = PHASE_ORDER[nextIndex];
  return nextPhase ? nextPhase.phase : "planning";
}

/**
 * Check if we're at the end of the turn (end phase complete)
 */
export function isTurnComplete(state: TurnState): boolean {
  return state.currentPhase === "end" && state.phaseStep > 0;
}

/**
 * Advance to the next phase
 */
export function advancePhase(state: TurnState): TurnState {
  const nextPhase = getNextPhase(state.currentPhase);
  const isNewTurn = nextPhase === "planning";

  return {
    ...state,
    currentPhase: nextPhase,
    phaseStep: 0,
    turnNumber: isNewTurn ? state.turnNumber + 1 : state.turnNumber,
    activatedShips: isNewTurn ? new Set() : state.activatedShips,
    attackedShips: isNewTurn ? new Set() : state.attackedShips,
    waitingForInput: nextPhase === "planning",
    activeShipId: null,
  };
}

// ============================================
// Planning Phase
// ============================================

/**
 * Set a maneuver for a ship during planning phase
 */
export function setPlannedManeuver(
  state: TurnState,
  shipId: string,
  maneuver: ManeuverDefinition,
): TurnState {
  const newPlanned = new Map(state.plannedManeuvers);
  newPlanned.set(shipId, maneuver);

  return {
    ...state,
    plannedManeuvers: newPlanned,
  };
}

/**
 * Check if all ships have planned maneuvers
 */
export function isPlannningComplete(
  state: TurnState,
  shipIds: readonly string[],
): boolean {
  return shipIds.every((id) => state.plannedManeuvers.has(id));
}

/**
 * Get ships that still need to plan maneuvers
 */
export function getShipsNeedingPlanning(
  state: TurnState,
  shipIds: readonly string[],
): string[] {
  return shipIds.filter((id) => !state.plannedManeuvers.has(id));
}

// ============================================
// Activation Phase
// ============================================

export interface ActivationResult {
  readonly ship: ShipState;
  readonly maneuver: ManeuverDefinition;
  readonly path: Array<{ x: number; y: number; angle: number }>;
  readonly newPosition: { x: number; y: number; angle: number };
  readonly stressChange: { isStressed: boolean; message: string };
}

/**
 * Execute a ship's activation (reveal maneuver and move)
 */
export function executeActivation(
  ship: ShipState,
  maneuver: ManeuverDefinition,
): ActivationResult {
  // Generate movement path
  const path = generateManeuverPath(ship.x, ship.y, ship.angle, maneuver);

  // Calculate final position
  const result = resolveManeuver(ship.x, ship.y, ship.angle, maneuver);

  // Apply stress based on maneuver difficulty
  const stressChange = applyManeuverStress(ship, maneuver.difficulty);

  return {
    ship,
    maneuver,
    path,
    newPosition: {
      x: result.targetX,
      y: result.targetY,
      angle: result.targetAngle,
    },
    stressChange,
  };
}

/**
 * Apply activation result to ship state.
 * A capital ship with disabled engines is immobilized — it keeps its planned
 * maneuver's stress change but never actually moves.
 */
export function applyActivation(
  ship: ShipState,
  result: ActivationResult,
): ShipState {
  const enginesOffline =
    !!ship.capitalSystems && isEnginesOffline(ship.capitalSystems);

  return {
    ...ship,
    x: enginesOffline ? ship.x : result.newPosition.x,
    y: enginesOffline ? ship.y : result.newPosition.y,
    angle: enginesOffline ? ship.angle : result.newPosition.angle,
    isStressed: result.stressChange.isStressed,
    currentManeuver: null,
    maneuverProgress: 0,
  };
}

/**
 * Mark a ship as activated
 */
export function markShipActivated(state: TurnState, shipId: string): TurnState {
  const newActivated = new Set(state.activatedShips);
  newActivated.add(shipId);

  return {
    ...state,
    activatedShips: newActivated,
    activeShipId: null,
  };
}

/**
 * Set the currently activating ship
 */
export function setActiveShip(
  state: TurnState,
  shipId: string | null,
): TurnState {
  return {
    ...state,
    activeShipId: shipId,
    waitingForInput: shipId !== null,
  };
}

/**
 * Check if all ships have activated
 */
export function isActivationComplete(
  state: TurnState,
  shipIds: readonly string[],
): boolean {
  return shipIds.every((id) => state.activatedShips.has(id));
}

/**
 * Get next ship to activate
 */
export function getNextShipToActivate(
  state: TurnState,
  activationOrder: readonly string[],
): string | null {
  for (const id of activationOrder) {
    if (!state.activatedShips.has(id)) {
      return id;
    }
  }
  return null;
}

// ============================================
// Engagement Phase
// ============================================

/**
 * Mark a ship as having attacked
 */
export function markShipAttacked(state: TurnState, shipId: string): TurnState {
  const newAttacked = new Set(state.attackedShips);
  newAttacked.add(shipId);

  return {
    ...state,
    attackedShips: newAttacked,
  };
}

/**
 * Check if ship can attack
 */
export function canShipAttack(state: TurnState, shipId: string): boolean {
  return !state.attackedShips.has(shipId);
}

/**
 * Check if all ships have had attack opportunity
 */
export function isEngagementComplete(
  state: TurnState,
  shipIds: readonly string[],
): boolean {
  return shipIds.every((id) => state.attackedShips.has(id));
}

/**
 * Get next ship to engage
 */
export function getNextShipToEngage(
  state: TurnState,
  engagementOrder: readonly string[],
): string | null {
  for (const id of engagementOrder) {
    if (!state.attackedShips.has(id)) {
      return id;
    }
  }
  return null;
}

// ============================================
// End Phase
// ============================================

/**
 * Process end phase cleanup for a ship
 */
export function processEndPhase(ship: ShipState): ShipState {
  // Clear round-based tokens (focus, evade)
  return clearRoundTokens(ship);
}

/**
 * Process end phase for all ships
 */
export function processEndPhaseForAll(
  ships: readonly ShipState[],
): ShipState[] {
  return ships.map(processEndPhase);
}

// ============================================
// Victory Conditions
// ============================================

export interface VictoryState {
  readonly isComplete: boolean;
  readonly winner: "player" | "ai" | "draw" | null;
  readonly reason: string;
}

/**
 * Check victory conditions
 */
export function checkVictory(
  ships: readonly ShipState[],
  turnNumber: number,
  maxTurns: number = 12,
): VictoryState {
  const playerShips = ships.filter((s) => s.owner === "player" && s.hull > 0);
  const aiShips = ships.filter((s) => s.owner === "ai" && s.hull > 0);

  // All enemy ships destroyed
  if (aiShips.length === 0 && playerShips.length > 0) {
    return {
      isComplete: true,
      winner: "player",
      reason: "All enemy ships destroyed",
    };
  }

  // All player ships destroyed
  if (playerShips.length === 0 && aiShips.length > 0) {
    return {
      isComplete: true,
      winner: "ai",
      reason: "All player ships destroyed",
    };
  }

  // Mutual destruction
  if (playerShips.length === 0 && aiShips.length === 0) {
    return {
      isComplete: true,
      winner: "draw",
      reason: "Mutual destruction",
    };
  }

  // Turn limit reached
  if (turnNumber >= maxTurns) {
    // Winner by points (simplified: more remaining hull)
    const playerHull = playerShips.reduce(
      (sum, s) => sum + s.hull + s.shields,
      0,
    );
    const aiHull = aiShips.reduce((sum, s) => sum + s.hull + s.shields, 0);

    if (playerHull > aiHull) {
      return {
        isComplete: true,
        winner: "player",
        reason: "Turn limit - Player has more remaining hull",
      };
    } else if (aiHull > playerHull) {
      return {
        isComplete: true,
        winner: "ai",
        reason: "Turn limit - AI has more remaining hull",
      };
    } else {
      return {
        isComplete: true,
        winner: "draw",
        reason: "Turn limit - Draw",
      };
    }
  }

  // Game continues
  return {
    isComplete: false,
    winner: null,
    reason: "",
  };
}

// ============================================
// Turn Summary
// ============================================

export interface TurnSummary {
  readonly turnNumber: number;
  readonly shipsActivated: number;
  readonly shipsDestroyed: string[];
  readonly damageDealt: number;
  readonly damageReceived: number;
}

/**
 * Create a summary of what happened during a turn
 */
export function createTurnSummary(
  turnNumber: number,
  beforeShips: readonly ShipState[],
  afterShips: readonly ShipState[],
): TurnSummary {
  const destroyed: string[] = [];
  let damageDealt = 0;
  let damageReceived = 0;

  for (const before of beforeShips) {
    const after = afterShips.find((s) => s.id === before.id);

    if (!after || after.hull <= 0) {
      destroyed.push(before.id);
    }

    if (after) {
      const hullLoss = before.hull - after.hull;
      const shieldLoss = before.shields - after.shields;
      const totalLoss = Math.max(0, hullLoss) + Math.max(0, shieldLoss);

      if (before.owner === "ai") {
        damageDealt += totalLoss;
      } else {
        damageReceived += totalLoss;
      }
    }
  }

  return {
    turnNumber,
    shipsActivated: afterShips.filter((s) => s.hull > 0).length,
    shipsDestroyed: destroyed,
    damageDealt,
    damageReceived,
  };
}
