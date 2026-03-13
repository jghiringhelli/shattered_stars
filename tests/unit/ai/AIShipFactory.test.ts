import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAIShip,
  createAISquad,
  createMissionWaves,
  spawnWave,
  resetShipIdCounter,
  type AIShipConfig,
  type AISquadConfig,
} from '../../../src/ai/AIShipFactory';
import { SHIP_DEFINITIONS } from '../../../src/data/ShipDefinitions';

describe('AIShipFactory', () => {
  describe('createAIShip', () => {
    it('should create a ship with correct properties', () => {
      const config: AIShipConfig = {
        shipId: 'terran_viper',
        position: { x: 500, y: 300 },
        angle: 180,
      };

      const ship = createAIShip(config, 'terran_hegemony', 'normal');

      expect(ship).not.toBeNull();
      if (ship) {
        expect(ship.definitionId).toBe('terran_viper');
        expect(ship.faction).toBe('terran_hegemony');
        expect(ship.owner).toBe('ai');
        expect(ship.x).toBe(500);
        expect(ship.y).toBe(300);
        expect(ship.angle).toBe(180);
        expect(ship.hull).toBeGreaterThan(0);
        expect(ship.maxHull).toBeGreaterThan(0);
      }
    });

    it('should apply pilot when specified', () => {
      const config: AIShipConfig = {
        shipId: 'terran_viper',
        pilotId: 'whisper_null',
      };

      const ship = createAIShip(config, 'terran_hegemony', 'normal');

      expect(ship).not.toBeNull();
      // Ship should be created with pilot stats
    });

    it('should apply loadout when specified', () => {
      const config: AIShipConfig = {
        shipId: 'terran_viper',
        loadoutId: 'viper_ace',
      };

      const ship = createAIShip(config, 'terran_hegemony', 'normal');

      expect(ship).not.toBeNull();
      // Ship should have upgraded stats from loadout
    });

    it('should return null for invalid ship ID', () => {
      const config: AIShipConfig = {
        shipId: 'nonexistent_ship',
      };

      const ship = createAIShip(config, 'terran_hegemony', 'normal');
      expect(ship).toBeNull();
    });

    it('should use default position when not specified', () => {
      const config: AIShipConfig = {
        shipId: 'confed_falcon',
      };

      const ship = createAIShip(config, 'free_confederation', 'normal');

      expect(ship).not.toBeNull();
      if (ship) {
        expect(ship.x).toBe(400);
        expect(ship.y).toBe(300);
      }
    });
  });

  describe('createAISquad', () => {
    it('should create squad with provided configs', () => {
      const config: AISquadConfig = {
        faction: 'void_corsairs',
        difficulty: 'normal',
        pointBudget: 200,
        shipConfigs: [
          { shipId: 'corsair_blade', position: { x: 600, y: 200 }, angle: 180 },
          { shipId: 'corsair_marauder', position: { x: 600, y: 300 }, angle: 180 },
        ],
      };

      const ships = createAISquad(config);

      expect(ships.length).toBe(2);
      expect(ships[0]!.definitionId).toBe('corsair_blade');
      expect(ships[1]!.definitionId).toBe('corsair_marauder');
    });

    it('should auto-generate squad when no configs provided', () => {
      const config: AISquadConfig = {
        faction: 'synthetic_collective',
        difficulty: 'normal',
        pointBudget: 150,
      };

      const ships = createAISquad(config);

      expect(ships.length).toBeGreaterThan(0);
      for (const ship of ships) {
        expect(ship.faction).toBe('synthetic_collective');
        expect(ship.owner).toBe('ai');
      }
    });

    it('should respect preferred role', () => {
      const offenseConfig: AISquadConfig = {
        faction: 'ascendant_empire',
        difficulty: 'normal',
        pointBudget: 200,
        preferredRole: 'offense',
      };

      const offenseShips = createAISquad(offenseConfig);
      expect(offenseShips.length).toBeGreaterThan(0);

      const defenseConfig: AISquadConfig = {
        faction: 'ascendant_empire',
        difficulty: 'normal',
        pointBudget: 200,
        preferredRole: 'defense',
      };

      const defenseShips = createAISquad(defenseConfig);
      expect(defenseShips.length).toBeGreaterThan(0);
    });
  });

  describe('createMissionWaves', () => {
    it('should create waves based on mission difficulty', () => {
      const easyWaves = createMissionWaves('terran_hegemony', 'normal', 2);
      expect(easyWaves.length).toBeGreaterThan(0);

      const hardWaves = createMissionWaves('terran_hegemony', 'hard', 8);
      expect(hardWaves.length).toBeGreaterThanOrEqual(easyWaves.length);
    });

    it('should have increasing wave numbers', () => {
      const waves = createMissionWaves('void_corsairs', 'normal', 5);

      for (let i = 0; i < waves.length; i++) {
        expect(waves[i]!.waveNumber).toBe(i + 1);
      }
    });

    it('should have increasing delays', () => {
      const waves = createMissionWaves('free_confederation', 'normal', 6);

      for (let i = 1; i < waves.length; i++) {
        expect(waves[i]!.delay).toBeGreaterThan(waves[i - 1]!.delay);
      }
    });

    it('should include ship configurations', () => {
      const waves = createMissionWaves('synthetic_collective', 'normal', 4);

      for (const wave of waves) {
        expect(wave.ships.length).toBeGreaterThan(0);
        for (const config of wave.ships) {
          expect(config.shipId).toBeDefined();
          expect(config.position).toBeDefined();
        }
      }
    });
  });

  describe('spawnWave', () => {
    it('should spawn ships from wave config', () => {
      const waves = createMissionWaves('terran_hegemony', 'normal', 3);
      const firstWave = waves[0]!;

      const ships = spawnWave(firstWave, 'terran_hegemony', 'normal');

      expect(ships.length).toBe(firstWave.ships.length);
      for (const ship of ships) {
        expect(ship.faction).toBe('terran_hegemony');
        expect(ship.owner).toBe('ai');
      }
    });
  });

  describe('difficulty levels', () => {
    it('should create ships at different difficulty levels', () => {
      const difficulties = ['easy', 'normal', 'hard', 'brutal'] as const;

      for (const difficulty of difficulties) {
        const config: AIShipConfig = {
          shipId: 'confed_falcon',
        };

        const ship = createAIShip(config, 'free_confederation', difficulty);
        expect(ship).not.toBeNull();
      }
    });
  });

  describe('faction coverage', () => {
    it('should create ships for all factions', () => {
      const factions = [
        { id: 'terran_hegemony', ship: 'terran_viper' },
        { id: 'free_confederation', ship: 'confed_falcon' },
        { id: 'synthetic_collective', ship: 'synth_hunter' },
        { id: 'void_corsairs', ship: 'corsair_blade' },
        { id: 'ascendant_empire', ship: 'ascendant_seraph' },
      ] as const;

      for (const { id, ship } of factions) {
        const config: AIShipConfig = { shipId: ship };
        const aiShip = createAIShip(config, id, 'normal');

        expect(aiShip).not.toBeNull();
        if (aiShip) {
          expect(aiShip.faction).toBe(id);
        }
      }
    });
  });

  describe('resetShipIdCounter', () => {
    beforeEach(() => {
      // Restore a known state before each test in this block
      resetShipIdCounter(1000);
    });

    it('should reset the counter so new ships get IDs from the reset point', () => {
      resetShipIdCounter(5000);
      const config: AIShipConfig = { shipId: 'terran_viper' };
      const ship1 = createAIShip(config, 'terran_hegemony', 'normal');
      const ship2 = createAIShip(config, 'terran_hegemony', 'normal');

      expect(ship1).not.toBeNull();
      expect(ship2).not.toBeNull();
      if (ship1 && ship2) {
        expect(ship1.id).toBe('ai_ship_5000');
        expect(ship2.id).toBe('ai_ship_5001');
      }
    });

    it('should default to 1000 when no argument provided', () => {
      resetShipIdCounter();
      const config: AIShipConfig = { shipId: 'terran_viper' };
      const ship = createAIShip(config, 'terran_hegemony', 'normal');

      expect(ship).not.toBeNull();
      if (ship) {
        expect(ship.id).toBe('ai_ship_1000');
      }
    });

    it('should allow setting any positive starting value', () => {
      resetShipIdCounter(42);
      const config: AIShipConfig = { shipId: 'terran_viper' };
      const ship = createAIShip(config, 'terran_hegemony', 'normal');

      expect(ship).not.toBeNull();
      if (ship) {
        expect(ship.id).toBe('ai_ship_42');
      }
    });
  });
});
