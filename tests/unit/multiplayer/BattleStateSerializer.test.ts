/**
 * Tests for BattleStateSerializer
 *
 * Verifies round-trip fidelity, canonical ordering, coordinate rounding,
 * RNG seed derivation, and boundary conditions (empty map, multiple ships).
 */

import { describe, it, expect } from 'vitest';
import {
  BattleStateSerializer,
  type SerializableShip,
} from '../../../src/multiplayer/BattleStateSerializer';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeShip(overrides: Partial<SerializableShip> = {}): SerializableShip {
  return {
    id: 'ship_0',
    definitionId: 'confed_falcon',
    faction: 'free_confederation',
    owner: 'player',
    x: 100,
    y: 200,
    angle: 45,
    hull: 3,
    maxHull: 4,
    shields: 1,
    maxShields: 2,
    isStressed: false,
    pilotSkill: 4,
    initiative: 4,
    charges: 3,
    maxCharges: 3,
    ...overrides,
  };
}

function mapOf(...ships: SerializableShip[]): Map<string, SerializableShip> {
  const m = new Map<string, SerializableShip>();
  for (const s of ships) m.set(s.id, s);
  return m;
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('BattleStateSerializer', () => {
  const sr = new BattleStateSerializer();

  // ── serialize ──────────────────────────────────────────────────────────────

  describe('serialize', () => {
    it('sets version, turnNumber, and baseSeed correctly', () => {
      const snap = sr.serialize(mapOf(makeShip()), 3, 12345);
      expect(snap.version).toBe(1);
      expect(snap.turnNumber).toBe(3);
      expect(snap.baseSeed).toBe(12345);
    });

    it('preserves all ship identity and stat fields', () => {
      const ship = makeShip({ hull: 2, maxHull: 4, shields: 0, maxShields: 2 });
      const snap = sr.serialize(mapOf(ship), 1, 0);
      const s = snap.ships[0]!;
      expect(s.id).toBe('ship_0');
      expect(s.definitionId).toBe('confed_falcon');
      expect(s.faction).toBe('free_confederation');
      expect(s.owner).toBe('player');
      expect(s.hull).toBe(2);
      expect(s.maxHull).toBe(4);
      expect(s.shields).toBe(0);
      expect(s.maxShields).toBe(2);
      expect(s.pilotSkill).toBe(4);
      expect(s.initiative).toBe(4);
      expect(s.charges).toBe(3);
      expect(s.maxCharges).toBe(3);
      expect(s.isStressed).toBe(false);
    });

    it('rounds floating-point coordinates to whole numbers', () => {
      const ship = makeShip({ x: 100.7, y: 200.3, angle: 44.51 });
      const snap = sr.serialize(mapOf(ship), 1, 0);
      expect(snap.ships[0]!.x).toBe(101);
      expect(snap.ships[0]!.y).toBe(200);
      expect(snap.ships[0]!.angle).toBe(45);
    });

    it('sorts ships by ID regardless of insertion order', () => {
      const a = makeShip({ id: 'z_ship' });
      const b = makeShip({ id: 'a_ship' });
      const snap1 = sr.serialize(mapOf(a, b), 1, 0);
      const snap2 = sr.serialize(mapOf(b, a), 1, 0);
      expect(snap1.ships[0]!.id).toBe('a_ship');
      expect(snap2.ships[0]!.id).toBe('a_ship');
    });

    it('preserves the isStressed flag', () => {
      const snap = sr.serialize(mapOf(makeShip({ isStressed: true })), 1, 0);
      expect(snap.ships[0]!.isStressed).toBe(true);
    });

    it('records capturedAt as a current timestamp', () => {
      const before = Date.now();
      const snap = sr.serialize(mapOf(makeShip()), 1, 0);
      const after = Date.now();
      expect(snap.capturedAt).toBeGreaterThanOrEqual(before);
      expect(snap.capturedAt).toBeLessThanOrEqual(after);
    });

    it('handles an empty ship map', () => {
      const snap = sr.serialize(new Map(), 0, 0);
      expect(snap.ships).toHaveLength(0);
    });

    it('handles multiple ships', () => {
      const ships = mapOf(makeShip({ id: 'a' }), makeShip({ id: 'b' }), makeShip({ id: 'c' }));
      const snap = sr.serialize(ships, 2, 99);
      expect(snap.ships).toHaveLength(3);
    });
  });

  // ── deserialize ───────────────────────────────────────────────────────────

  describe('deserialize', () => {
    it('indexes ships by ID for O(1) lookup', () => {
      const snap = sr.serialize(mapOf(makeShip({ id: 'ship_x' })), 1, 0);
      const m = sr.deserialize(snap);
      expect(m.has('ship_x')).toBe(true);
      expect(m.get('ship_x')!.hull).toBe(3);
    });

    it('round-trips all ship fields correctly', () => {
      const ship = makeShip({ hull: 1, shields: 0, isStressed: true, x: 512, y: 768, angle: 270 });
      const m = sr.deserialize(sr.serialize(mapOf(ship), 5, 77777));
      const s = m.get('ship_0')!;
      expect(s.hull).toBe(1);
      expect(s.shields).toBe(0);
      expect(s.isStressed).toBe(true);
      expect(s.x).toBe(512);
      expect(s.y).toBe(768);
      expect(s.angle).toBe(270);
    });

    it('roundtrips owner for AI ships', () => {
      const ship = makeShip({ id: 'enemy_0', owner: 'ai', faction: 'terran_hegemony' });
      const m = sr.deserialize(sr.serialize(mapOf(ship), 3, 0));
      expect(m.get('enemy_0')!.owner).toBe('ai');
    });

    it('produces a map with the correct number of entries', () => {
      const ships = mapOf(makeShip({ id: 'p1' }), makeShip({ id: 'e1', owner: 'ai' }));
      const m = sr.deserialize(sr.serialize(ships, 1, 0));
      expect(m.size).toBe(2);
    });

    it('returns an empty map for an empty snapshot', () => {
      const m = sr.deserialize(sr.serialize(new Map(), 0, 0));
      expect(m.size).toBe(0);
    });
  });

  // ── computeRngSeed ────────────────────────────────────────────────────────

  describe('computeRngSeed', () => {
    it('is deterministic — same inputs always return the same seed', () => {
      const a = sr.computeRngSeed(12345, 3);
      const b = sr.computeRngSeed(12345, 3);
      expect(a).toBe(b);
    });

    it('produces different seeds for different turn numbers', () => {
      expect(sr.computeRngSeed(12345, 1)).not.toBe(sr.computeRngSeed(12345, 2));
    });

    it('produces different seeds for different base seeds', () => {
      expect(sr.computeRngSeed(1000, 5)).not.toBe(sr.computeRngSeed(2000, 5));
    });

    it('returns a non-negative 32-bit unsigned integer', () => {
      const seed = sr.computeRngSeed(0xffffffff, 0xffff);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    });

    it('returns 0 for (0, 0)', () => {
      expect(sr.computeRngSeed(0, 0)).toBe(0);
    });
  });
});
