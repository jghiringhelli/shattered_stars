/**
 * Tests for TurretSystem - rotatable turret weapons
 */

import { describe, it, expect } from 'vitest';
import {
  TURRET_DEFINITIONS,
  createTurretState,
  getTurretArcRange,
  isTargetInTurretArc,
  canTurretFire,
  rotateTurret,
  autoRotateTurretToTarget,
  getTurretRotationOptions,
  fireTurret,
  resetTurretForRound,
  markTurretFired,
  calculateOptimalTurretFacing,
  type TurretState,
} from '../../../src/systems/TurretSystem';
import type { ShipState } from '../../../src/core/types';

// ============================================
// Helpers
// ============================================

function makeShip(overrides: Partial<ShipState> = {}): ShipState {
  return {
    id: 'ship_1',
    definitionId: 'terran_viper',
    faction: 'terran_hegemony',
    owner: 'player',
    x: 0,
    y: 0,
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
    mobileArcDirection: 'front',
    charges: 0,
    maxCharges: 0,
    ...overrides,
  };
}

function makeTurret(overrides: Partial<TurretState> = {}): TurretState {
  return {
    definitionId: 'light_turret',
    facing: 0,
    isDisabled: false,
    hasFired: false,
    ...overrides,
  };
}

function makeSeededRng(values: number[]) {
  let i = 0;
  return {
    next: () => values[i++ % values.length] ?? 0.5,
    seed: 0,
    state: () => ({ position: i }),
    restore: (_s: unknown) => {},
  };
}

// ============================================
// Tests
// ============================================

