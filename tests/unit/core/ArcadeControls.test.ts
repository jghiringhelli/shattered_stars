/**
 * Arcade Controls Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createControlState,
  processCommand,
  updateManeuver,
  updateCooldowns,
  getContinuousMovement,
  canFire,
  canKTurn,
  canBarrelRoll,
  startManeuver,
  type ShipControlState,
} from '../../../src/core/ArcadeControls';
import type { ShipState } from '../../../src/core/types';

function createMockShip(overrides: Partial<ShipState> = {}): ShipState {
  return {
    id: 'test-ship',
    definitionId: 'test-def',
    faction: 'terran_hegemony',
    owner: 'player',
    x: 500,
    y: 500,
    angle: 0,
    hull: 5,
    maxHull: 5,
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

describe('ArcadeControls', () => {
  describe('createControlState', () => {
    it('should create initial control state', () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      expect(control.speed).toBe(3);
      expect(control.minSpeed).toBe(1);
      expect(control.maxSpeed).toBe(5);
      expect(control.currentManeuver).toBeNull();
      expect(control.weaponCooldown).toBe(0);
      expect(control.kturnCooldown).toBe(0);
      expect(control.maneuverProgress).toBe(0);
    });
  });

  describe('processCommand', () => {
    it('should increase speed on thrust_increase', () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = processCommand(ship, control, 'thrust_increase');

      expect(result.speed).toBe(4);
    });

    it('should cap speed at max (5)', () => {
      const ship = createMockShip();
      const control = { ...createControlState(ship), speed: 5 };

      const result = processCommand(ship, control, 'thrust_increase');

      expect(result.speed).toBe(5);
    });

    it('should decrease speed on thrust_decrease', () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = processCommand(ship, control, 'thrust_decrease');

      expect(result.speed).toBe(2);
    });

    it('should not go below minSpeed (1)', () => {
      const ship = createMockShip();
      const control = { ...createControlState(ship), speed: 1 };

      const result = processCommand(ship, control, 'thrust_decrease');

      expect(result.speed).toBe(1);
    });

    it('should start left turn on turn_left', () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = processCommand(ship, control, 'turn_left');

      expect(result.currentManeuver).toBe('turn_left');
      expect(result.maneuverPath.length).toBeGreaterThan(0);
    });

    it('should start right turn on turn_right', () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = processCommand(ship, control, 'turn_right');

      expect(result.currentManeuver).toBe('turn_right');
    });

    it('should start bank_left on bank_left', () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = processCommand(ship, control, 'bank_left');

      expect(result.currentManeuver).toBe('bank_left');
    });

    it('should start kturn when cooldown is ready', () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = processCommand(ship, control, 'kturn');

      expect(result.currentManeuver).toBe('kturn');
      expect(result.kturnCooldown).toBeGreaterThan(0);
    });

    it('should not start kturn when on cooldown', () => {
      const ship = createMockShip();
      const control = { ...createControlState(ship), kturnCooldown: 5000 };

      const result = processCommand(ship, control, 'kturn');

      expect(result.currentManeuver).toBeNull();
    });

    it('should not start maneuver when one is in progress', () => {
      const ship = createMockShip();
      let control = createControlState(ship);
      control = processCommand(ship, control, 'turn_left');

      const result = processCommand(ship, control, 'turn_right');

      expect(result.currentManeuver).toBe('turn_left'); // Still the original
    });

    it('should update weapon cooldown on fire', () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = processCommand(ship, control, 'fire');

      expect(result.weaponCooldown).toBeGreaterThan(0);
    });
  });

  describe('startManeuver', () => {
    it('should not start maneuver if one is already in progress', () => {
      const ship = createMockShip();
      let control = createControlState(ship);
      control = startManeuver(ship, control, 'turn_left');
      control = { ...control, maneuverProgress: 0.5 }; // Partially complete

      const result = startManeuver(ship, control, 'turn_right');

      expect(result.currentManeuver).toBe('turn_left');
    });

    it('should create maneuver path', () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = startManeuver(ship, control, 'turn_left');

      expect(result.maneuverPath.length).toBeGreaterThan(0);
      expect(result.maneuverTarget).not.toBeNull();
    });
  });

  describe('updateManeuver', () => {
    it('should return null position when no maneuver is active', () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      const result = updateManeuver(control, 16);

      expect(result.position).toBeNull();
    });

    it('should progress maneuver over time', () => {
      const ship = createMockShip();
      let control = createControlState(ship);
      control = startManeuver(ship, control, 'turn_left');

      const result = updateManeuver(control, 100);

      expect(result.control.maneuverProgress).toBeGreaterThan(0);
      expect(result.position).not.toBeNull();
    });

    it('should complete maneuver and return target position', () => {
      const ship = createMockShip();
      let control = createControlState(ship);
      control = startManeuver(ship, control, 'turn_left');

      // Update with very long delta to complete
      const result = updateManeuver(control, 5000);

      expect(result.control.currentManeuver).toBeNull();
      expect(result.control.maneuverProgress).toBe(0);
      expect(result.position).not.toBeNull();
    });
  });

  describe('updateCooldowns', () => {
    it('should decrease weapon cooldown', () => {
      const ship = createMockShip();
      const control: ShipControlState = {
        ...createControlState(ship),
        weaponCooldown: 500,
      };

      const result = updateCooldowns(control, 100);

      expect(result.weaponCooldown).toBe(400);
    });

    it('should not go below 0', () => {
      const ship = createMockShip();
      const control: ShipControlState = {
        ...createControlState(ship),
        weaponCooldown: 50,
      };

      const result = updateCooldowns(control, 100);

      expect(result.weaponCooldown).toBe(0);
    });

    it('should decrease kturn cooldown', () => {
      const ship = createMockShip();
      const control: ShipControlState = {
        ...createControlState(ship),
        kturnCooldown: 5000,
      };

      const result = updateCooldowns(control, 1000);

      expect(result.kturnCooldown).toBe(4000);
    });

    it('should decrease barrel roll cooldown', () => {
      const ship = createMockShip();
      const control: ShipControlState = {
        ...createControlState(ship),
        barrelRollCooldown: 2000,
      };

      const result = updateCooldowns(control, 500);

      expect(result.barrelRollCooldown).toBe(1500);
    });
  });

  describe('getContinuousMovement', () => {
    it('should return forward movement based on angle and speed', () => {
      const ship = createMockShip({ angle: 0 }); // Facing up
      const control = { ...createControlState(ship), speed: 3 };

      const movement = getContinuousMovement(ship, control, 1000);

      expect(movement.y).toBeLessThan(ship.y); // Moving up (negative y in Phaser)
      expect(Math.abs(movement.x - ship.x)).toBeLessThan(1); // Almost no x movement
    });

    it('should not move when maneuver is active', () => {
      const ship = createMockShip({ angle: 0 });
      let control = createControlState(ship);
      control = startManeuver(ship, control, 'turn_left');

      const movement = getContinuousMovement(ship, control, 1000);

      expect(movement.x).toBe(ship.x);
      expect(movement.y).toBe(ship.y);
    });

    it('should move faster at higher speeds', () => {
      const ship = createMockShip({ angle: 0 });
      const slowControl = { ...createControlState(ship), speed: 1 };
      const fastControl = { ...createControlState(ship), speed: 5 };

      const slow = getContinuousMovement(ship, slowControl, 1000);
      const fast = getContinuousMovement(ship, fastControl, 1000);

      expect(Math.abs(fast.y - ship.y)).toBeGreaterThan(Math.abs(slow.y - ship.y));
    });

    it('should respect angle direction', () => {
      const ship = createMockShip({ angle: 90 }); // Facing right
      const control = createControlState(ship);

      const movement = getContinuousMovement(ship, control, 1000);

      expect(movement.x).toBeGreaterThan(ship.x); // Moving right
    });
  });

  describe('canFire', () => {
    it('should return true when cooldown is 0', () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      expect(canFire(control)).toBe(true);
    });

    it('should return false when on cooldown', () => {
      const ship = createMockShip();
      const control = { ...createControlState(ship), weaponCooldown: 100 };

      expect(canFire(control)).toBe(false);
    });
  });

  describe('canKTurn', () => {
    it('should return true when cooldown is 0 and no maneuver active', () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      expect(canKTurn(control)).toBe(true);
    });

    it('should return false when on cooldown', () => {
      const ship = createMockShip();
      const control = { ...createControlState(ship), kturnCooldown: 5000 };

      expect(canKTurn(control)).toBe(false);
    });

    it('should return false when maneuver is active', () => {
      const ship = createMockShip();
      let control = createControlState(ship);
      control = startManeuver(ship, control, 'turn_left');

      expect(canKTurn(control)).toBe(false);
    });
  });

  describe('canBarrelRoll', () => {
    it('should return true when cooldown is 0 and no maneuver active', () => {
      const ship = createMockShip();
      const control = createControlState(ship);

      expect(canBarrelRoll(control)).toBe(true);
    });

    it('should return false when on cooldown', () => {
      const ship = createMockShip();
      const control = { ...createControlState(ship), barrelRollCooldown: 2000 };

      expect(canBarrelRoll(control)).toBe(false);
    });
  });
});
