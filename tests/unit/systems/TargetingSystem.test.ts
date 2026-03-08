/**
 * Tests for TargetingSystem
 */

import { describe, it, expect } from 'vitest';
import {
  isTargetInArc,
  getTargetInfo,
  getValidTargets,
  getClosestTarget,
  getPrioritizedTargets,
  isTargetLockValid,
  getTargetLockableShips,
  isTargetBehind,
  isTargetFlanking,
  isLineOfSightObstructed,
  STANDARD_ARCS,
} from '../../../src/systems/TargetingSystem';
import type { ShipState } from '../../../src/core/types';

// Helper to create a minimal ship state for testing
function createTestShip(
  id: string,
  x: number,
  y: number,
  angle: number,
  faction: 'terran_hegemony' | 'free_confederation' = 'terran_hegemony'
): ShipState {
  return {
    id,
    definitionId: 'test_ship',
    faction,
    owner: 'player',
    x,
    y,
    angle,
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
    charges: 0,
    maxCharges: 0,
  };
}

describe('TargetingSystem', () => {
  describe('STANDARD_ARCS', () => {
    it('should have correct front arc definition', () => {
      expect(STANDARD_ARCS.front.size).toBe(90);
      expect(STANDARD_ARCS.front.offset).toBe(0);
    });

    it('should have correct rear arc definition', () => {
      expect(STANDARD_ARCS.rear.size).toBe(90);
      expect(STANDARD_ARCS.rear.offset).toBe(180);
    });

    it('should have correct bullseye arc definition', () => {
      expect(STANDARD_ARCS.bullseye.size).toBe(20);
      expect(STANDARD_ARCS.bullseye.offset).toBe(0);
    });

    it('should have turret as 360 degree arc', () => {
      expect(STANDARD_ARCS.turret.size).toBe(360);
    });
  });

  describe('isTargetInArc', () => {
    it('should detect target directly ahead in front arc', () => {
      const attacker = createTestShip('a', 100, 100, 0); // Facing up
      const target = createTestShip('b', 100, 50, 0); // Directly ahead (lower Y)

      expect(isTargetInArc(attacker, target, STANDARD_ARCS.front)).toBe(true);
    });

    it('should detect target in front arc at an angle', () => {
      const attacker = createTestShip('a', 100, 100, 0);
      const target = createTestShip('b', 130, 60, 0); // Ahead and to the right

      expect(isTargetInArc(attacker, target, STANDARD_ARCS.front)).toBe(true);
    });

    it('should not detect target behind in front arc', () => {
      const attacker = createTestShip('a', 100, 100, 0);
      const target = createTestShip('b', 100, 150, 0); // Behind (higher Y)

      expect(isTargetInArc(attacker, target, STANDARD_ARCS.front)).toBe(false);
    });

    it('should detect target behind in rear arc', () => {
      const attacker = createTestShip('a', 100, 100, 0);
      const target = createTestShip('b', 100, 150, 0); // Behind

      expect(isTargetInArc(attacker, target, STANDARD_ARCS.rear)).toBe(true);
    });

    it('should detect target to the right in right arc', () => {
      const attacker = createTestShip('a', 100, 100, 0);
      const target = createTestShip('b', 150, 100, 0); // To the right

      expect(isTargetInArc(attacker, target, STANDARD_ARCS.right)).toBe(true);
    });

    it('should detect target to the left in left arc', () => {
      const attacker = createTestShip('a', 100, 100, 0);
      const target = createTestShip('b', 50, 100, 0); // To the left

      expect(isTargetInArc(attacker, target, STANDARD_ARCS.left)).toBe(true);
    });

    it('should handle ship facing different directions', () => {
      const attacker = createTestShip('a', 100, 100, 90); // Facing right
      const target = createTestShip('b', 150, 100, 0); // To the right of origin

      expect(isTargetInArc(attacker, target, STANDARD_ARCS.front)).toBe(true);
    });

    it('should detect target in bullseye when directly ahead', () => {
      const attacker = createTestShip('a', 100, 100, 0);
      const target = createTestShip('b', 100, 50, 0); // Directly ahead

      expect(isTargetInArc(attacker, target, STANDARD_ARCS.bullseye)).toBe(true);
    });

    it('should not detect target in bullseye when off-center', () => {
      const attacker = createTestShip('a', 100, 100, 0);
      const target = createTestShip('b', 130, 50, 0); // Ahead but off to side

      // Bullseye is only 20°, so this should be outside
      expect(isTargetInArc(attacker, target, STANDARD_ARCS.bullseye)).toBe(false);
    });
  });

  describe('getTargetInfo', () => {
    it('should calculate range correctly', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const target = createTestShip('b', 50, 0, 0);

      const info = getTargetInfo(attacker, target);

      expect(info.range).toBe(1);
      expect(info.distance).toBe(50);
    });

    it('should detect front arc status', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const targetAhead = createTestShip('b', 0, -50, 0);
      const targetBehind = createTestShip('c', 0, 50, 0);

      expect(getTargetInfo(attacker, targetAhead).inFrontArc).toBe(true);
      expect(getTargetInfo(attacker, targetBehind).inFrontArc).toBe(false);
    });

    it('should detect rear arc status', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const targetBehind = createTestShip('b', 0, 50, 0);

      expect(getTargetInfo(attacker, targetBehind).inRearArc).toBe(true);
    });

    it('should indicate canAttackPrimary correctly', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const targetInArc = createTestShip('b', 0, -50, 0);
      const targetOutOfArc = createTestShip('c', 0, 50, 0);
      const targetOutOfRange = createTestShip('d', 0, -500, 0);

      expect(getTargetInfo(attacker, targetInArc).canAttackPrimary).toBe(true);
      expect(getTargetInfo(attacker, targetOutOfArc).canAttackPrimary).toBe(false);
      expect(getTargetInfo(attacker, targetOutOfRange).canAttackPrimary).toBe(false);
    });
  });

  describe('getValidTargets', () => {
    it('should exclude self from targets', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const targets = [attacker, createTestShip('b', 0, -50, 0, 'free_confederation')];

      const valid = getValidTargets(attacker, targets);

      expect(valid.length).toBe(1);
      expect(valid[0]?.targetId).toBe('b');
    });

    it('should exclude allies from targets', () => {
      const attacker = createTestShip('a', 0, 0, 0, 'terran_hegemony');
      const ally = createTestShip('b', 0, -50, 0, 'terran_hegemony');
      const enemy = createTestShip('c', 30, -50, 0, 'free_confederation');

      const valid = getValidTargets(attacker, [ally, enemy]);

      expect(valid.length).toBe(1);
      expect(valid[0]?.targetId).toBe('c');
    });

    it('should exclude destroyed ships', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const alive = createTestShip('b', 0, -50, 0, 'free_confederation');
      const destroyed = createTestShip('c', 30, -50, 0, 'free_confederation');
      destroyed.hull = 0;

      const valid = getValidTargets(attacker, [alive, destroyed]);

      expect(valid.length).toBe(1);
      expect(valid[0]?.targetId).toBe('b');
    });

    it('should exclude out-of-range targets', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const inRange = createTestShip('b', 0, -50, 0, 'free_confederation');
      const outOfRange = createTestShip('c', 0, -500, 0, 'free_confederation');

      const valid = getValidTargets(attacker, [inRange, outOfRange]);

      expect(valid.length).toBe(1);
      expect(valid[0]?.targetId).toBe('b');
    });

    it('should exclude out-of-arc targets when requireArc is true', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const inArc = createTestShip('b', 0, -50, 0, 'free_confederation');
      const outOfArc = createTestShip('c', 0, 50, 0, 'free_confederation');

      const validWithArc = getValidTargets(attacker, [inArc, outOfArc], true);
      const validWithoutArc = getValidTargets(attacker, [inArc, outOfArc], false);

      expect(validWithArc.length).toBe(1);
      expect(validWithoutArc.length).toBe(2);
    });
  });

  describe('getClosestTarget', () => {
    it('should return null when no valid targets', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const ally = createTestShip('b', 0, -50, 0, 'terran_hegemony');

      expect(getClosestTarget(attacker, [ally])).toBeNull();
    });

    it('should return the closest valid target', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const close = createTestShip('b', 0, -50, 0, 'free_confederation');
      const far = createTestShip('c', 0, -100, 0, 'free_confederation');

      const closest = getClosestTarget(attacker, [far, close]);

      expect(closest?.targetId).toBe('b');
    });
  });

  describe('getPrioritizedTargets', () => {
    it('should prioritize range 1 targets', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const range1 = createTestShip('b', 0, -50, 0, 'free_confederation');
      const range2 = createTestShip('c', 0, -150, 0, 'free_confederation');
      const range3 = createTestShip('d', 0, -250, 0, 'free_confederation');

      const prioritized = getPrioritizedTargets(attacker, [range3, range1, range2]);

      expect(prioritized[0]?.targetId).toBe('b'); // Range 1 first
      expect(prioritized[1]?.targetId).toBe('c'); // Range 2 second
      expect(prioritized[2]?.targetId).toBe('d'); // Range 3 third
    });

    it('should give bonus to bullseye targets', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      // Both at similar range, but one in bullseye
      const bullseye = createTestShip('b', 0, -80, 0, 'free_confederation');
      const notBullseye = createTestShip('c', 40, -70, 0, 'free_confederation');

      const prioritized = getPrioritizedTargets(attacker, [notBullseye, bullseye]);

      // Bullseye target should be prioritized even if slightly farther
      expect(prioritized[0]?.targetId).toBe('b');
    });
  });

  describe('isTargetLockValid', () => {
    it('should return true for valid lock', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const target = createTestShip('b', 100, 0, 0);

      expect(isTargetLockValid(attacker, target)).toBe(true);
    });

    it('should return false for destroyed targets', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const target = createTestShip('b', 100, 0, 0);
      target.hull = 0;

      expect(isTargetLockValid(attacker, target)).toBe(false);
    });

    it('should return false for out of range targets', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const target = createTestShip('b', 500, 0, 0);

      expect(isTargetLockValid(attacker, target)).toBe(false);
    });
  });

  describe('getTargetLockableShips', () => {
    it('should return enemy ships in range', () => {
      const attacker = createTestShip('a', 0, 0, 0, 'terran_hegemony');
      const enemy1 = createTestShip('b', 50, 0, 0, 'free_confederation');
      const enemy2 = createTestShip('c', 100, 0, 0, 'free_confederation');
      const ally = createTestShip('d', 150, 0, 0, 'terran_hegemony');

      const lockable = getTargetLockableShips(attacker, [enemy1, enemy2, ally]);

      expect(lockable.length).toBe(2);
      expect(lockable.map((s) => s.id)).toContain('b');
      expect(lockable.map((s) => s.id)).toContain('c');
    });
  });

  describe('isTargetBehind', () => {
    it('should return true when target is behind', () => {
      const attacker = createTestShip('a', 100, 100, 0);
      const target = createTestShip('b', 100, 150, 0);

      expect(isTargetBehind(attacker, target)).toBe(true);
    });

    it('should return false when target is ahead', () => {
      const attacker = createTestShip('a', 100, 100, 0);
      const target = createTestShip('b', 100, 50, 0);

      expect(isTargetBehind(attacker, target)).toBe(false);
    });
  });

  describe('isTargetFlanking', () => {
    it('should return true when target is to the side', () => {
      const attacker = createTestShip('a', 100, 100, 0);
      const targetLeft = createTestShip('b', 50, 100, 0);
      const targetRight = createTestShip('c', 150, 100, 0);

      expect(isTargetFlanking(attacker, targetLeft)).toBe(true);
      expect(isTargetFlanking(attacker, targetRight)).toBe(true);
    });

    it('should return false when target is ahead or behind', () => {
      const attacker = createTestShip('a', 100, 100, 0);
      const targetAhead = createTestShip('b', 100, 50, 0);
      const targetBehind = createTestShip('c', 100, 150, 0);

      expect(isTargetFlanking(attacker, targetAhead)).toBe(false);
      expect(isTargetFlanking(attacker, targetBehind)).toBe(false);
    });
  });

  describe('isLineOfSightObstructed', () => {
    it('should return false when no obstacles', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const target = createTestShip('b', 100, 0, 0);

      expect(isLineOfSightObstructed(attacker, target, [])).toBe(false);
    });

    it('should return false when obstacle is not in line', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const target = createTestShip('b', 100, 0, 0);
      const obstacle = { x: 50, y: 50, radius: 10 }; // Off to the side

      expect(isLineOfSightObstructed(attacker, target, [obstacle])).toBe(false);
    });

    it('should return true when obstacle is directly between ships', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const target = createTestShip('b', 100, 0, 0);
      const obstacle = { x: 50, y: 0, radius: 10 }; // Directly in the middle

      expect(isLineOfSightObstructed(attacker, target, [obstacle])).toBe(true);
    });

    it('should return true when line grazes obstacle', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const target = createTestShip('b', 100, 0, 0);
      const obstacle = { x: 50, y: 5, radius: 10 }; // Just barely in the way

      expect(isLineOfSightObstructed(attacker, target, [obstacle])).toBe(true);
    });

    it('should return false when obstacle is past target', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const target = createTestShip('b', 100, 0, 0);
      const obstacle = { x: 150, y: 0, radius: 10 }; // Beyond the target

      expect(isLineOfSightObstructed(attacker, target, [obstacle])).toBe(false);
    });

    it('should return false when obstacle is before attacker', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const target = createTestShip('b', 100, 0, 0);
      const obstacle = { x: -50, y: 0, radius: 10 }; // Behind attacker

      expect(isLineOfSightObstructed(attacker, target, [obstacle])).toBe(false);
    });

    it('should check multiple obstacles', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const target = createTestShip('b', 100, 0, 0);
      const obstacles = [
        { x: 25, y: 50, radius: 5 }, // Not in line
        { x: 50, y: 0, radius: 10 }, // In the way
        { x: 75, y: -50, radius: 5 }, // Not in line
      ];

      expect(isLineOfSightObstructed(attacker, target, obstacles)).toBe(true);
    });

    it('should return false for all obstacles out of line', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const target = createTestShip('b', 100, 0, 0);
      const obstacles = [
        { x: 25, y: 50, radius: 5 },
        { x: 50, y: -50, radius: 5 },
        { x: 75, y: 30, radius: 5 },
      ];

      expect(isLineOfSightObstructed(attacker, target, obstacles)).toBe(false);
    });

    it('should handle ships at same position', () => {
      const attacker = createTestShip('a', 100, 100, 0);
      const target = createTestShip('b', 100, 100, 0); // Same position
      const obstacle = { x: 100, y: 100, radius: 10 };

      // Should return false (no line to obstruct)
      expect(isLineOfSightObstructed(attacker, target, [obstacle])).toBe(false);
    });

    it('should handle diagonal line of sight', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const target = createTestShip('b', 100, 100, 0);
      const obstacleInLine = { x: 50, y: 50, radius: 10 };
      const obstacleOffLine = { x: 50, y: 0, radius: 10 };

      expect(isLineOfSightObstructed(attacker, target, [obstacleInLine])).toBe(true);
      expect(isLineOfSightObstructed(attacker, target, [obstacleOffLine])).toBe(false);
    });

    it('should handle large obstacles', () => {
      const attacker = createTestShip('a', 0, 0, 0);
      const target = createTestShip('b', 100, 0, 0);
      const largeObstacle = { x: 50, y: 30, radius: 40 }; // Large radius

      expect(isLineOfSightObstructed(attacker, target, [largeObstacle])).toBe(true);
    });
  });
});
