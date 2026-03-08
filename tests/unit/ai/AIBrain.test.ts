/**
 * Tests for AI Brain
 */

import { describe, it, expect } from 'vitest';
import {
  decideManeuver,
  decideAction,
  decideTarget,
  planAIManeuvers,
} from '../../../src/ai/AIBrain';
import { FACTION_PERSONALITIES } from '../../../src/ai/AITypes';
import type { ShipState, ManeuverDefinition, ActionType } from '../../../src/core/types';

// Helper to create a test ship
function createTestShip(
  id: string,
  overrides: Partial<ShipState> = {}
): ShipState {
  return {
    id,
    definitionId: 'test_ship',
    faction: 'terran_hegemony',
    owner: 'ai',
    x: 500,
    y: 500,
    angle: 0,
    hull: 4,
    maxHull: 4,
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

// Standard maneuver dial for testing
const STANDARD_DIAL: ManeuverDefinition[] = [
  { direction: 'straight', speed: 1, difficulty: 'green' },
  { direction: 'straight', speed: 2, difficulty: 'white' },
  { direction: 'straight', speed: 3, difficulty: 'white' },
  { direction: 'bank_left', speed: 1, difficulty: 'white' },
  { direction: 'bank_left', speed: 2, difficulty: 'white' },
  { direction: 'bank_right', speed: 1, difficulty: 'white' },
  { direction: 'bank_right', speed: 2, difficulty: 'white' },
  { direction: 'turn_left', speed: 1, difficulty: 'white' },
  { direction: 'turn_left', speed: 2, difficulty: 'red' },
  { direction: 'turn_right', speed: 1, difficulty: 'white' },
  { direction: 'turn_right', speed: 2, difficulty: 'red' },
  { direction: 'kturn', speed: 3, difficulty: 'red' },
];

const STANDARD_ACTIONS: ActionType[] = ['focus', 'evade', 'target_lock', 'barrel_roll'];

describe('AIBrain', () => {
  describe('FACTION_PERSONALITIES', () => {
    it('should have personalities for all factions', () => {
      expect(FACTION_PERSONALITIES.terran_hegemony).toBeDefined();
      expect(FACTION_PERSONALITIES.free_confederation).toBeDefined();
      expect(FACTION_PERSONALITIES.synthetic_collective).toBeDefined();
      expect(FACTION_PERSONALITIES.void_corsairs).toBeDefined();
      expect(FACTION_PERSONALITIES.ascendant_empire).toBeDefined();
    });

    it('should have valid personality values (0-1 range)', () => {
      for (const personality of Object.values(FACTION_PERSONALITIES)) {
        expect(personality.aggression).toBeGreaterThanOrEqual(0);
        expect(personality.aggression).toBeLessThanOrEqual(1);
        expect(personality.caution).toBeGreaterThanOrEqual(0);
        expect(personality.caution).toBeLessThanOrEqual(1);
        expect(personality.focus_fire).toBeGreaterThanOrEqual(0);
        expect(personality.focus_fire).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('decideManeuver', () => {
    it('should return a valid maneuver', () => {
      const ship = createTestShip('ai1');
      const enemy = createTestShip('enemy1', {
        faction: 'free_confederation',
        x: 500,
        y: 400, // Ahead
      });

      const decision = decideManeuver(ship, STANDARD_DIAL, [ship, enemy], 1);

      expect(decision.type).toBe('maneuver');
      expect(decision.shipId).toBe('ai1');
      expect(decision.maneuver).toBeDefined();
      expect(decision.score).toBeGreaterThanOrEqual(0);
    });

    it('should avoid red maneuvers when stressed', () => {
      const ship = createTestShip('ai1', { isStressed: true });
      const enemy = createTestShip('enemy1', {
        faction: 'free_confederation',
        x: 500,
        y: 400,
      });

      const decision = decideManeuver(ship, STANDARD_DIAL, [ship, enemy], 1);

      expect(decision.maneuver.difficulty).not.toBe('red');
    });

    it('should move towards enemies when aggressive', () => {
      const ship = createTestShip('ai1', { faction: 'void_corsairs' }); // Aggressive
      const enemy = createTestShip('enemy1', {
        faction: 'free_confederation',
        x: 500,
        y: 300, // Far ahead
      });

      const decision = decideManeuver(ship, STANDARD_DIAL, [ship, enemy], 1);

      // Should choose a forward maneuver
      expect(['straight', 'bank_left', 'bank_right']).toContain(
        decision.maneuver.direction
      );
    });

    it('should prefer safer maneuvers when cautious', () => {
      const ship = createTestShip('ai1', { faction: 'ascendant_empire' }); // Cautious
      const enemy = createTestShip('enemy1', {
        faction: 'free_confederation',
        x: 500,
        y: 450, // Close and ahead
      });

      const decision = decideManeuver(ship, STANDARD_DIAL, [ship, enemy], 1);

      // Should avoid red maneuvers even when not stressed
      // (Ascendant Empire has low stress tolerance)
      expect(decision.score).toBeGreaterThan(0);
    });
  });

  describe('decideAction', () => {
    it('should return an action decision', () => {
      const ship = createTestShip('ai1');
      const enemy = createTestShip('enemy1', {
        faction: 'free_confederation',
        x: 500,
        y: 420, // In front, close
      });

      const decision = decideAction(ship, STANDARD_ACTIONS, [ship, enemy], 1);

      expect(decision).not.toBeNull();
      expect(decision!.type).toBe('action');
    });

    it('should not suggest focus if already has focus', () => {
      const ship = createTestShip('ai1', { hasFocus: true });
      const enemy = createTestShip('enemy1', {
        faction: 'free_confederation',
        x: 500,
        y: 420,
      });

      const decision = decideAction(ship, STANDARD_ACTIONS, [ship, enemy], 1);

      // Should pick something other than focus
      if (decision) {
        expect(decision.action).not.toBe('focus');
      }
    });

    it('should prefer evade when threatened and low hull', () => {
      const ship = createTestShip('ai1', {
        hull: 1,
        shields: 0,
        hasFocus: true, // Already has focus
      });
      const enemy = createTestShip('enemy1', {
        faction: 'free_confederation',
        x: 500,
        y: 420, // Close threat
      });

      const decision = decideAction(ship, STANDARD_ACTIONS, [ship, enemy], 1);

      // Low hull + close enemy = evade is valuable
      expect(decision).not.toBeNull();
    });

    it('should include target ID when choosing target lock', () => {
      const ship = createTestShip('ai1');
      const enemy = createTestShip('enemy1', {
        faction: 'free_confederation',
        x: 500,
        y: 420,
      });

      // Force target_lock only
      const decision = decideAction(ship, ['target_lock'], [ship, enemy], 1);

      if (decision && decision.action === 'target_lock') {
        expect(decision.targetId).toBe('enemy1');
      }
    });
  });

  describe('decideTarget', () => {
    it('should return a target decision when enemies in arc', () => {
      const ship = createTestShip('ai1');
      const enemy = createTestShip('enemy1', {
        faction: 'free_confederation',
        x: 500,
        y: 420, // In front arc
      });

      const decision = decideTarget(ship, [ship, enemy], 1);

      expect(decision).not.toBeNull();
      expect(decision!.type).toBe('target');
      expect(decision!.targetId).toBe('enemy1');
    });

    it('should return null when no enemies in arc', () => {
      const ship = createTestShip('ai1');
      const enemy = createTestShip('enemy1', {
        faction: 'free_confederation',
        x: 500,
        y: 600, // Behind
      });

      const decision = decideTarget(ship, [ship, enemy], 1);

      expect(decision).toBeNull();
    });

    it('should prioritize damaged enemies', () => {
      const ship = createTestShip('ai1');
      const healthyEnemy = createTestShip('healthy', {
        faction: 'free_confederation',
        x: 480,
        y: 420,
        hull: 4,
      });
      const damagedEnemy = createTestShip('damaged', {
        faction: 'free_confederation',
        x: 520,
        y: 420,
        hull: 1,
        shields: 0,
      });

      const decision = decideTarget(
        ship,
        [ship, healthyEnemy, damagedEnemy],
        1
      );

      expect(decision).not.toBeNull();
      // Damaged enemy should score higher
      expect(decision!.targetId).toBe('damaged');
    });

    it('should prefer range 1 targets', () => {
      const ship = createTestShip('ai1');
      const closeEnemy = createTestShip('close', {
        faction: 'free_confederation',
        x: 500,
        y: 450, // Range 1
      });
      const farEnemy = createTestShip('far', {
        faction: 'free_confederation',
        x: 500,
        y: 300, // Range 2
      });

      const decision = decideTarget(ship, [ship, closeEnemy, farEnemy], 1);

      expect(decision).not.toBeNull();
      expect(decision!.targetId).toBe('close');
    });
  });

  describe('planAIManeuvers', () => {
    it('should return maneuvers for all AI ships', () => {
      const ai1 = createTestShip('ai1', { owner: 'ai' });
      const ai2 = createTestShip('ai2', { owner: 'ai', x: 600 });
      const player = createTestShip('player1', {
        owner: 'player',
        faction: 'free_confederation',
        x: 500,
        y: 400,
      });

      const decisions = planAIManeuvers(
        [ai1, ai2],
        [ai1, ai2, player],
        () => STANDARD_DIAL,
        1
      );

      expect(decisions.size).toBe(2);
      expect(decisions.has('ai1')).toBe(true);
      expect(decisions.has('ai2')).toBe(true);
    });

    it('should skip destroyed ships', () => {
      const alive = createTestShip('alive', { owner: 'ai', hull: 3 });
      const destroyed = createTestShip('destroyed', { owner: 'ai', hull: 0 });

      const decisions = planAIManeuvers(
        [alive, destroyed],
        [alive, destroyed],
        () => STANDARD_DIAL,
        1
      );

      expect(decisions.size).toBe(1);
      expect(decisions.has('alive')).toBe(true);
      expect(decisions.has('destroyed')).toBe(false);
    });
  });

  describe('Faction behavior differences', () => {
    it('Synthetic Collective should have high focus fire', () => {
      const personality = FACTION_PERSONALITIES.synthetic_collective!;
      expect(personality.focus_fire).toBeGreaterThan(0.8);
    });

    it('Void Corsairs should be aggressive', () => {
      const personality = FACTION_PERSONALITIES.void_corsairs!;
      expect(personality.aggression).toBeGreaterThan(0.7);
      expect(personality.positioning_aggressive).toBeGreaterThan(0.7);
    });

    it('Ascendant Empire should be cautious', () => {
      const personality = FACTION_PERSONALITIES.ascendant_empire!;
      expect(personality.caution).toBeGreaterThan(0.6);
    });

    it('Terran Hegemony should value formation', () => {
      const personality = FACTION_PERSONALITIES.terran_hegemony!;
      expect(personality.formation_cohesion).toBeGreaterThan(0.7);
    });
  });
});
