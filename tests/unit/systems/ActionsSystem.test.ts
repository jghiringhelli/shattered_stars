/**
 * Tests for ActionsSystem
 */

import { describe, it, expect } from 'vitest';
import {
  ACTION_DEFINITIONS,
  canPerformAction,
  getAvailableActions,
  executeFocus,
  executeEvade,
  executeTargetLock,
  executeBarrelRoll,
  executeBoost,
  executeCloak,
  executeDecloak,
  applyManeuverStress,
  removeStress,
  addStress,
  clearRoundTokens,
  spendFocus,
  spendEvade,
  spendTargetLock,
  canCoordinate,
  getCoordinateableShips,
  canJam,
  executeJam,
  executeCoordinate,
  executeRotateArc,
  executeReload,
  canReload,
  getArcRotationOptions,
} from '../../../src/systems/ActionsSystem';
import type { ShipState, ActionType } from '../../../src/core/types';

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
    mobileArcDirection: 'front',
    charges: 2,
    maxCharges: 3,
    ...overrides,
  };
}

describe('ActionsSystem', () => {
  describe('ACTION_DEFINITIONS', () => {
    it('should define all standard actions', () => {
      const actions: ActionType[] = [
        'focus',
        'evade',
        'target_lock',
        'barrel_roll',
        'boost',
        'coordinate',
        'jam',
        'cloak',
        'slam',
        'calculate',
        'reinforce',
        'rotate_arc',
        'reload',
      ];

      for (const action of actions) {
        expect(ACTION_DEFINITIONS[action]).toBeDefined();
        expect(ACTION_DEFINITIONS[action].type).toBe(action);
      }
    });

    it('should mark reload as a red action that causes stress', () => {
      expect(ACTION_DEFINITIONS.reload.causesStress).toBe(true);
      expect(ACTION_DEFINITIONS.reload.isRed).toBe(true);
      expect(ACTION_DEFINITIONS.reload.allowedWhenStressed).toBe(false);
    });
  });

  describe('canPerformAction', () => {
    const standardActions: ActionType[] = ['focus', 'evade', 'target_lock', 'barrel_roll'];

    it('should allow action in ships action bar', () => {
      const ship = createTestShip('a');
      const result = canPerformAction(ship, 'focus', standardActions);

      expect(result.valid).toBe(true);
    });

    it('should reject action not in ships action bar', () => {
      const ship = createTestShip('a');
      const result = canPerformAction(ship, 'boost', standardActions);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not available');
    });

    it('should reject focus if already has focus', () => {
      const ship = createTestShip('a', { hasFocus: true });
      const result = canPerformAction(ship, 'focus', standardActions);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Already has focus');
    });

    it('should reject evade if already has evade', () => {
      const ship = createTestShip('a', { hasEvade: true });
      const result = canPerformAction(ship, 'evade', standardActions);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Already has evade');
    });

    it('should reject reload when stressed', () => {
      const ship = createTestShip('a', { isStressed: true });
      const actions: ActionType[] = ['reload'];
      const result = canPerformAction(ship, 'reload', actions);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('stressed');
    });

    it('should allow standard actions when stressed', () => {
      const ship = createTestShip('a', { isStressed: true });
      const result = canPerformAction(ship, 'focus', standardActions);

      expect(result.valid).toBe(true);
    });
  });

  describe('getAvailableActions', () => {
    it('should return all available actions', () => {
      const ship = createTestShip('a');
      const actionBar: ActionType[] = ['focus', 'evade', 'barrel_roll'];

      const available = getAvailableActions(ship, actionBar);

      expect(available).toEqual(['focus', 'evade', 'barrel_roll']);
    });

    it('should exclude actions ship already has tokens for', () => {
      const ship = createTestShip('a', { hasFocus: true });
      const actionBar: ActionType[] = ['focus', 'evade', 'barrel_roll'];

      const available = getAvailableActions(ship, actionBar);

      expect(available).not.toContain('focus');
      expect(available).toContain('evade');
    });
  });

  describe('executeFocus', () => {
    it('should grant focus token', () => {
      const ship = createTestShip('a');
      const result = executeFocus(ship);

      expect(result.success).toBe(true);
      expect(result.action).toBe('focus');
      expect(result.stateChanges.hasFocus).toBe(true);
    });
  });

  describe('executeEvade', () => {
    it('should grant evade token', () => {
      const ship = createTestShip('a');
      const result = executeEvade(ship);

      expect(result.success).toBe(true);
      expect(result.action).toBe('evade');
      expect(result.stateChanges.hasEvade).toBe(true);
    });
  });

  describe('executeTargetLock', () => {
    it('should acquire target lock', () => {
      const ship = createTestShip('a');
      const result = executeTargetLock(ship, 'target_id');

      expect(result.success).toBe(true);
      expect(result.action).toBe('target_lock');
      expect(result.stateChanges.hasTargetLock).toBe('target_id');
    });
  });

  describe('executeBarrelRoll', () => {
    it('should move ship left', () => {
      const ship = createTestShip('a', { x: 100, y: 100, angle: 0 });
      const result = executeBarrelRoll(ship, 'left');

      expect(result.success).toBe(true);
      expect(result.stateChanges.x).toBeLessThan(100);
    });

    it('should move ship right', () => {
      const ship = createTestShip('a', { x: 100, y: 100, angle: 0 });
      const result = executeBarrelRoll(ship, 'right');

      expect(result.success).toBe(true);
      expect(result.stateChanges.x).toBeGreaterThan(100);
    });

    it('should account for ship facing', () => {
      const ship = createTestShip('a', { x: 100, y: 100, angle: 90 }); // Facing right
      const result = executeBarrelRoll(ship, 'left');

      // When facing right, "left" is up (negative Y)
      expect(result.stateChanges.y).toBeLessThan(100);
    });
  });

  describe('executeBoost', () => {
    it('should move ship forward for straight boost', () => {
      const ship = createTestShip('a', { x: 100, y: 100, angle: 0 });
      const result = executeBoost(ship, 'straight');

      expect(result.success).toBe(true);
      expect(result.stateChanges.y).toBeLessThan(100); // Forward is negative Y
      expect(result.stateChanges.angle).toBe(0);
    });

    it('should turn ship for bank boost', () => {
      const ship = createTestShip('a', { x: 100, y: 100, angle: 0 });
      const result = executeBoost(ship, 'bank_right');

      expect(result.success).toBe(true);
      expect(result.stateChanges.angle).toBe(45); // Bank right turns 45°
    });
  });

  describe('executeCloak / executeDecloak', () => {
    it('should cloak ship', () => {
      const ship = createTestShip('a');
      const result = executeCloak(ship);

      expect(result.success).toBe(true);
      expect(result.stateChanges.isCloaked).toBe(true);
    });

    it('should decloak ship', () => {
      const ship = createTestShip('a', { isCloaked: true });
      const result = executeDecloak(ship);

      expect(result.success).toBe(true);
      expect(result.stateChanges.isCloaked).toBe(false);
    });
  });

  describe('applyManeuverStress', () => {
    it('should add stress for red maneuver', () => {
      const ship = createTestShip('a');
      const result = applyManeuverStress(ship, 'red');

      expect(result.isStressed).toBe(true);
    });

    it('should remove stress for green maneuver when stressed', () => {
      const ship = createTestShip('a', { isStressed: true });
      const result = applyManeuverStress(ship, 'green');

      expect(result.isStressed).toBe(false);
    });

    it('should not remove stress for white maneuver', () => {
      const ship = createTestShip('a', { isStressed: true });
      const result = applyManeuverStress(ship, 'white');

      expect(result.isStressed).toBe(true);
    });

    it('should not add stress for green maneuver', () => {
      const ship = createTestShip('a');
      const result = applyManeuverStress(ship, 'green');

      expect(result.isStressed).toBe(false);
    });
  });

  describe('stress management', () => {
    it('removeStress should clear stress', () => {
      const ship = createTestShip('a', { isStressed: true });
      const result = removeStress(ship);

      expect(result.isStressed).toBe(false);
    });

    it('addStress should set stress', () => {
      const ship = createTestShip('a');
      const result = addStress(ship);

      expect(result.isStressed).toBe(true);
    });
  });

  describe('clearRoundTokens', () => {
    it('should clear focus and evade tokens', () => {
      const ship = createTestShip('a', { hasFocus: true, hasEvade: true });
      const result = clearRoundTokens(ship);

      expect(result.hasFocus).toBe(false);
      expect(result.hasEvade).toBe(false);
    });

    it('should preserve target lock', () => {
      const ship = createTestShip('a', { hasTargetLock: 'target_id' });
      const result = clearRoundTokens(ship);

      expect(result.hasTargetLock).toBe('target_id');
    });
  });

  describe('token spending', () => {
    it('spendFocus should remove focus token', () => {
      const ship = createTestShip('a', { hasFocus: true });
      const result = spendFocus(ship);

      expect(result.hasFocus).toBe(false);
    });

    it('spendEvade should remove evade token', () => {
      const ship = createTestShip('a', { hasEvade: true });
      const result = spendEvade(ship);

      expect(result.hasEvade).toBe(false);
    });

    it('spendTargetLock should remove target lock', () => {
      const ship = createTestShip('a', { hasTargetLock: 'target_id' });
      const result = spendTargetLock(ship);

      expect(result.hasTargetLock).toBeNull();
    });
  });

  describe('canCoordinate', () => {
    it('should allow coordinating same faction ship in range', () => {
      const coordinator = createTestShip('a', { x: 100, y: 100, faction: 'terran_hegemony' });
      const target = createTestShip('b', { x: 150, y: 100, faction: 'terran_hegemony' });

      expect(canCoordinate(coordinator, target)).toBe(true);
    });

    it('should not allow coordinating enemy ship', () => {
      const coordinator = createTestShip('a', { faction: 'terran_hegemony' });
      const target = createTestShip('b', { faction: 'free_confederation' });

      expect(canCoordinate(coordinator, target)).toBe(false);
    });

    it('should not allow coordinating self', () => {
      const ship = createTestShip('a');

      expect(canCoordinate(ship, ship)).toBe(false);
    });

    it('should not allow coordinating out of range ship', () => {
      const coordinator = createTestShip('a', { x: 0, y: 0 });
      const target = createTestShip('b', { x: 500, y: 500 });

      expect(canCoordinate(coordinator, target, 200)).toBe(false);
    });
  });

  describe('getCoordinateableShips', () => {
    it('should return only coordinateable ships', () => {
      const coordinator = createTestShip('a', { x: 100, y: 100, faction: 'terran_hegemony' });
      const ally1 = createTestShip('b', { x: 150, y: 100, faction: 'terran_hegemony' });
      const ally2 = createTestShip('c', { x: 200, y: 100, faction: 'terran_hegemony' });
      const enemy = createTestShip('d', { x: 120, y: 100, faction: 'free_confederation' });
      const farAlly = createTestShip('e', { x: 500, y: 500, faction: 'terran_hegemony' });

      const ships = [coordinator, ally1, ally2, enemy, farAlly];
      const coordinateable = getCoordinateableShips(coordinator, ships, 200);

      expect(coordinateable.length).toBe(2);
      expect(coordinateable.map((s) => s.id)).toContain('b');
      expect(coordinateable.map((s) => s.id)).toContain('c');
    });
  });

  describe('canJam', () => {
    it('should allow jamming enemy ship in range', () => {
      const jammer = createTestShip('a', { x: 100, y: 100, faction: 'terran_hegemony' });
      const target = createTestShip('b', { x: 150, y: 100, faction: 'free_confederation' });

      expect(canJam(jammer, target, 150)).toBe(true);
    });

    it('should not allow jamming ally', () => {
      const jammer = createTestShip('a', { faction: 'terran_hegemony' });
      const target = createTestShip('b', { faction: 'terran_hegemony' });

      expect(canJam(jammer, target)).toBe(false);
    });

    it('should not allow jamming out of range', () => {
      const jammer = createTestShip('a', { x: 0, y: 0 });
      const target = createTestShip('b', { x: 300, y: 300, faction: 'free_confederation' });

      expect(canJam(jammer, target, 150)).toBe(false);
    });
  });

  describe('executeJam', () => {
    it('should remove focus token first', () => {
      const jammer = createTestShip('a');
      const target = createTestShip('b', { hasFocus: true, hasEvade: true });

      const result = executeJam(jammer, target);

      expect(result.success).toBe(true);
      expect(result.stateChanges.hasFocus).toBe(false);
      expect(result.stateChanges.hasEvade).toBeUndefined(); // Not affected
    });

    it('should remove evade if no focus', () => {
      const jammer = createTestShip('a');
      const target = createTestShip('b', { hasFocus: false, hasEvade: true });

      const result = executeJam(jammer, target);

      expect(result.success).toBe(true);
      expect(result.stateChanges.hasEvade).toBe(false);
    });

    it('should succeed even with no tokens to remove', () => {
      const jammer = createTestShip('a');
      const target = createTestShip('b', { hasFocus: false, hasEvade: false });

      const result = executeJam(jammer, target);

      expect(result.success).toBe(true);
      expect(result.message).toContain('no tokens');
    });
  });

  describe('executeCoordinate', () => {
    it('should execute coordinate action', () => {
      const coordinator = createTestShip('a');
      const target = createTestShip('b');

      const result = executeCoordinate(coordinator, target, 'focus');

      expect(result.success).toBe(true);
      expect(result.action).toBe('coordinate');
      expect(result.message).toContain('focus');
      expect(result.message).toContain(coordinator.id);
      expect(result.message).toContain(target.id);
    });
  });

  describe('executeRotateArc', () => {
    it('should rotate arc to new direction', () => {
      const ship = createTestShip('a', { mobileArcDirection: 'front' });
      const result = executeRotateArc(ship, 'rear');

      expect(result.success).toBe(true);
      expect(result.action).toBe('rotate_arc');
      expect(result.stateChanges.mobileArcDirection).toBe('rear');
    });

    it('should fail if rotating to same direction', () => {
      const ship = createTestShip('a', { mobileArcDirection: 'front' });
      const result = executeRotateArc(ship, 'front');

      expect(result.success).toBe(false);
      expect(result.message).toContain('already facing');
    });

    it('should rotate to left', () => {
      const ship = createTestShip('a', { mobileArcDirection: 'front' });
      const result = executeRotateArc(ship, 'left');

      expect(result.success).toBe(true);
      expect(result.stateChanges.mobileArcDirection).toBe('left');
    });

    it('should rotate to right', () => {
      const ship = createTestShip('a', { mobileArcDirection: 'front' });
      const result = executeRotateArc(ship, 'right');

      expect(result.success).toBe(true);
      expect(result.stateChanges.mobileArcDirection).toBe('right');
    });
  });

  describe('getArcRotationOptions', () => {
    it('should return all directions except current', () => {
      const ship = createTestShip('a', { mobileArcDirection: 'front' });
      const options = getArcRotationOptions(ship);

      expect(options).toHaveLength(3);
      expect(options).toContain('rear');
      expect(options).toContain('left');
      expect(options).toContain('right');
      expect(options).not.toContain('front');
    });

    it('should exclude rear when facing rear', () => {
      const ship = createTestShip('a', { mobileArcDirection: 'rear' });
      const options = getArcRotationOptions(ship);

      expect(options).not.toContain('rear');
      expect(options).toContain('front');
    });
  });

  describe('executeReload', () => {
    it('should recover one charge and add stress', () => {
      const ship = createTestShip('a', { charges: 1, maxCharges: 3 });
      const result = executeReload(ship);

      expect(result.success).toBe(true);
      expect(result.action).toBe('reload');
      expect(result.stateChanges.charges).toBe(2);
      expect(result.stateChanges.isStressed).toBe(true);
    });

    it('should fail if already at max charges', () => {
      const ship = createTestShip('a', { charges: 3, maxCharges: 3 });
      const result = executeReload(ship);

      expect(result.success).toBe(false);
      expect(result.message).toContain('max charges');
    });

    it('should not exceed max charges', () => {
      const ship = createTestShip('a', { charges: 2, maxCharges: 3 });
      const result = executeReload(ship);

      expect(result.stateChanges.charges).toBe(3);
    });

    it('should work with zero initial charges', () => {
      const ship = createTestShip('a', { charges: 0, maxCharges: 2 });
      const result = executeReload(ship);

      expect(result.success).toBe(true);
      expect(result.stateChanges.charges).toBe(1);
    });
  });

  describe('canReload', () => {
    it('should allow reload when not stressed and not at max', () => {
      const ship = createTestShip('a', { isStressed: false, charges: 1, maxCharges: 3 });
      expect(canReload(ship)).toBe(true);
    });

    it('should deny reload when stressed', () => {
      const ship = createTestShip('a', { isStressed: true, charges: 1, maxCharges: 3 });
      expect(canReload(ship)).toBe(false);
    });

    it('should deny reload when at max charges', () => {
      const ship = createTestShip('a', { isStressed: false, charges: 3, maxCharges: 3 });
      expect(canReload(ship)).toBe(false);
    });

    it('should deny reload when both stressed and at max', () => {
      const ship = createTestShip('a', { isStressed: true, charges: 3, maxCharges: 3 });
      expect(canReload(ship)).toBe(false);
    });
  });
});