describe('TurretSystem', () => {
  describe('TURRET_DEFINITIONS', () => {
    it('should define multiple turret types', () => {
      const defs = Object.values(TURRET_DEFINITIONS);
      expect(defs.length).toBeGreaterThan(3);
    });

    it('should have single, double and full arc types', () => {
      const arcTypes = new Set(Object.values(TURRET_DEFINITIONS).map(d => d.arcType));
      expect(arcTypes.has('single')).toBe(true);
      expect(arcTypes.has('double')).toBe(true);
      expect(arcTypes.has('full')).toBe(true);
    });

    it('full arc turrets should have arcSize 360', () => {
      const fullTurrets = Object.values(TURRET_DEFINITIONS).filter(d => d.arcType === 'full');
      for (const turret of fullTurrets) {
        expect(turret.arcSize).toBe(360);
      }
    });
  });

  describe('createTurretState', () => {
    it('should create turret state with default values', () => {
      const state = createTurretState('light_turret');

      expect(state.definitionId).toBe('light_turret');
      expect(state.facing).toBe(0);
      expect(state.isDisabled).toBe(false);
      expect(state.hasFired).toBe(false);
    });
  });

  describe('getTurretArcRange', () => {
    const singleDef = TURRET_DEFINITIONS['light_turret']!;
    const fullDef = TURRET_DEFINITIONS['agile_gunner']!;

    it('should return full 360° for full arc turret', () => {
      const turret = makeTurret({ definitionId: 'agile_gunner' });
      const range = getTurretArcRange(0, turret, fullDef);
      expect(range.start).toBe(0);
      expect(range.end).toBe(360);
    });

    it('should calculate arc center from ship angle + turret facing', () => {
      const turret = makeTurret({ facing: 0 });
      const range = getTurretArcRange(45, turret, singleDef);

      // Arc center should be at 45° (ship angle=45, turret facing=0)
      // Half arc = 45°, so start = 0°, end = 90°
      expect(range.start).toBeLessThan(range.end); // Should be a valid range
    });

    it('should handle zero ship angle with front-facing turret', () => {
      const turret = makeTurret({ facing: 0 });
      const range = getTurretArcRange(0, turret, singleDef);

      // arcCenter = 0, halfArc = 45
      // start = (0 - 45 + 360) % 360 = 315, end = (0 + 45) % 360 = 45
      expect(range.start).toBe(315);
      expect(range.end).toBe(45);
    });
  });

  describe('isTargetInTurretArc', () => {
    const singleDef = TURRET_DEFINITIONS['light_turret']!; // 90° single arc
    const fullDef = TURRET_DEFINITIONS['agile_gunner']!; // 360°

    it('should always return true for full arc turret', () => {
      const ship = makeShip({ x: 0, y: 0, angle: 0 });
      const target = makeShip({ id: 'target', x: 100, y: 100 }); // behind and to the right
      const turret = makeTurret({ definitionId: 'agile_gunner' });

      expect(isTargetInTurretArc(ship, target, turret, fullDef)).toBe(true);
    });

    it('should return true for target directly in front arc', () => {
      const ship = makeShip({ x: 0, y: 0, angle: 0 });
      const target = makeShip({ id: 'target', x: 0, y: -50 }); // directly in front
      const turret = makeTurret({ facing: 0 });

      expect(isTargetInTurretArc(ship, target, turret, singleDef)).toBe(true);
    });

    it('should return false for target behind when turret faces front', () => {
      const ship = makeShip({ x: 0, y: 0, angle: 0 });
      const target = makeShip({ id: 'target', x: 0, y: 100 }); // directly behind
      const turret = makeTurret({ facing: 0 });

      expect(isTargetInTurretArc(ship, target, turret, singleDef)).toBe(false);
    });

    it('should return true for target in rotated turret arc', () => {
      const ship = makeShip({ x: 0, y: 0, angle: 0 });
      const target = makeShip({ id: 'target', x: 0, y: 100 }); // directly behind
      const turret = makeTurret({ facing: 180 }); // turret facing rear

      expect(isTargetInTurretArc(ship, target, turret, singleDef)).toBe(true);
    });

    it('double turret should cover both front and back', () => {
      const dorsalDef = TURRET_DEFINITIONS['dorsal_turret']!;
      const ship = makeShip({ x: 0, y: 0, angle: 0 });
      const frontTarget = makeShip({ id: 'front', x: 0, y: -50 });
      const rear = makeShip({ id: 'rear', x: 0, y: 50 });
      const turret = makeTurret({ definitionId: 'dorsal_turret', facing: 0 });

      // dorsal_turret has arcSize 180, so halfArc = 90
      // Primary arc (front). Target in front should be covered.
      expect(isTargetInTurretArc(ship, frontTarget, turret, dorsalDef)).toBe(true);
      // Opposite arc (back) at 180°. Target in back should also be covered.
      expect(isTargetInTurretArc(ship, rear, turret, dorsalDef)).toBe(true);
    });
  });

  describe('canTurretFire', () => {
    const ship = makeShip({ x: 0, y: 0, angle: 0, hasTargetLock: null });
    const frontTarget = makeShip({ id: 'target', x: 0, y: -50 }); // range 1, in front arc
    const singleDef = TURRET_DEFINITIONS['light_turret']!;
    const turret = makeTurret();

    it('should allow firing at valid target in arc and range', () => {
      const result = canTurretFire(ship, frontTarget, turret, singleDef);
      expect(result.valid).toBe(true);
    });

    it('should reject when turret is disabled', () => {
      const disabledTurret = makeTurret({ isDisabled: true });
      const result = canTurretFire(ship, frontTarget, disabledTurret, singleDef);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('disabled');
    });

    it('should reject when turret has already fired', () => {
      const firedTurret = makeTurret({ hasFired: true });
      const result = canTurretFire(ship, frontTarget, firedTurret, singleDef);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('fired');
    });

    it('should reject when target is out of range', () => {
      const farTarget = makeShip({ id: 'far', x: 0, y: -400 }); // > 300 units = out of range
      const result = canTurretFire(ship, farTarget, turret, singleDef);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('range');
    });

    it('should reject when target is below minimum range', () => {
      const heavyLaserDef = TURRET_DEFINITIONS['heavy_laser_turret']!; // min range 2
      const closeTarget = makeShip({ id: 'close', x: 0, y: -50 }); // range 1
      const result = canTurretFire(ship, closeTarget, turret, heavyLaserDef);
      expect(result.valid).toBe(false);
    });

    it('should reject when target is above maximum range', () => {
      const singleRangeDef = TURRET_DEFINITIONS['light_turret']!; // max range 2
      const farTarget = makeShip({ id: 'far', x: 0, y: -250 }); // range 3
      const result = canTurretFire(ship, farTarget, turret, singleRangeDef);
      expect(result.valid).toBe(false);
    });

    it('should reject when target not in arc', () => {
      const sideTarget = makeShip({ id: 'side', x: 0, y: 50 }); // behind, not in front arc
      const result = canTurretFire(ship, sideTarget, turret, singleDef);
      expect(result.valid).toBe(false);
    });

    it('should reject when target lock required but missing', () => {
      const blasterDef = TURRET_DEFINITIONS['blaster_turret']!;
      const shipNoLock = makeShip({ hasTargetLock: null });
      const result = canTurretFire(shipNoLock, frontTarget, turret, blasterDef);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('target lock');
    });

    it('should accept when target lock required and present', () => {
      const blasterDef = TURRET_DEFINITIONS['blaster_turret']!;
      const shipWithLock = makeShip({ hasTargetLock: 'target' });
      const result = canTurretFire(shipWithLock, frontTarget, turret, blasterDef);
      expect(result.valid).toBe(true);
    });
  });

  describe('rotateTurret', () => {
    it('should set new facing', () => {
      const turret = makeTurret({ facing: 0 });
      const rotated = rotateTurret(turret, 90);
      expect(rotated.facing).toBe(90);
    });

    it('should normalize to 0-360', () => {
      const turret = makeTurret({ facing: 0 });
      const rotated = rotateTurret(turret, 450);
      expect(rotated.facing).toBe(90);
    });

    it('should handle negative angles', () => {
      const turret = makeTurret({ facing: 90 });
      const rotated = rotateTurret(turret, -90);
      expect(rotated.facing).toBe(270);
    });

    it('should not mutate original turret', () => {
      const turret = makeTurret({ facing: 0 });
      rotateTurret(turret, 90);
      expect(turret.facing).toBe(0);
    });
  });

  describe('autoRotateTurretToTarget', () => {
    const fullDef = TURRET_DEFINITIONS['agile_gunner']!; // 360°
    const singleDef = TURRET_DEFINITIONS['light_turret']!;

    it('should not rotate full arc turret', () => {
      const ship = makeShip({ x: 0, y: 0, angle: 0 });
      const target = makeShip({ id: 'target', x: 100, y: 0 });
      const turret = makeTurret({ facing: 0 });

      const rotated = autoRotateTurretToTarget(ship, target, turret, fullDef);
      expect(rotated.facing).toBe(0); // Unchanged
    });

    it('should rotate single arc turret toward target', () => {
      const ship = makeShip({ x: 0, y: 0, angle: 0 });
      const target = makeShip({ id: 'target', x: 100, y: 0 }); // Right of ship
      const turret = makeTurret({ facing: 0 });

      const rotated = autoRotateTurretToTarget(ship, target, turret, singleDef);
      // Target is to the right (90° in Phaser convention), so turret should face right (90°)
      expect(rotated.facing).toBe(90);
    });

    it('should rotate toward target behind ship', () => {
      const ship = makeShip({ x: 0, y: 0, angle: 0 });
      const target = makeShip({ id: 'target', x: 0, y: 100 }); // Behind ship
      const turret = makeTurret({ facing: 0 });

      const rotated = autoRotateTurretToTarget(ship, target, turret, singleDef);
      expect(rotated.facing).toBe(180);
    });

    it('single-arc turret should face non-cardinal target angle without snapping', () => {
      // Target at 45° (northeast diagonal) — old code snapped to 0°, new code sets 45°
      const ship = makeShip({ x: 0, y: 0, angle: 0 });
      const target = makeShip({ id: 'target', x: 100, y: -100 }); // NE diagonal
      const turret = makeTurret({ facing: 0 });

      const rotated = autoRotateTurretToTarget(ship, target, turret, singleDef);
      // Angle from ship to NE target in Phaser convention: atan2(100, -(-100)) = atan2(100,100) = 45°
      expect(rotated.facing).toBeCloseTo(45, 0);
    });

    it('single-arc turret should face 135° target without snapping', () => {
      const ship = makeShip({ x: 0, y: 0, angle: 0 });
      const target = makeShip({ id: 'target', x: 100, y: 100 }); // SE diagonal
      const turret = makeTurret({ facing: 0 });

      const rotated = autoRotateTurretToTarget(ship, target, turret, singleDef);
      expect(rotated.facing).toBeCloseTo(135, 0);
    });

    it('double-arc turret should still snap to 90° increments', () => {
      const doubleDef = TURRET_DEFINITIONS['dorsal_turret']!;
      const ship = makeShip({ x: 0, y: 0, angle: 0 });
      const target = makeShip({ id: 'target', x: 100, y: -100 }); // NE, exact 45°
      const turret = makeTurret({ definitionId: 'dorsal_turret', facing: 0 });

      const rotated = autoRotateTurretToTarget(ship, target, turret, doubleDef);
      // 45° snaps to nearest 90° increment (either 0 or 90)
      expect([0, 90]).toContain(rotated.facing % 360);
    });

  }); // end describe('autoRotateTurretToTarget')

  describe('getTurretRotationOptions', () => {
    const singleDef = TURRET_DEFINITIONS['light_turret']!;
    const fullDef = TURRET_DEFINITIONS['agile_gunner']!;

    it('should return empty array for full arc turret', () => {
      const turret = makeTurret({ definitionId: 'agile_gunner', facing: 0 });
      const options = getTurretRotationOptions(turret, fullDef);
      expect(options).toHaveLength(0);
    });

    it('should return 3 positions when at one of 4 standard positions', () => {
      const turret = makeTurret({ facing: 0 }); // Facing front
      const options = getTurretRotationOptions(turret, singleDef);
      expect(options).toHaveLength(3); // Can rotate to 90, 180, 270
      expect(options).toContain(90);
      expect(options).toContain(180);
      expect(options).toContain(270);
    });

    it('should not include current facing in options', () => {
      const turret = makeTurret({ facing: 90 });
      const options = getTurretRotationOptions(turret, singleDef);
      expect(options).not.toContain(90);
    });
  });

  describe('fireTurret', () => {
    const ship = makeShip({ x: 0, y: 0 });
    const target = makeShip({ id: 'target', x: 0, y: -50 }); // Range 1 target
    const singleDef = TURRET_DEFINITIONS['light_turret']!;
    const turret = makeTurret();

    it('should return fire result structure', () => {
      const rng = makeSeededRng([0.3]);
      const result = fireTurret(ship, target, turret, singleDef, rng);

      expect(typeof result.success).toBe('boolean');
      expect(typeof result.hits).toBe('number');
      expect(typeof result.crits).toBe('number');
      expect(typeof result.message).toBe('string');
    });

    it('should hit on rolls 0.125-0.5', () => {
      const rng = makeSeededRng([0.3]); // Always hit
      const result = fireTurret(ship, target, turret, singleDef, rng);
      expect(result.hits).toBeGreaterThan(0);
      expect(result.success).toBe(true);
    });

    it('should crit on rolls < 0.125', () => {
      const rng = makeSeededRng([0.05]); // Always crit
      const result = fireTurret(ship, target, turret, singleDef, rng);
      expect(result.crits).toBeGreaterThan(0);
    });

    it('should miss on rolls >= 0.5', () => {
      const rng = makeSeededRng([0.75]); // Always miss
      const result = fireTurret(ship, target, turret, singleDef, rng);
      expect(result.hits).toBe(0);
      expect(result.crits).toBe(0);
      expect(result.success).toBe(false);
    });

    it('should add bonus dice at range 1', () => {
      const singleDef = TURRET_DEFINITIONS['light_turret']!; // Has bonusAtRange1: 1
      const baseAttackDice = singleDef.attackDice;
      const expectedDice = baseAttackDice + singleDef.bonusAtRange1; // 2 + 1 = 3

      // With fixed RNG, we can count how many dice were rolled
      let rollCount = 0;
      const countingRng = {
        next: () => { rollCount++; return 0.3; }, // always hit
        seed: 0,
        state: () => ({ position: rollCount }),
        restore: (_s: unknown) => {},
      };

      fireTurret(ship, target, turret, singleDef, countingRng);
      expect(rollCount).toBe(expectedDice); // Should roll base + bonus dice
    });

    it('should apply ion tokens for ion cannon turret', () => {
      const ionDef = TURRET_DEFINITIONS['ion_cannon_turret']!;
      const rng = makeSeededRng([0.3]); // hit
      const result = fireTurret(ship, target, turret, ionDef, rng);

      if (result.success) {
        expect(result.ionTokens).toBeGreaterThan(0);
      }
    });

    it('should have 0 ion tokens for non-ion turret', () => {
      const rng = makeSeededRng([0.3]);
      const result = fireTurret(ship, target, turret, singleDef, rng);
      expect(result.ionTokens).toBe(0);
    });
  });

  describe('resetTurretForRound', () => {
    it('should reset hasFired to false', () => {
      const turret = makeTurret({ hasFired: true });
      const reset = resetTurretForRound(turret);
      expect(reset.hasFired).toBe(false);
    });

    it('should preserve other turret properties', () => {
      const turret = makeTurret({ hasFired: true, facing: 90, isDisabled: true });
      const reset = resetTurretForRound(turret);
      expect(reset.facing).toBe(90);
      expect(reset.isDisabled).toBe(true);
    });

    it('should not mutate original', () => {
      const turret = makeTurret({ hasFired: true });
      resetTurretForRound(turret);
      expect(turret.hasFired).toBe(true);
    });
  });

  describe('markTurretFired', () => {
    it('should set hasFired to true', () => {
      const turret = makeTurret({ hasFired: false });
      const fired = markTurretFired(turret);
      expect(fired.hasFired).toBe(true);
    });

    it('should not mutate original', () => {
      const turret = makeTurret({ hasFired: false });
      markTurretFired(turret);
      expect(turret.hasFired).toBe(false);
    });
  });

  describe('calculateOptimalTurretFacing', () => {
    const singleDef = TURRET_DEFINITIONS['light_turret']!;
    const fullDef = TURRET_DEFINITIONS['agile_gunner']!;

    it('should return 0 for full arc turret', () => {
      const ship = makeShip({ x: 0, y: 0, angle: 0 });
      const enemy = makeShip({ id: 'enemy', x: 100, y: 0 });
      const result = calculateOptimalTurretFacing(ship, [enemy], fullDef);
      expect(result).toBe(0);
    });

    it('should return 0 when no enemies', () => {
      const ship = makeShip();
      const result = calculateOptimalTurretFacing(ship, [], singleDef);
      expect(result).toBe(0);
    });

    it('should choose facing that covers most enemies', () => {
      const ship = makeShip({ x: 0, y: 0, angle: 0 });

      // Two enemies in front, one behind
      const front1 = makeShip({ id: 'e1', x: 10, y: -60 }); // In front
      const front2 = makeShip({ id: 'e2', x: -10, y: -60 }); // In front
      const back = makeShip({ id: 'e3', x: 0, y: 60 }); // Behind

      const facing = calculateOptimalTurretFacing(ship, [front1, front2, back], singleDef);
      // Should face front (0°) to cover 2 enemies
      expect(facing).toBe(0);
    });

    it('should ignore destroyed enemies (hull <= 0)', () => {
      const ship = makeShip({ x: 0, y: 0, angle: 0 });
      const destroyed = makeShip({ id: 'dead', x: 0, y: -60, hull: 0 });
      const alive = makeShip({ id: 'alive', x: 0, y: 60 }); // Behind

      const facing = calculateOptimalTurretFacing(ship, [destroyed, alive], singleDef);
      // Only alive enemy is behind, so should face rear (180°)
      expect(facing).toBe(180);
    });
  });
});
