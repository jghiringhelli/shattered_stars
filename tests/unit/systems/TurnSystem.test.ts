/**
 * Tests for TurnSystem
 */

import { describe, it, expect } from 'vitest';
import {
  PHASE_ORDER,
  createInitialTurnState,
  getActivationOrder,
  getEngagementOrder,
  getNextPhase,
  isTurnComplete,
  advancePhase,
  setPlannedManeuver,
  isPlannningComplete,
  getShipsNeedingPlanning,
  executeActivation,
  applyActivation,
  markShipActivated,
  setActiveShip,
  isActivationComplete,
  getNextShipToActivate,
  markShipAttacked,
  canShipAttack,
  isEngagementComplete,
  getNextShipToEngage,
  processEndPhase,
  processEndPhaseForAll,
  checkVictory,
  createTurnSummary,
  type TurnState,
} from '../../../src/systems/TurnSystem';
import type { ShipState, ManeuverDefinition } from '../../../src/core/types';

// Helper to create a minimal ship state for testing
function createTestShip(
  id: string,
  overrides: Partial<ShipState> = {}
): ShipState {
  return {
    id,
    definitionId: 'test_ship',
    faction: 'terran_hegemony',
    owner: 'player',
    x: 100,
    y: 100,
    angle: 0,
    hull: 3,
    maxHull: 3,
    shields: 2,
    maxShields: 2,
    isStressed: false,
    hasFocus: false,
    hasEvade: false,
    hasTargetLock: null,
    isCloaked: false,
    currentManeuver: null,
    maneuverProgress: 0,
    ...overrides,
  };
}

