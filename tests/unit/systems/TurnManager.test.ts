/**
 * TurnManager Tests
 *
 * Tests for the X-Wing style turn flow management.
 */

import { describe, it, expect } from 'vitest';
import {
  createTurnState,
  planManeuver,
  startActivationPhase,
  getCurrentActivatingShip,
  revealManeuver,
  recordAction,
  nextActivation,
  getCurrentCombatShip,
  nextCombat,
  endTurn,
  allShipsPlanned,
  getDifficultyColor,
  type TurnState,
  type PlannedManeuver,
} from '../../../src/systems/TurnManager';
import type { ManeuverDefinition } from '../../../src/core/types';

// Helper to create a test maneuver
function createManeuver(
  direction: 'straight' | 'bank_left' | 'bank_right' = 'straight',
  speed: number = 2,
  difficulty: 'green' | 'white' | 'red' = 'white'
): ManeuverDefinition {
  return { direction, speed, difficulty };
}

// Helper to create test ships with pilot skills
function createTestShips() {
  return [
    { id: 'ship1', pilotSkill: 3, initiative: 2 },
    { id: 'ship2', pilotSkill: 5, initiative: 1 },
    { id: 'ship3', pilotSkill: 3, initiative: 4 }, // Same skill as ship1, higher initiative
    { id: 'ship4', pilotSkill: 1, initiative: 3 },
  ];
}

