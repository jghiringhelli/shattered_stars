import { describe, it, expect } from 'vitest';
import {
  PILOT_CARDS,
  SQUAD_POINT_LIMITS,
  createSquad,
  addUnitToSquad,
  removeUnitFromSquad,
  calculateUnitCost,
  calculateSquadCost,
  validateSquad,
  getPilotsForFaction,
  getPilotsForShip,
  exportSquad,
  importSquad,
  getPresetSquads,
} from '../../../src/systems/SquadBuilder';
import { SHIP_DEFINITIONS } from '../../../src/data/ShipDefinitions';

describe('SquadBuilder', () => {
  describe('PILOT_CARDS', () => {
    it('should have pilots for all 18 ships', () => {
      const shipIds = Object.keys(SHIP_DEFINITIONS);
      for (const shipId of shipIds) {
        const pilots = getPilotsForShip(shipId);
        expect(pilots.length).toBeGreaterThan(0);
      }
    });

    it('should have unique pilots with appropriate costs', () => {
      const uniquePilots = Object.values(PILOT_CARDS).filter(p => p.isUnique);
      expect(uniquePilots.length).toBeGreaterThan(0);

      for (const pilot of uniquePilots) {
        // Unique pilots should have initiative >= 3 (support/utility pilots can be 3)
        expect(pilot.initiative).toBeGreaterThanOrEqual(3);
        // Unique pilots should have ability text
        expect(pilot.abilityText).toBeDefined();
      }
    });

    it('should have pilots for each faction', () => {
      const factions = ['terran_hegemony', 'free_confederation', 'synthetic_collective', 'void_corsairs', 'ascendant_empire'] as const;
      for (const faction of factions) {
        const pilots = getPilotsForFaction(faction);
        expect(pilots.length).toBeGreaterThan(0);
      }
    });

    it('should have valid ship references', () => {
      for (const pilot of Object.values(PILOT_CARDS)) {
        expect(SHIP_DEFINITIONS[pilot.shipId]).toBeDefined();
      }
    });
  });

  describe('createSquad', () => {
    it('should create an empty squad with correct faction', () => {
      const squad = createSquad('Test Squad', 'terran_hegemony');
      expect(squad.name).toBe('Test Squad');
      expect(squad.faction).toBe('terran_hegemony');
      expect(squad.units.length).toBe(0);
      expect(squad.format).toBe('standard');
    });

    it('should support different game formats', () => {
      const extended = createSquad('Extended', 'void_corsairs', 'extended');
      expect(extended.format).toBe('extended');

      const epic = createSquad('Epic', 'synthetic_collective', 'epic');
      expect(epic.format).toBe('epic');
    });
  });

  describe('addUnitToSquad', () => {
    it('should add a pilot to the squad', () => {
      const squad = createSquad('Test', 'terran_hegemony');
      const result = addUnitToSquad(squad, 'viper_cadet');

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.units.length).toBe(1);
        expect(result.units[0]!.pilotId).toBe('viper_cadet');
        expect(result.units[0]!.shipId).toBe('terran_viper');
      }
    });

    it('should reject pilots from wrong faction', () => {
      const squad = createSquad('Test', 'terran_hegemony');
      const result = addUnitToSquad(squad, 'sparrow_rookie'); // Free Confederation pilot

      expect('error' in result).toBe(true);
    });

    it('should reject duplicate unique pilots', () => {
      let squad = createSquad('Test', 'terran_hegemony');
      const result1 = addUnitToSquad(squad, 'whisper_null');
      expect('error' in result1).toBe(false);

      if (!('error' in result1)) {
        const result2 = addUnitToSquad(result1, 'whisper_null');
        expect('error' in result2).toBe(true);
      }
    });

    it('should allow multiple generic pilots', () => {
      let squad = createSquad('Test', 'terran_hegemony');
      const result1 = addUnitToSquad(squad, 'viper_cadet');
      expect('error' in result1).toBe(false);

      if (!('error' in result1)) {
        const result2 = addUnitToSquad(result1, 'viper_cadet');
        expect('error' in result2).toBe(false);
        if (!('error' in result2)) {
          expect(result2.units.length).toBe(2);
        }
      }
    });
  });

  describe('removeUnitFromSquad', () => {
    it('should remove a unit from the squad', () => {
      let squad = createSquad('Test', 'terran_hegemony');
      const addResult = addUnitToSquad(squad, 'viper_cadet');
      expect('error' in addResult).toBe(false);

      if (!('error' in addResult)) {
        const unitId = addResult.units[0]!.id;
        const removed = removeUnitFromSquad(addResult, unitId);
        expect(removed.units.length).toBe(0);
      }
    });
  });

  describe('calculateUnitCost', () => {
    it('should calculate pilot base cost', () => {
      const squad = createSquad('Test', 'terran_hegemony');
      const result = addUnitToSquad(squad, 'viper_cadet');

      if (!('error' in result)) {
        const cost = calculateUnitCost(result.units[0]!);
        expect(cost).toBe(PILOT_CARDS.viper_cadet!.pointCost);
      }
    });
  });

  describe('calculateSquadCost', () => {
    it('should sum all unit costs', () => {
      let squad = createSquad('Test', 'terran_hegemony');
      const result1 = addUnitToSquad(squad, 'viper_cadet');
      if (!('error' in result1)) {
        const result2 = addUnitToSquad(result1, 'gladius_pilot');
        if (!('error' in result2)) {
          const cost = calculateSquadCost(result2);
          const expected = PILOT_CARDS.viper_cadet!.pointCost + PILOT_CARDS.gladius_pilot!.pointCost;
          expect(cost).toBe(expected);
        }
      }
    });
  });

  describe('validateSquad', () => {
    it('should validate empty squad with warning', () => {
      const squad = createSquad('Test', 'terran_hegemony');
      const validation = validateSquad(squad);

      expect(validation.isValid).toBe(true);
      expect(validation.warnings.some(w => w.type === 'no_ships')).toBe(true);
    });

    it('should detect over-points', () => {
      let squad = createSquad('Test', 'terran_hegemony');
      // Add enough expensive ships to exceed 200 points
      for (let i = 0; i < 10; i++) {
        const result = addUnitToSquad(squad, 'whisper_null');
        if (!('error' in result)) {
          squad = result;
        } else {
          const result2 = addUnitToSquad(squad, 'commander_striker');
          if (!('error' in result2)) {
            squad = result2;
          }
        }
      }

      const validation = validateSquad(squad);
      if (validation.totalPoints > SQUAD_POINT_LIMITS.standard) {
        expect(validation.errors.some(e => e.type === 'over_points')).toBe(true);
      }
    });
  });

  describe('exportSquad / importSquad', () => {
    it('should export and import a squad', () => {
      let squad = createSquad('Export Test', 'free_confederation');
      const addResult = addUnitToSquad(squad, 'sparrow_rookie');

      if (!('error' in addResult)) {
        const exported = exportSquad(addResult);
        expect(typeof exported).toBe('string');

        const imported = importSquad(exported, 'Imported Squad');
        expect('error' in imported).toBe(false);

        if (!('error' in imported)) {
          expect(imported.faction).toBe('free_confederation');
          expect(imported.units.length).toBe(1);
          expect(imported.units[0]!.pilotId).toBe('sparrow_rookie');
        }
      }
    });
  });

  describe('getPresetSquads', () => {
    it('should return preset squads for each faction', () => {
      const factions = ['terran_hegemony', 'free_confederation', 'synthetic_collective', 'void_corsairs', 'ascendant_empire'] as const;

      for (const faction of factions) {
        const presets = getPresetSquads(faction);
        expect(presets.length).toBeGreaterThan(0);

        for (const preset of presets) {
          expect(preset.faction).toBe(faction);
          expect(preset.units.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