describe('TurnSystem', () => {
  describe('PHASE_ORDER', () => {
    it('should have all phases in correct order', () => {
      expect(PHASE_ORDER.length).toBe(5);
      expect(PHASE_ORDER[0]?.phase).toBe('planning');
      expect(PHASE_ORDER[1]?.phase).toBe('system');
      expect(PHASE_ORDER[2]?.phase).toBe('activation');
      expect(PHASE_ORDER[3]?.phase).toBe('engagement');
      expect(PHASE_ORDER[4]?.phase).toBe('end');
    });
  });

  describe('createInitialTurnState', () => {
    it('should create initial state with turn 1 in planning', () => {
      const state = createInitialTurnState();

      expect(state.turnNumber).toBe(1);
      expect(state.currentPhase).toBe('planning');
      expect(state.phaseStep).toBe(0);
      expect(state.activatedShips.size).toBe(0);
      expect(state.attackedShips.size).toBe(0);
      expect(state.waitingForInput).toBe(true);
    });
  });

  describe('getActivationOrder', () => {
    it('should sort by initiative ascending (low moves first)', () => {
      const ships = [
        createTestShip('a'),
        createTestShip('b'),
        createTestShip('c'),
      ];
      const getInit = (ship: ShipState) =>
        ship.id === 'a' ? 5 : ship.id === 'b' ? 2 : 3;

      const order = getActivationOrder(ships, getInit);

      expect(order).toEqual(['b', 'c', 'a']);
    });

    it('should break ties by ID', () => {
      const ships = [
        createTestShip('c'),
        createTestShip('a'),
        createTestShip('b'),
      ];
      const getInit = () => 3; // All same initiative

      const order = getActivationOrder(ships, getInit);

      expect(order).toEqual(['a', 'b', 'c']);
    });
  });

  describe('getEngagementOrder', () => {
    it('should sort by initiative descending (high attacks first)', () => {
      const ships = [
        createTestShip('a'),
        createTestShip('b'),
        createTestShip('c'),
      ];
      const getInit = (ship: ShipState) =>
        ship.id === 'a' ? 5 : ship.id === 'b' ? 2 : 3;

      const order = getEngagementOrder(ships, getInit);

      expect(order).toEqual(['a', 'c', 'b']);
    });
  });

  describe('getNextPhase', () => {
    it('should return correct next phase', () => {
      expect(getNextPhase('planning')).toBe('system');
      expect(getNextPhase('system')).toBe('activation');
      expect(getNextPhase('activation')).toBe('engagement');
      expect(getNextPhase('engagement')).toBe('end');
      expect(getNextPhase('end')).toBe('planning');
    });
  });

  describe('isTurnComplete', () => {
    it('should return true when end phase is complete', () => {
      const state: TurnState = {
        ...createInitialTurnState(),
        currentPhase: 'end',
        phaseStep: 1,
      };

      expect(isTurnComplete(state)).toBe(true);
    });

    it('should return false during other phases', () => {
      const state = createInitialTurnState();

      expect(isTurnComplete(state)).toBe(false);
    });
  });

  describe('advancePhase', () => {
    it('should advance to next phase', () => {
      const state = createInitialTurnState();
      const next = advancePhase(state);

      expect(next.currentPhase).toBe('system');
      expect(next.turnNumber).toBe(1);
    });

    it('should increment turn number when wrapping to planning', () => {
      const state: TurnState = {
        ...createInitialTurnState(),
        currentPhase: 'end',
      };
      const next = advancePhase(state);

      expect(next.currentPhase).toBe('planning');
      expect(next.turnNumber).toBe(2);
    });

    it('should reset activated/attacked ships on new turn', () => {
      const state: TurnState = {
        ...createInitialTurnState(),
        currentPhase: 'end',
        activatedShips: new Set(['a', 'b']),
        attackedShips: new Set(['a']),
      };
      const next = advancePhase(state);

      expect(next.activatedShips.size).toBe(0);
      expect(next.attackedShips.size).toBe(0);
    });
  });

  describe('setPlannedManeuver', () => {
    it('should set maneuver for ship', () => {
      const state = createInitialTurnState();
      const maneuver: ManeuverDefinition = {
        direction: 'straight',
        speed: 2,
        difficulty: 'white',
      };

      const newState = setPlannedManeuver(state, 'ship1', maneuver);

      expect(newState.plannedManeuvers.get('ship1')).toEqual(maneuver);
    });
  });

  describe('isPlannningComplete', () => {
    it('should return true when all ships have maneuvers', () => {
      let state = createInitialTurnState();
      const maneuver: ManeuverDefinition = {
        direction: 'straight',
        speed: 2,
        difficulty: 'white',
      };
      state = setPlannedManeuver(state, 'a', maneuver);
      state = setPlannedManeuver(state, 'b', maneuver);

      expect(isPlannningComplete(state, ['a', 'b'])).toBe(true);
    });

    it('should return false when ships are missing maneuvers', () => {
      let state = createInitialTurnState();
      const maneuver: ManeuverDefinition = {
        direction: 'straight',
        speed: 2,
        difficulty: 'white',
      };
      state = setPlannedManeuver(state, 'a', maneuver);

      expect(isPlannningComplete(state, ['a', 'b'])).toBe(false);
    });
  });

  describe('getShipsNeedingPlanning', () => {
    it('should return ships without planned maneuvers', () => {
      let state = createInitialTurnState();
      const maneuver: ManeuverDefinition = {
        direction: 'straight',
        speed: 2,
        difficulty: 'white',
      };
      state = setPlannedManeuver(state, 'a', maneuver);

      const needed = getShipsNeedingPlanning(state, ['a', 'b', 'c']);

      expect(needed).toEqual(['b', 'c']);
    });
  });

  describe('executeActivation', () => {
    it('should generate movement path', () => {
      const ship = createTestShip('a', { x: 100, y: 100, angle: 0 });
      const maneuver: ManeuverDefinition = {
        direction: 'straight',
        speed: 2,
        difficulty: 'white',
      };

      const result = executeActivation(ship, maneuver);

      expect(result.path.length).toBeGreaterThan(0);
      expect(result.newPosition.y).toBeLessThan(100); // Moved forward
    });

    it('should apply stress for red maneuver', () => {
      const ship = createTestShip('a');
      const maneuver: ManeuverDefinition = {
        direction: 'kturn',
        speed: 2,
        difficulty: 'red',
      };

      const result = executeActivation(ship, maneuver);

      expect(result.stressChange.isStressed).toBe(true);
    });
  });

  describe('applyActivation', () => {
    it('should update ship position', () => {
      const ship = createTestShip('a', { x: 100, y: 100, angle: 0 });
      const maneuver: ManeuverDefinition = {
        direction: 'straight',
        speed: 2,
        difficulty: 'white',
      };
      const result = executeActivation(ship, maneuver);

      const updated = applyActivation(ship, result);

      expect(updated.x).toBe(result.newPosition.x);
      expect(updated.y).toBe(result.newPosition.y);
      expect(updated.angle).toBe(result.newPosition.angle);
    });
  });

  describe('markShipActivated', () => {
    it('should add ship to activated set', () => {
      const state = createInitialTurnState();
      const newState = markShipActivated(state, 'ship1');

      expect(newState.activatedShips.has('ship1')).toBe(true);
    });

    it('should clear active ship', () => {
      const state: TurnState = {
        ...createInitialTurnState(),
        activeShipId: 'ship1',
      };
      const newState = markShipActivated(state, 'ship1');

      expect(newState.activeShipId).toBeNull();
    });
  });

  describe('setActiveShip', () => {
    it('should set the active ship', () => {
      const state = createInitialTurnState();
      const newState = setActiveShip(state, 'ship1');

      expect(newState.activeShipId).toBe('ship1');
      expect(newState.waitingForInput).toBe(true);
    });

    it('should clear when set to null', () => {
      const state: TurnState = {
        ...createInitialTurnState(),
        activeShipId: 'ship1',
      };
      const newState = setActiveShip(state, null);

      expect(newState.activeShipId).toBeNull();
    });
  });

  describe('isActivationComplete', () => {
    it('should return true when all ships activated', () => {
      let state = createInitialTurnState();
      state = markShipActivated(state, 'a');
      state = markShipActivated(state, 'b');

      expect(isActivationComplete(state, ['a', 'b'])).toBe(true);
    });

    it('should return false when ships remain', () => {
      let state = createInitialTurnState();
      state = markShipActivated(state, 'a');

      expect(isActivationComplete(state, ['a', 'b'])).toBe(false);
    });
  });

  describe('getNextShipToActivate', () => {
    it('should return first unactivated ship', () => {
      let state = createInitialTurnState();
      state = markShipActivated(state, 'a');

      const next = getNextShipToActivate(state, ['a', 'b', 'c']);

      expect(next).toBe('b');
    });

    it('should return null when all activated', () => {
      let state = createInitialTurnState();
      state = markShipActivated(state, 'a');
      state = markShipActivated(state, 'b');

      const next = getNextShipToActivate(state, ['a', 'b']);

      expect(next).toBeNull();
    });
  });

  describe('engagement functions', () => {
    it('markShipAttacked should track attacked ships', () => {
      const state = createInitialTurnState();
      const newState = markShipAttacked(state, 'ship1');

      expect(newState.attackedShips.has('ship1')).toBe(true);
    });

    it('canShipAttack should return false for ships that attacked', () => {
      let state = createInitialTurnState();
      state = markShipAttacked(state, 'ship1');

      expect(canShipAttack(state, 'ship1')).toBe(false);
      expect(canShipAttack(state, 'ship2')).toBe(true);
    });

    it('isEngagementComplete should check all ships', () => {
      let state = createInitialTurnState();
      state = markShipAttacked(state, 'a');

      expect(isEngagementComplete(state, ['a', 'b'])).toBe(false);

      state = markShipAttacked(state, 'b');
      expect(isEngagementComplete(state, ['a', 'b'])).toBe(true);
    });

    it('getNextShipToEngage should find unengaged ship', () => {
      let state = createInitialTurnState();
      state = markShipAttacked(state, 'a');

      expect(getNextShipToEngage(state, ['a', 'b', 'c'])).toBe('b');
    });
  });

  describe('processEndPhase', () => {
    it('should clear focus and evade tokens', () => {
      const ship = createTestShip('a', { hasFocus: true, hasEvade: true });
      const result = processEndPhase(ship);

      expect(result.hasFocus).toBe(false);
      expect(result.hasEvade).toBe(false);
    });

    it('should preserve target lock', () => {
      const ship = createTestShip('a', { hasTargetLock: 'target' });
      const result = processEndPhase(ship);

      expect(result.hasTargetLock).toBe('target');
    });
  });

  describe('processEndPhaseForAll', () => {
    it('should process all ships', () => {
      const ships = [
        createTestShip('a', { hasFocus: true }),
        createTestShip('b', { hasEvade: true }),
      ];
      const results = processEndPhaseForAll(ships);

      expect(results[0]?.hasFocus).toBe(false);
      expect(results[1]?.hasEvade).toBe(false);
    });
  });

  describe('checkVictory', () => {
    it('should detect player victory when all AI destroyed', () => {
      const ships = [
        createTestShip('player1', { owner: 'player', hull: 2 }),
        createTestShip('ai1', { owner: 'ai', hull: 0 }),
      ];

      const result = checkVictory(ships, 1);

      expect(result.isComplete).toBe(true);
      expect(result.winner).toBe('player');
    });

    it('should detect AI victory when all players destroyed', () => {
      const ships = [
        createTestShip('player1', { owner: 'player', hull: 0 }),
        createTestShip('ai1', { owner: 'ai', hull: 2 }),
      ];

      const result = checkVictory(ships, 1);

      expect(result.isComplete).toBe(true);
      expect(result.winner).toBe('ai');
    });

    it('should detect draw on mutual destruction', () => {
      const ships = [
        createTestShip('player1', { owner: 'player', hull: 0 }),
        createTestShip('ai1', { owner: 'ai', hull: 0 }),
      ];

      const result = checkVictory(ships, 1);

      expect(result.isComplete).toBe(true);
      expect(result.winner).toBe('draw');
    });

    it('should continue when both sides have ships', () => {
      const ships = [
        createTestShip('player1', { owner: 'player', hull: 2 }),
        createTestShip('ai1', { owner: 'ai', hull: 2 }),
      ];

      const result = checkVictory(ships, 1);

      expect(result.isComplete).toBe(false);
    });

    it('should end on turn limit', () => {
      const ships = [
        createTestShip('player1', { owner: 'player', hull: 3, shields: 2 }),
        createTestShip('ai1', { owner: 'ai', hull: 2, shields: 1 }),
      ];

      const result = checkVictory(ships, 12, 12);

      expect(result.isComplete).toBe(true);
      expect(result.winner).toBe('player'); // More total HP
    });
  });

  describe('createTurnSummary', () => {
    it('should track destroyed ships', () => {
      const before = [
        createTestShip('a', { hull: 2 }),
        createTestShip('b', { hull: 1 }),
      ];
      const after = [
        createTestShip('a', { hull: 1 }),
        createTestShip('b', { hull: 0 }),
      ];

      const summary = createTurnSummary(1, before, after);

      expect(summary.shipsDestroyed).toContain('b');
      expect(summary.shipsDestroyed.length).toBe(1);
    });

    it('should calculate damage dealt to AI', () => {
      const before = [
        createTestShip('player', { owner: 'player', hull: 3 }),
        createTestShip('ai', { owner: 'ai', hull: 3, shields: 2 }),
      ];
      const after = [
        createTestShip('player', { owner: 'player', hull: 3 }),
        createTestShip('ai', { owner: 'ai', hull: 2, shields: 0 }), // Lost 1 hull + 2 shields
      ];

      const summary = createTurnSummary(1, before, after);

      expect(summary.damageDealt).toBe(3); // 1 hull + 2 shields
      expect(summary.damageReceived).toBe(0);
    });
  });
});