describe('TurnManager', () => {
  describe('createTurnState', () => {
    it('should create initial turn state', () => {
      const state = createTurnState();

      expect(state.turnNumber).toBe(1);
      expect(state.phase).toBe('planning');
      expect(state.plannedManeuvers.size).toBe(0);
      expect(state.activationOrder).toHaveLength(0);
      expect(state.currentActivationIndex).toBe(0);
      expect(state.combatOrder).toHaveLength(0);
      expect(state.currentCombatIndex).toBe(0);
      expect(state.actionsPerformed.size).toBe(0);
    });
  });

  describe('planManeuver', () => {
    it('should add planned maneuver during planning phase', () => {
      let state = createTurnState();
      const maneuver = createManeuver('straight', 3);

      state = planManeuver(state, 'ship1', maneuver);

      expect(state.plannedManeuvers.has('ship1')).toBe(true);
      const planned = state.plannedManeuvers.get('ship1');
      expect(planned?.maneuver).toEqual(maneuver);
      expect(planned?.revealed).toBe(false);
    });

    it('should allow updating planned maneuver', () => {
      let state = createTurnState();
      const maneuver1 = createManeuver('straight', 2);
      const maneuver2 = createManeuver('bank_left', 3);

      state = planManeuver(state, 'ship1', maneuver1);
      state = planManeuver(state, 'ship1', maneuver2);

      const planned = state.plannedManeuvers.get('ship1');
      expect(planned?.maneuver.direction).toBe('bank_left');
    });

    it('should not modify state in non-planning phase', () => {
      let state = createTurnState();
      state = { ...state, phase: 'activation' };

      const maneuver = createManeuver();
      const newState = planManeuver(state, 'ship1', maneuver);

      expect(newState.plannedManeuvers.has('ship1')).toBe(false);
    });

    it('should allow multiple ships to plan', () => {
      let state = createTurnState();

      state = planManeuver(state, 'ship1', createManeuver('straight'));
      state = planManeuver(state, 'ship2', createManeuver('bank_left'));
      state = planManeuver(state, 'ship3', createManeuver('turn_right'));

      expect(state.plannedManeuvers.size).toBe(3);
    });
  });

  describe('startActivationPhase', () => {
    it('should sort activation order by pilot skill (low to high)', () => {
      let state = createTurnState();
      const ships = createTestShips();

      state = startActivationPhase(state, ships);

      expect(state.phase).toBe('activation');
      // ship4 (skill 1), then ship1/ship3 (skill 3), then ship2 (skill 5)
      expect(state.activationOrder[0]?.pilotSkill).toBe(1);
      expect(state.activationOrder[state.activationOrder.length - 1]?.pilotSkill).toBe(5);
    });

    it('should break ties by initiative (higher first)', () => {
      let state = createTurnState();
      const ships = createTestShips();

      state = startActivationPhase(state, ships);

      // Find the two ships with skill 3
      const skill3Ships = state.activationOrder.filter((s) => s.pilotSkill === 3);
      // ship3 has initiative 4, ship1 has initiative 2
      // Higher initiative should come first
      expect(skill3Ships[0]?.shipId).toBe('ship3');
      expect(skill3Ships[1]?.shipId).toBe('ship1');
    });

    it('should set combat order reverse (high skill first)', () => {
      let state = createTurnState();
      const ships = createTestShips();

      state = startActivationPhase(state, ships);

      // Combat: ship2 (skill 5) first, then skill 3, then ship4 (skill 1)
      expect(state.combatOrder[0]?.pilotSkill).toBe(5);
      expect(state.combatOrder[state.combatOrder.length - 1]?.pilotSkill).toBe(1);
    });

    it('should reset activation and combat indices', () => {
      let state = createTurnState();
      state = { ...state, currentActivationIndex: 5, currentCombatIndex: 3 };

      state = startActivationPhase(state, createTestShips());

      expect(state.currentActivationIndex).toBe(0);
      expect(state.currentCombatIndex).toBe(0);
    });
  });

  describe('getCurrentActivatingShip', () => {
    it('should return null in non-activation phase', () => {
      const state = createTurnState();
      expect(getCurrentActivatingShip(state)).toBeNull();
    });

    it('should return current ship in activation order', () => {
      let state = createTurnState();
      state = startActivationPhase(state, createTestShips());

      const firstShip = getCurrentActivatingShip(state);
      expect(firstShip).toBe(state.activationOrder[0]?.shipId);
    });

    it('should return null when all ships have activated', () => {
      let state = createTurnState();
      state = startActivationPhase(state, createTestShips());
      state = { ...state, currentActivationIndex: state.activationOrder.length };

      expect(getCurrentActivatingShip(state)).toBeNull();
    });
  });

  describe('revealManeuver', () => {
    it('should mark maneuver as revealed', () => {
      let state = createTurnState();
      state = planManeuver(state, 'ship1', createManeuver());
      state = revealManeuver(state, 'ship1');

      expect(state.plannedManeuvers.get('ship1')?.revealed).toBe(true);
    });

    it('should not modify state for unplanned ship', () => {
      let state = createTurnState();
      const originalState = state;

      state = revealManeuver(state, 'nonexistent');

      expect(state).toBe(originalState);
    });

    it('should preserve maneuver details when revealing', () => {
      let state = createTurnState();
      const maneuver = createManeuver('bank_right', 4, 'red');
      state = planManeuver(state, 'ship1', maneuver);
      state = revealManeuver(state, 'ship1');

      const planned = state.plannedManeuvers.get('ship1');
      expect(planned?.maneuver).toEqual(maneuver);
    });
  });

  describe('recordAction', () => {
    it('should record first action for a ship', () => {
      let state = createTurnState();
      state = recordAction(state, 'ship1', 'focus');

      expect(state.actionsPerformed.get('ship1')).toEqual(['focus']);
    });

    it('should append multiple actions', () => {
      let state = createTurnState();
      state = recordAction(state, 'ship1', 'focus');
      state = recordAction(state, 'ship1', 'boost');

      expect(state.actionsPerformed.get('ship1')).toEqual(['focus', 'boost']);
    });

    it('should track actions per ship separately', () => {
      let state = createTurnState();
      state = recordAction(state, 'ship1', 'focus');
      state = recordAction(state, 'ship2', 'evade');

      expect(state.actionsPerformed.get('ship1')).toEqual(['focus']);
      expect(state.actionsPerformed.get('ship2')).toEqual(['evade']);
    });
  });

  describe('nextActivation', () => {
    it('should increment activation index', () => {
      let state = createTurnState();
      state = startActivationPhase(state, createTestShips());

      state = nextActivation(state);

      expect(state.currentActivationIndex).toBe(1);
    });

    it('should transition to combat when all ships activated', () => {
      let state = createTurnState();
      const ships = createTestShips();
      state = startActivationPhase(state, ships);

      // Activate all ships
      for (let i = 0; i < ships.length; i++) {
        state = nextActivation(state);
      }

      expect(state.phase).toBe('combat');
    });

    it('should stay in activation while ships remain', () => {
      let state = createTurnState();
      state = startActivationPhase(state, createTestShips());

      state = nextActivation(state);

      expect(state.phase).toBe('activation');
    });
  });

  describe('getCurrentCombatShip', () => {
    it('should return null in non-combat phase', () => {
      const state = createTurnState();
      expect(getCurrentCombatShip(state)).toBeNull();
    });

    it('should return current ship in combat order', () => {
      let state = createTurnState();
      state = startActivationPhase(state, createTestShips());
      // Move to combat phase
      state = { ...state, phase: 'combat' };

      const firstShip = getCurrentCombatShip(state);
      expect(firstShip).toBe(state.combatOrder[0]?.shipId);
    });

    it('should return null when all ships have attacked', () => {
      let state = createTurnState();
      state = startActivationPhase(state, createTestShips());
      state = { ...state, phase: 'combat', currentCombatIndex: state.combatOrder.length };

      expect(getCurrentCombatShip(state)).toBeNull();
    });
  });

  describe('nextCombat', () => {
    it('should increment combat index', () => {
      let state = createTurnState();
      state = startActivationPhase(state, createTestShips());
      state = { ...state, phase: 'combat' };

      state = nextCombat(state);

      expect(state.currentCombatIndex).toBe(1);
    });

    it('should transition to end when all ships attacked', () => {
      let state = createTurnState();
      const ships = createTestShips();
      state = startActivationPhase(state, ships);
      state = { ...state, phase: 'combat' };

      // All ships attack
      for (let i = 0; i < ships.length; i++) {
        state = nextCombat(state);
      }

      expect(state.phase).toBe('end');
    });
  });

  describe('endTurn', () => {
    it('should increment turn number', () => {
      let state = createTurnState();
      state = { ...state, turnNumber: 3 };

      state = endTurn(state);

      expect(state.turnNumber).toBe(4);
    });

    it('should reset to planning phase', () => {
      let state = createTurnState();
      state = { ...state, phase: 'end' };

      state = endTurn(state);

      expect(state.phase).toBe('planning');
    });

    it('should clear planned maneuvers', () => {
      let state = createTurnState();
      state = planManeuver(state, 'ship1', createManeuver());

      state = endTurn(state);

      expect(state.plannedManeuvers.size).toBe(0);
    });

    it('should clear actions performed', () => {
      let state = createTurnState();
      state = recordAction(state, 'ship1', 'focus');

      state = endTurn(state);

      expect(state.actionsPerformed.size).toBe(0);
    });
  });

  describe('allShipsPlanned', () => {
    it('should return true when all ships have planned', () => {
      let state = createTurnState();
      state = planManeuver(state, 'ship1', createManeuver());
      state = planManeuver(state, 'ship2', createManeuver());

      expect(allShipsPlanned(state, ['ship1', 'ship2'])).toBe(true);
    });

    it('should return false when ships are missing plans', () => {
      let state = createTurnState();
      state = planManeuver(state, 'ship1', createManeuver());

      expect(allShipsPlanned(state, ['ship1', 'ship2'])).toBe(false);
    });

    it('should return true for empty ship list', () => {
      const state = createTurnState();
      expect(allShipsPlanned(state, [])).toBe(true);
    });
  });

  describe('getDifficultyColor', () => {
    it('should return green color for green difficulty', () => {
      expect(getDifficultyColor('green')).toBe(0x44ff44);
    });

    it('should return red color for red difficulty', () => {
      expect(getDifficultyColor('red')).toBe(0xff4444);
    });

    it('should return white color for white difficulty', () => {
      expect(getDifficultyColor('white')).toBe(0xffffff);
    });
  });

  describe('Full turn flow', () => {
    it('should complete a full turn cycle', () => {
      const ships = createTestShips();
      let state = createTurnState();

      // 1. PLANNING
      expect(state.phase).toBe('planning');
      for (const ship of ships) {
        state = planManeuver(state, ship.id, createManeuver());
      }
      expect(allShipsPlanned(state, ships.map((s) => s.id))).toBe(true);

      // 2. ACTIVATION
      state = startActivationPhase(state, ships);
      expect(state.phase).toBe('activation');

      while (state.phase === 'activation') {
        const shipId = getCurrentActivatingShip(state);
        if (shipId) {
          state = revealManeuver(state, shipId);
          state = recordAction(state, shipId, 'focus');
        }
        state = nextActivation(state);
      }

      // 3. COMBAT
      expect(state.phase).toBe('combat');

      while (state.phase === 'combat') {
        const shipId = getCurrentCombatShip(state);
        // Ships would attack here
        state = nextCombat(state);
      }

      // 4. END
      expect(state.phase).toBe('end');
      state = endTurn(state);

      // Back to PLANNING for turn 2
      expect(state.phase).toBe('planning');
      expect(state.turnNumber).toBe(2);
    });
  });
});
