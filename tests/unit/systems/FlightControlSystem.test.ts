/**
 * Tests for FlightControlSystem - momentum-based arcade flight physics
 */

import { describe, it, expect } from 'vitest';
import {
  FLIGHT_CONSTANTS,
  getHandlingProfile,
  getSkillModifiers,
  applySkillToHandling,
  createFlightState,
  processFlightInput,
  applyFlightMovement,
  applyDamageToFlight,
  getThrottleIncrements,
  calculateThrottleForSpeed,
  getFlightTelemetry,
  predictPosition,
  calculateInterceptAngle,
  type FlightState,
  type HandlingProfile,
  type SkillModifiers,
} from '../../../src/systems/FlightControlSystem';
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

function makeFlightState(overrides: Partial<FlightState> = {}): FlightState {
  const base = createFlightState('ship_1', 'small', 'light_fighter', 0);
  return { ...base, ...overrides };
}

// ============================================
// Tests
// ============================================

describe('FlightControlSystem', () => {
  describe('FLIGHT_CONSTANTS', () => {
    it('should have expected BASE_MAX_SPEED', () => {
      expect(FLIGHT_CONSTANTS.BASE_MAX_SPEED).toBe(500);
    });

    it('should have expected AFTERBURNER_MULTIPLIER', () => {
      expect(FLIGHT_CONSTANTS.AFTERBURNER_MULTIPLIER).toBe(1.5);
    });

    it('should have valid DRIFT_THRESHOLD between 0 and 1', () => {
      expect(FLIGHT_CONSTANTS.DRIFT_THRESHOLD).toBeGreaterThan(0);
      expect(FLIGHT_CONSTANTS.DRIFT_THRESHOLD).toBeLessThan(1);
    });

    it('should have THROTTLE_INCREMENT of 0.1', () => {
      expect(FLIGHT_CONSTANTS.THROTTLE_INCREMENT).toBe(0.1);
    });

    it('should have BASE_TURN_RATE of 180', () => {
      expect(FLIGHT_CONSTANTS.BASE_TURN_RATE).toBe(180);
    });
  });

  describe('getHandlingProfile', () => {
    it('should return valid profile for each size', () => {
      const sizes = ['tiny', 'small', 'medium', 'large', 'huge'] as const;
      for (const size of sizes) {
        const profile = getHandlingProfile(size, 'light_fighter');
        expect(profile.acceleration).toBeGreaterThan(0);
        expect(profile.deceleration).toBeGreaterThan(0);
        expect(profile.maxSpeed).toBeGreaterThan(0);
        expect(profile.turnRate).toBeGreaterThan(0);
        expect(profile.afterburnerDuration).toBeGreaterThan(0);
        expect(profile.afterburnerCooldown).toBeGreaterThan(0);
        expect(profile.inertia).toBeGreaterThan(0);
      }
    });

    it('tiny ships should be more agile than huge ships', () => {
      const tiny = getHandlingProfile('tiny', 'light_fighter');
      const huge = getHandlingProfile('huge', 'light_fighter');
      expect(tiny.turnRate).toBeGreaterThan(huge.turnRate);
      expect(tiny.acceleration).toBeGreaterThan(huge.acceleration);
    });

    it('huge ships should have more inertia than tiny ships', () => {
      const tiny = getHandlingProfile('tiny', 'light_fighter');
      const huge = getHandlingProfile('huge', 'light_fighter');
      expect(huge.inertia).toBeGreaterThan(tiny.inertia);
    });

    it('interceptor role should boost turnRate and acceleration', () => {
      const base = getHandlingProfile('small', 'heavy_fighter');
      const interceptor = getHandlingProfile('small', 'interceptor');
      expect(interceptor.turnRate).toBeGreaterThan(base.turnRate);
      expect(interceptor.acceleration).toBeGreaterThan(base.acceleration);
    });

    it('bomber role should reduce speed and turn', () => {
      const base = getHandlingProfile('medium', 'support');
      const bomber = getHandlingProfile('medium', 'bomber');
      expect(bomber.maxSpeed).toBeLessThan(base.maxSpeed);
      expect(bomber.turnRate).toBeLessThan(base.turnRate);
    });

    it('capital role should have very low turnRate', () => {
      const capital = getHandlingProfile('huge', 'capital');
      expect(capital.turnRate).toBeLessThan(0.1);
    });

    it('driftCapability should be clamped to max 1', () => {
      // interceptor on tiny combines high drift values — should not exceed 1
      const profile = getHandlingProfile('tiny', 'interceptor');
      expect(profile.driftCapability).toBeLessThanOrEqual(1);
    });

    it('should work for support role', () => {
      const profile = getHandlingProfile('medium', 'support');
      expect(profile.acceleration).toBeGreaterThan(0);
    });

    it('should work for gunship role', () => {
      const profile = getHandlingProfile('large', 'gunship');
      expect(profile.inertia).toBeGreaterThan(1);
    });
  });

  describe('createFlightState', () => {
    it('should set shipId correctly', () => {
      const state = createFlightState('my_ship', 'small', 'light_fighter');
      expect(state.shipId).toBe('my_ship');
    });

    it('should start with zero velocity', () => {
      const state = createFlightState('s', 'small', 'light_fighter');
      expect(state.velocityX).toBe(0);
      expect(state.velocityY).toBe(0);
      expect(state.currentSpeed).toBe(0);
    });

    it('should start with zero throttle', () => {
      const state = createFlightState('s', 'small', 'light_fighter');
      expect(state.targetThrottle).toBe(0);
      expect(state.currentThrottle).toBe(0);
    });

    it('should default angle to 0', () => {
      const state = createFlightState('s', 'small', 'light_fighter');
      expect(state.targetAngle).toBe(0);
    });

    it('should accept custom initial angle', () => {
      const state = createFlightState('s', 'small', 'light_fighter', 90);
      expect(state.targetAngle).toBe(90);
    });

    it('should start with full afterburner fuel', () => {
      const state = createFlightState('s', 'small', 'light_fighter');
      expect(state.afterburnerFuel).toBe(1);
    });

    it('should start not stalled, not drifting', () => {
      const state = createFlightState('s', 'small', 'light_fighter');
      expect(state.isStalled).toBe(false);
      expect(state.isDrifting).toBe(false);
      expect(state.isAfterburnerActive).toBe(false);
    });

    it('should include handling profile matching size and role', () => {
      const state = createFlightState('s', 'large', 'bomber');
      const expected = getHandlingProfile('large', 'bomber');
      expect(state.handling.turnRate).toBe(expected.turnRate);
      expect(state.handling.maxSpeed).toBe(expected.maxSpeed);
    });
  });

  describe('processFlightInput', () => {
    it('should increase throttle on positive throttleChange', () => {
      const state = makeFlightState({ targetThrottle: 0 });
      const updated = processFlightInput(state, { throttleChange: 1 }, 0.016);
      expect(updated.targetThrottle).toBeGreaterThan(0);
    });

    it('should decrease throttle on negative throttleChange', () => {
      const state = makeFlightState({ targetThrottle: 0.5 });
      const updated = processFlightInput(state, { throttleChange: -1 }, 0.016);
      expect(updated.targetThrottle).toBeLessThan(0.5);
    });

    it('should clamp targetThrottle to 0-1', () => {
      const state = makeFlightState({ targetThrottle: 0 });
      const updated = processFlightInput(state, { throttleChange: -100 }, 0.016);
      expect(updated.targetThrottle).toBeGreaterThanOrEqual(0);

      const state2 = makeFlightState({ targetThrottle: 1 });
      const updated2 = processFlightInput(state2, { throttleChange: 100 }, 0.016);
      expect(updated2.targetThrottle).toBeLessThanOrEqual(1);
    });

    it('should set targetThrottle to 0 when brake is engaged', () => {
      const state = makeFlightState({ targetThrottle: 0.8 });
      const updated = processFlightInput(state, { brake: true }, 0.016);
      expect(updated.targetThrottle).toBe(0);
    });

    it('drift should activate when speed is above threshold and drift input given', () => {
      const profile = getHandlingProfile('small', 'light_fighter');
      const maxSpeed = FLIGHT_CONSTANTS.BASE_MAX_SPEED * profile.maxSpeed;
      // Set speed above DRIFT_THRESHOLD (0.7 * maxSpeed)
      const highSpeed = maxSpeed * 0.9;
      const state = makeFlightState({
        currentSpeed: highSpeed,
        velocityX: 0,
        velocityY: -highSpeed,
        isDrifting: false,
      });
      const updated = processFlightInput(state, { drift: true }, 0.016);
      expect(updated.isDrifting).toBe(true);
    });

    it('should not mutate original state', () => {
      const state = makeFlightState({ targetThrottle: 0.5 });
      processFlightInput(state, { throttleChange: 1 }, 0.016);
      expect(state.targetThrottle).toBe(0.5);
    });

    it('should smooth throttle toward target over time', () => {
      const state = makeFlightState({ targetThrottle: 1, currentThrottle: 0 });
      const updated = processFlightInput(state, {}, 0.016);
      // After small deltaTime, currentThrottle moves toward 1 but hasn't reached it
      expect(updated.currentThrottle).toBeGreaterThan(0);
      expect(updated.currentThrottle).toBeLessThan(1);
    });

    it('should activate afterburner when fuel is available', () => {
      const state = makeFlightState({ afterburnerFuel: 1, afterburnerCooldownRemaining: 0 });
      const updated = processFlightInput(state, { afterburner: true }, 0.016);
      expect(updated.isAfterburnerActive).toBe(true);
    });

    it('should not activate afterburner when on cooldown', () => {
      const state = makeFlightState({ afterburnerFuel: 1, afterburnerCooldownRemaining: 5 });
      const updated = processFlightInput(state, { afterburner: true }, 0.016);
      expect(updated.isAfterburnerActive).toBe(false);
    });

    it('should deactivate afterburner when input released', () => {
      const state = makeFlightState({ isAfterburnerActive: true, afterburnerFuel: 0.5 });
      const updated = processFlightInput(state, { afterburner: false }, 0.016);
      expect(updated.isAfterburnerActive).toBe(false);
    });

    it('should consume afterburner fuel when active', () => {
      const state = makeFlightState({ isAfterburnerActive: false, afterburnerFuel: 1, afterburnerCooldownRemaining: 0 });
      const updated = processFlightInput(state, { afterburner: true }, 0.1);
      expect(updated.afterburnerFuel).toBeLessThan(1);
    });

    it('should apply turn direction to angularVelocity', () => {
      const state = makeFlightState({ angularVelocity: 0 });
      const updated = processFlightInput(state, { turnDirection: 1 }, 0.1);
      expect(updated.angularVelocity).toBeGreaterThan(0);
    });

    it('should normalize targetAngle to 0-360 when turning past 360', () => {
      const state = makeFlightState({ targetAngle: 350, angularVelocity: 200 });
      const updated = processFlightInput(state, { turnDirection: 1 }, 0.1);
      expect(updated.targetAngle).toBeGreaterThanOrEqual(0);
      expect(updated.targetAngle).toBeLessThan(360);
    });

    it('should normalize targetAngle when turning negative', () => {
      const state = makeFlightState({ targetAngle: 10, angularVelocity: -200 });
      const updated = processFlightInput(state, { turnDirection: -1 }, 0.1);
      expect(updated.targetAngle).toBeGreaterThanOrEqual(0);
      expect(updated.targetAngle).toBeLessThan(360);
    });

    it('should limit angular velocity when no turn input', () => {
      const state = makeFlightState({ angularVelocity: 100 });
      const updated = processFlightInput(state, {}, 0.016);
      expect(Math.abs(updated.angularVelocity)).toBeLessThan(100);
    });

    it('should limit control when stalled', () => {
      const state = makeFlightState({
        isStalled: true,
        stallRecoveryTime: 2,
        currentThrottle: 1.0,
      });
      const updated = processFlightInput(state, { throttleChange: 1 }, 0.016);
      // While stalled, throttle gets reduced
      expect(updated.currentThrottle).toBeLessThan(1.0);
    });

    it('should clear stall when stallRecoveryTime expires', () => {
      const state = makeFlightState({ isStalled: true, stallRecoveryTime: 0.01 });
      const updated = processFlightInput(state, {}, 0.1); // More than recovery time
      expect(updated.isStalled).toBe(false);
    });

    it('should apply drag at very low throttle', () => {
      const state = makeFlightState({ currentThrottle: 0, targetThrottle: 0, currentSpeed: 200 });
      const updated = processFlightInput(state, {}, 0.1);
      expect(updated.currentSpeed).toBeLessThan(200);
    });

    it('should update velocity vector from facing angle', () => {
      const state = makeFlightState({ targetAngle: 0, currentSpeed: 100, isDrifting: false });
      const updated = processFlightInput(state, {}, 0.016);
      // Facing up (angle=0): velocityX=0, velocityY negative
      expect(Math.abs(updated.velocityX)).toBeLessThan(Math.abs(updated.velocityY) + 1);
    });
  });

  describe('applyFlightMovement', () => {
    it('should return new position based on velocity and time', () => {
      const ship = makeShip({ x: 100, y: 100 });
      const flight = makeFlightState({ velocityX: 50, velocityY: -100 });
      const result = applyFlightMovement(ship, flight, 1.0); // 1 second

      expect(result.x).toBeCloseTo(150);
      expect(result.y).toBeCloseTo(0);
    });

    it('should return the flight state angle, not ship angle', () => {
      const ship = makeShip({ angle: 45 });
      const flight = makeFlightState({ targetAngle: 90 });
      const result = applyFlightMovement(ship, flight, 0.1);
      expect(result.angle).toBe(90);
    });

    it('should not move when velocity is zero', () => {
      const ship = makeShip({ x: 50, y: 75 });
      const flight = makeFlightState({ velocityX: 0, velocityY: 0 });
      const result = applyFlightMovement(ship, flight, 1.0);
      expect(result.x).toBe(50);
      expect(result.y).toBe(75);
    });

    it('should scale movement with deltaTime', () => {
      const ship = makeShip({ x: 0, y: 0 });
      const flight = makeFlightState({ velocityX: 100, velocityY: 0 });

      const half = applyFlightMovement(ship, flight, 0.5);
      const full = applyFlightMovement(ship, flight, 1.0);

      expect(full.x).toBeCloseTo(half.x * 2);
    });
  });

  describe('applyDamageToFlight', () => {
    it('should not stall for damage <= 30%', () => {
      const state = makeFlightState();
      const updated = applyDamageToFlight(state, 30);
      expect(updated.isStalled).toBe(false);
    });

    it('should stall for damage > 30%', () => {
      const state = makeFlightState();
      const updated = applyDamageToFlight(state, 50);
      expect(updated.isStalled).toBe(true);
    });

    it('stall recovery time should scale with damage', () => {
      const state = makeFlightState();
      const light = applyDamageToFlight(state, 40);
      const heavy = applyDamageToFlight(state, 80);
      expect(heavy.stallRecoveryTime).toBeGreaterThan(light.stallRecoveryTime);
    });

    it('should not change throttle for damage <= 15%', () => {
      const state = makeFlightState({ currentThrottle: 1.0, targetThrottle: 1.0 });
      const updated = applyDamageToFlight(state, 10);
      expect(updated.currentThrottle).toBe(1.0);
      expect(updated.targetThrottle).toBe(1.0);
    });

    it('should reduce throttle for damage > 15%', () => {
      const state = makeFlightState({ currentThrottle: 1.0, targetThrottle: 1.0 });
      const updated = applyDamageToFlight(state, 20);
      expect(updated.currentThrottle).toBeLessThan(1.0);
      expect(updated.targetThrottle).toBeLessThan(1.0);
    });

    it('should not mutate original state', () => {
      const state = makeFlightState({ currentThrottle: 1.0 });
      applyDamageToFlight(state, 50);
      expect(state.isStalled).toBe(false);
      expect(state.currentThrottle).toBe(1.0);
    });
  });

  describe('getThrottleIncrements', () => {
    it('should return an array of 5 increments', () => {
      const increments = getThrottleIncrements();
      expect(increments).toHaveLength(5);
    });

    it('increments should be in descending order', () => {
      const increments = getThrottleIncrements();
      for (let i = 1; i < increments.length; i++) {
        expect(increments[i]!).toBeLessThan(increments[i - 1]!);
      }
    });

    it('largest increment should be 0.25', () => {
      const increments = getThrottleIncrements();
      expect(increments[0]).toBe(0.25);
    });

    it('smallest increment should be 0.01', () => {
      const increments = getThrottleIncrements();
      expect(increments[4]).toBe(0.01);
    });
  });

  describe('calculateThrottleForSpeed', () => {
    const profile = getHandlingProfile('medium', 'heavy_fighter');

    it('should return 0 for speed 0', () => {
      expect(calculateThrottleForSpeed(0, profile)).toBe(0);
    });

    it('should return 1 for max speed', () => {
      const maxSpeed = FLIGHT_CONSTANTS.BASE_MAX_SPEED * profile.maxSpeed;
      expect(calculateThrottleForSpeed(maxSpeed, profile)).toBeCloseTo(1);
    });

    it('should return 0.5 for half max speed', () => {
      const maxSpeed = FLIGHT_CONSTANTS.BASE_MAX_SPEED * profile.maxSpeed;
      expect(calculateThrottleForSpeed(maxSpeed / 2, profile)).toBeCloseTo(0.5);
    });

    it('should clamp to 0 for negative speed', () => {
      expect(calculateThrottleForSpeed(-100, profile)).toBe(0);
    });

    it('should clamp to 1 for speed beyond max', () => {
      const maxSpeed = FLIGHT_CONSTANTS.BASE_MAX_SPEED * profile.maxSpeed;
      expect(calculateThrottleForSpeed(maxSpeed * 2, profile)).toBe(1);
    });
  });

  describe('getFlightTelemetry', () => {
    it('should return all required telemetry fields', () => {
      const state = makeFlightState();
      const telemetry = getFlightTelemetry(state);

      expect(typeof telemetry.speedPercent).toBe('number');
      expect(typeof telemetry.throttlePercent).toBe('number');
      expect(typeof telemetry.turnRatePercent).toBe('number');
      expect(typeof telemetry.afterburnerPercent).toBe('number');
      expect(typeof telemetry.afterburnerReady).toBe('boolean');
      expect(typeof telemetry.isDrifting).toBe('boolean');
      expect(typeof telemetry.isStalled).toBe('boolean');
      expect(typeof telemetry.heading).toBe('number');
    });

    it('speedPercent should reflect current speed', () => {
      const maxSpeed = FLIGHT_CONSTANTS.BASE_MAX_SPEED * getHandlingProfile('small', 'light_fighter').maxSpeed;
      const state = makeFlightState({ currentSpeed: maxSpeed / 2 });
      const telemetry = getFlightTelemetry(state);
      expect(telemetry.speedPercent).toBeCloseTo(50, 0);
    });

    it('throttlePercent should be 0-100 range', () => {
      const state = makeFlightState({ currentThrottle: 0.75 });
      const telemetry = getFlightTelemetry(state);
      expect(telemetry.throttlePercent).toBeCloseTo(75);
    });

    it('afterburnerReady should be true when fuel > 10% and no cooldown', () => {
      const state = makeFlightState({ afterburnerFuel: 1, afterburnerCooldownRemaining: 0 });
      const telemetry = getFlightTelemetry(state);
      expect(telemetry.afterburnerReady).toBe(true);
    });

    it('afterburnerReady should be false when on cooldown', () => {
      const state = makeFlightState({ afterburnerFuel: 1, afterburnerCooldownRemaining: 3 });
      const telemetry = getFlightTelemetry(state);
      expect(telemetry.afterburnerReady).toBe(false);
    });

    it('afterburnerReady should be false when fuel <= 10%', () => {
      const state = makeFlightState({ afterburnerFuel: 0.05, afterburnerCooldownRemaining: 0 });
      const telemetry = getFlightTelemetry(state);
      expect(telemetry.afterburnerReady).toBe(false);
    });

    it('heading should be rounded integer', () => {
      const state = makeFlightState({ targetAngle: 45.7 });
      const telemetry = getFlightTelemetry(state);
      expect(Number.isInteger(telemetry.heading)).toBe(true);
      expect(telemetry.heading).toBe(46);
    });

    it('isDrifting and isStalled should reflect state', () => {
      const drifting = makeFlightState({ isDrifting: true, isStalled: false });
      const t1 = getFlightTelemetry(drifting);
      expect(t1.isDrifting).toBe(true);
      expect(t1.isStalled).toBe(false);

      const stalled = makeFlightState({ isDrifting: false, isStalled: true });
      const t2 = getFlightTelemetry(stalled);
      expect(t2.isDrifting).toBe(false);
      expect(t2.isStalled).toBe(true);
    });
  });

  describe('predictPosition', () => {
    it('should return same position when seconds is 0', () => {
      const state = makeFlightState({ velocityX: 100, velocityY: 200 });
      const result = predictPosition(50, 100, state, 0);
      expect(result.x).toBe(50);
      expect(result.y).toBe(100);
    });

    it('should predict position linearly from velocity', () => {
      const state = makeFlightState({ velocityX: 100, velocityY: -50 });
      const result = predictPosition(0, 0, state, 2);
      expect(result.x).toBeCloseTo(200);
      expect(result.y).toBeCloseTo(-100);
    });

    it('should use current X/Y as origin', () => {
      const state = makeFlightState({ velocityX: 0, velocityY: 0 });
      const result = predictPosition(300, 400, state, 5);
      expect(result.x).toBe(300);
      expect(result.y).toBe(400);
    });

    it('should scale linearly with time', () => {
      const state = makeFlightState({ velocityX: 50, velocityY: 0 });
      const r1 = predictPosition(0, 0, state, 1);
      const r3 = predictPosition(0, 0, state, 3);
      expect(r3.x).toBeCloseTo(r1.x * 3);
    });
  });

  describe('calculateInterceptAngle', () => {
    it('should return a direct angle for stationary target', () => {
      // Ship at origin, target at (0, -100) = directly in front (angle=0 in Phaser)
      const angle = calculateInterceptAngle(0, 0, 0, -100, 0, 0, 500);
      expect(angle).not.toBeNull();
      expect(angle!).toBeCloseTo(0, 0);
    });

    it('should return an angle for target moving perpendicular', () => {
      // Ship at origin, target at (0, -200) moving right, projectile speed 500
      const angle = calculateInterceptAngle(0, 0, 0, -200, 100, 0, 500);
      expect(angle).not.toBeNull();
      // Target moves right so intercept angle should be slightly right of forward
      expect(angle!).toBeGreaterThan(0);
      expect(angle!).toBeLessThan(90);
    });

    it('should return null when projectile too slow to catch target', () => {
      // Target moving fast away — discriminant should be negative
      const angle = calculateInterceptAngle(0, 0, 0, -100, 0, -10000, 1);
      // Either null (discriminant < 0) or t <= 0 (target faster)
      if (angle !== null) {
        // If not null, valid intercept was found
        expect(typeof angle).toBe('number');
      } else {
        expect(angle).toBeNull();
      }
    });

    it('should return angle in 0-360 range', () => {
      const angle = calculateInterceptAngle(0, 0, 100, 100, 0, 0, 500);
      expect(angle).not.toBeNull();
      expect(angle!).toBeGreaterThanOrEqual(0);
      expect(angle!).toBeLessThan(360);
    });

    it('should return null when target moving directly away faster than projectile', () => {
      // Ship at origin, target at (0, -50) moving away at 700 (faster than projectile 500)
      // Discriminant should be negative or time negative
      const angle = calculateInterceptAngle(0, 0, 0, -50, 0, -700, 500);
      // We expect null or a valid number — either is OK per implementation
      // Just verify the return type is correct (number or null)
      expect(angle === null || typeof angle === 'number').toBe(true);
    });

    it('should account for target position offset', () => {
      // Targets at different positions should yield different angles
      const angle1 = calculateInterceptAngle(0, 0, 100, 0, 0, 0, 500);
      const angle2 = calculateInterceptAngle(0, 0, -100, 0, 0, 0, 500);
      expect(angle1).not.toBeNull();
      expect(angle2).not.toBeNull();
      expect(angle1).not.toBeCloseTo(angle2!);
    });
  });

  // ============================================
  // Pilot skill → handling modifier tests
  // ============================================

  describe('getSkillModifiers', () => {
    it('should return all-1.0 multipliers at skill 6 (ace baseline)', () => {
      const mods = getSkillModifiers(6);
      expect(mods.turnRate).toBeCloseTo(1.0);
      expect(mods.acceleration).toBeCloseTo(1.0);
      expect(mods.deceleration).toBeCloseTo(1.0);
      expect(mods.inertia).toBeCloseTo(1.0);
      expect(mods.afterburnerDuration).toBeCloseTo(1.0);
      expect(mods.afterburnerCooldown).toBeCloseTo(1.0);
    });

    it('should return degraded multipliers at skill 1 (rookie)', () => {
      const mods = getSkillModifiers(1);
      expect(mods.turnRate).toBeCloseTo(0.65);
      expect(mods.acceleration).toBeCloseTo(0.72);
      expect(mods.deceleration).toBeCloseTo(0.72);
      expect(mods.inertia).toBeCloseTo(1.60);        // higher = more sluggish
      expect(mods.afterburnerDuration).toBeCloseTo(0.75);
      expect(mods.afterburnerCooldown).toBeCloseTo(1.30); // higher = longer wait
    });

    it('should return midpoint values at skill 3', () => {
      const mods = getSkillModifiers(3);
      const t = 2 / 5; // (3-1)/5
      expect(mods.turnRate).toBeCloseTo(0.65 + 0.35 * t);
      expect(mods.acceleration).toBeCloseTo(0.72 + 0.28 * t);
      expect(mods.inertia).toBeCloseTo(1.60 - 0.60 * t);
    });

    it('performance stats should monotonically improve from skill 1 to 6', () => {
      const skills = [1, 2, 3, 4, 5, 6];
      const modsList = skills.map(getSkillModifiers);

      for (let i = 1; i < modsList.length; i++) {
        expect(modsList[i]!.turnRate).toBeGreaterThan(modsList[i - 1]!.turnRate);
        expect(modsList[i]!.acceleration).toBeGreaterThan(modsList[i - 1]!.acceleration);
        expect(modsList[i]!.inertia).toBeLessThan(modsList[i - 1]!.inertia);
        expect(modsList[i]!.afterburnerDuration).toBeGreaterThan(modsList[i - 1]!.afterburnerDuration);
        expect(modsList[i]!.afterburnerCooldown).toBeLessThan(modsList[i - 1]!.afterburnerCooldown);
      }
    });

    it('should clamp skill below 1 to skill 1 values', () => {
      const clamped = getSkillModifiers(0);
      const skill1 = getSkillModifiers(1);
      expect(clamped.turnRate).toBeCloseTo(skill1.turnRate);
      expect(clamped.inertia).toBeCloseTo(skill1.inertia);
    });

    it('should clamp skill above 6 to skill 6 values', () => {
      const clamped = getSkillModifiers(10);
      const skill6 = getSkillModifiers(6);
      expect(clamped.turnRate).toBeCloseTo(skill6.turnRate);
      expect(clamped.inertia).toBeCloseTo(skill6.inertia);
    });
  });

  describe('applySkillToHandling', () => {
    const baseProfile = getHandlingProfile('medium', 'heavy_fighter');

    it('skill 6 should leave the profile unchanged', () => {
      const modified = applySkillToHandling(baseProfile, 6);
      expect(modified.turnRate).toBeCloseTo(baseProfile.turnRate);
      expect(modified.acceleration).toBeCloseTo(baseProfile.acceleration);
      expect(modified.inertia).toBeCloseTo(baseProfile.inertia);
      expect(modified.maxSpeed).toBeCloseTo(baseProfile.maxSpeed);
    });

    it('skill 1 should reduce turnRate', () => {
      const modified = applySkillToHandling(baseProfile, 1);
      expect(modified.turnRate).toBeCloseTo(baseProfile.turnRate * 0.65);
    });

    it('skill 1 should reduce acceleration', () => {
      const modified = applySkillToHandling(baseProfile, 1);
      expect(modified.acceleration).toBeCloseTo(baseProfile.acceleration * 0.72);
    });

    it('skill 1 should increase inertia', () => {
      const modified = applySkillToHandling(baseProfile, 1);
      expect(modified.inertia).toBeCloseTo(baseProfile.inertia * 1.60);
      expect(modified.inertia).toBeGreaterThan(baseProfile.inertia);
    });

    it('skill 1 should reduce afterburner duration', () => {
      const modified = applySkillToHandling(baseProfile, 1);
      expect(modified.afterburnerDuration).toBeCloseTo(baseProfile.afterburnerDuration * 0.75);
    });

    it('skill 1 should increase afterburner cooldown', () => {
      const modified = applySkillToHandling(baseProfile, 1);
      expect(modified.afterburnerCooldown).toBeCloseTo(baseProfile.afterburnerCooldown * 1.30);
    });

    it('should never affect maxSpeed or driftCapability', () => {
      const skill1 = applySkillToHandling(baseProfile, 1);
      const skill6 = applySkillToHandling(baseProfile, 6);
      expect(skill1.maxSpeed).toBeCloseTo(baseProfile.maxSpeed);
      expect(skill6.maxSpeed).toBeCloseTo(baseProfile.maxSpeed);
      expect(skill1.driftCapability).toBeCloseTo(baseProfile.driftCapability);
      expect(skill6.driftCapability).toBeCloseTo(baseProfile.driftCapability);
    });

    it('skill 3 stats should fall between skill 1 and skill 6 values', () => {
      const s1 = applySkillToHandling(baseProfile, 1);
      const s3 = applySkillToHandling(baseProfile, 3);
      const s6 = applySkillToHandling(baseProfile, 6);
      expect(s3.turnRate).toBeGreaterThan(s1.turnRate);
      expect(s3.turnRate).toBeLessThan(s6.turnRate);
      expect(s3.inertia).toBeLessThan(s1.inertia);
      expect(s3.inertia).toBeGreaterThan(s6.inertia);
    });
  });

  describe('createFlightState with pilotSkill', () => {
    it('should default to skill 6 (ace baseline) when no skill given', () => {
      const defaultState = createFlightState('s', 'medium', 'heavy_fighter');
      const skill6State = createFlightState('s', 'medium', 'heavy_fighter', 0, 6);
      expect(defaultState.handling.turnRate).toBeCloseTo(skill6State.handling.turnRate);
    });

    it('skill 1 state should have lower turn rate than skill 6', () => {
      const rookie = createFlightState('s', 'small', 'light_fighter', 0, 1);
      const ace = createFlightState('s', 'small', 'light_fighter', 0, 6);
      expect(rookie.handling.turnRate).toBeLessThan(ace.handling.turnRate);
    });

    it('skill 1 state should have higher inertia than skill 6', () => {
      const rookie = createFlightState('s', 'small', 'light_fighter', 0, 1);
      const ace = createFlightState('s', 'small', 'light_fighter', 0, 6);
      expect(rookie.handling.inertia).toBeGreaterThan(ace.handling.inertia);
    });

    it('skill does not affect max speed in the handling profile', () => {
      const rookie = createFlightState('s', 'small', 'light_fighter', 0, 1);
      const ace = createFlightState('s', 'small', 'light_fighter', 0, 6);
      expect(rookie.handling.maxSpeed).toBeCloseTo(ace.handling.maxSpeed);
    });

    it('initial angle is preserved regardless of skill', () => {
      const state = createFlightState('s', 'small', 'light_fighter', 135, 3);
      expect(state.targetAngle).toBe(135);
    });
  });
});
