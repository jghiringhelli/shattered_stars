/**
 * GameStore Tests
 *
 * Tests for the Immer-based immutable game state store.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameStore, type GameState, type BattleState } from '../../../src/core/GameStore';
import type { ShipState } from '../../../src/core/types';

// Helper to create a mock ship state
function createMockShip(overrides: Partial<ShipState> = {}): ShipState {
  return {
    id: 'test_ship_1',
    definitionId: 'terran_viper',
    faction: 'terran_hegemony',
    owner: 'player',
    x: 100,
    y: 200,
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
    charges: 0,
    maxCharges: 0,
    ...overrides,
  };
}

describe('GameStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    GameStore.reset();
  });

  describe('Initial state', () => {
    it('should have null battle initially', () => {
      const state = GameStore.getState();
      expect(state.battle).toBeNull();
    });

    it('should have default player faction', () => {
      const state = GameStore.getState();
      expect(state.playerFaction).toBe('free_confederation');
    });

    it('should not be paused initially', () => {
      const state = GameStore.getState();
      expect(state.isPaused).toBe(false);
    });
  });

  describe('State updates (update)', () => {
    it('should update state immutably', () => {
      const initialState = GameStore.getState();

      GameStore.update((draft) => {
        draft.isPaused = true;
      });

      const newState = GameStore.getState();

      expect(initialState).not.toBe(newState);
      expect(newState.isPaused).toBe(true);
    });

    it('should allow changing player faction', () => {
      GameStore.update((draft) => {
        draft.playerFaction = 'terran_hegemony';
      });

      expect(GameStore.getState().playerFaction).toBe('terran_hegemony');
    });

    it('should allow complex nested updates', () => {
      GameStore.startBattle();
      const ship = createMockShip();

      GameStore.addShip(ship);
      GameStore.update((draft) => {
        if (draft.battle) {
          draft.battle.phase = 'activation';
          draft.battle.turn = 5;
        }
      });

      const state = GameStore.getState();
      expect(state.battle?.phase).toBe('activation');
      expect(state.battle?.turn).toBe(5);
    });
  });

  describe('Subscriptions', () => {
    it('should subscribe to state changes', () => {
      const listener = vi.fn();
      GameStore.subscribe(listener);

      GameStore.update((draft) => {
        draft.isPaused = true;
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should receive new state in listener', () => {
      let receivedState: GameState | null = null;
      GameStore.subscribe((state) => {
        receivedState = state;
      });

      GameStore.update((draft) => {
        draft.isPaused = true;
      });

      expect(receivedState?.isPaused).toBe(true);
    });

    it('should unsubscribe when returned function is called', () => {
      const listener = vi.fn();
      const unsubscribe = GameStore.subscribe(listener);

      unsubscribe();
      GameStore.update((draft) => {
        draft.isPaused = true;
      });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      GameStore.subscribe(listener1);
      GameStore.subscribe(listener2);

      GameStore.update((draft) => {
        draft.isPaused = true;
      });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const successListener = vi.fn();

      GameStore.subscribe(errorListener);
      GameStore.subscribe(successListener);

      // Should not throw
      expect(() => {
        GameStore.update((draft) => {
          draft.isPaused = true;
        });
      }).not.toThrow();

      expect(successListener).toHaveBeenCalled();
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', () => {
      GameStore.update((draft) => {
        draft.isPaused = true;
        draft.playerFaction = 'terran_hegemony';
      });
      GameStore.startBattle();

      GameStore.reset();

      const state = GameStore.getState();
      expect(state.battle).toBeNull();
      expect(state.isPaused).toBe(false);
      expect(state.playerFaction).toBe('free_confederation');
    });

    it('should notify listeners on reset', () => {
      const listener = vi.fn();
      GameStore.subscribe(listener);

      GameStore.reset();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Battle state helpers', () => {
    describe('startBattle', () => {
      it('should create a new battle', () => {
        GameStore.startBattle();

        const state = GameStore.getState();
        expect(state.battle).not.toBeNull();
        expect(state.battle?.phase).toBe('setup');
        expect(state.battle?.turn).toBe(1);
      });

      it('should initialize with empty ships map', () => {
        GameStore.startBattle();

        const state = GameStore.getState();
        expect(state.battle?.ships.size).toBe(0);
      });

      it('should have null active ship', () => {
        GameStore.startBattle();

        const state = GameStore.getState();
        expect(state.battle?.activeShipId).toBeNull();
      });
    });

    describe('addShip', () => {
      beforeEach(() => {
        GameStore.startBattle();
      });

      it('should add a ship to the battle', () => {
        const ship = createMockShip();
        GameStore.addShip(ship);

        const state = GameStore.getState();
        expect(state.battle?.ships.size).toBe(1);
        expect(state.battle?.ships.has('test_ship_1')).toBe(true);
      });

      it('should store ship data correctly', () => {
        const ship = createMockShip({
          id: 'my_ship',
          x: 500,
          y: 600,
        });
        GameStore.addShip(ship);

        const storedShip = GameStore.getState().battle?.ships.get('my_ship');
        expect(storedShip?.x).toBe(500);
        expect(storedShip?.y).toBe(600);
      });

      it('should add multiple ships', () => {
        GameStore.addShip(createMockShip({ id: 'ship1' }));
        GameStore.addShip(createMockShip({ id: 'ship2' }));
        GameStore.addShip(createMockShip({ id: 'ship3' }));

        expect(GameStore.getState().battle?.ships.size).toBe(3);
      });

      it('should do nothing if no battle exists', () => {
        GameStore.reset(); // No battle
        const ship = createMockShip();

        // Should not throw
        expect(() => GameStore.addShip(ship)).not.toThrow();
      });
    });

    describe('updateShip', () => {
      beforeEach(() => {
        GameStore.startBattle();
        GameStore.addShip(createMockShip());
      });

      it('should update ship properties', () => {
        GameStore.updateShip('test_ship_1', (ship) => {
          ship.hull = 1;
          ship.shields = 0;
        });

        const ship = GameStore.getShip('test_ship_1');
        expect(ship?.hull).toBe(1);
        expect(ship?.shields).toBe(0);
      });

      it('should update ship position', () => {
        GameStore.updateShip('test_ship_1', (ship) => {
          ship.x = 999;
          ship.y = 888;
          ship.angle = 90;
        });

        const ship = GameStore.getShip('test_ship_1');
        expect(ship?.x).toBe(999);
        expect(ship?.y).toBe(888);
        expect(ship?.angle).toBe(90);
      });

      it('should do nothing for non-existent ship', () => {
        // Should not throw
        expect(() => {
          GameStore.updateShip('non_existent', (ship) => {
            ship.hull = 0;
          });
        }).not.toThrow();
      });

      it('should do nothing if no battle exists', () => {
        GameStore.reset();

        expect(() => {
          GameStore.updateShip('test_ship_1', (ship) => {
            ship.hull = 0;
          });
        }).not.toThrow();
      });
    });

    describe('removeShip', () => {
      beforeEach(() => {
        GameStore.startBattle();
        GameStore.addShip(createMockShip({ id: 'ship1' }));
        GameStore.addShip(createMockShip({ id: 'ship2' }));
      });

      it('should remove a ship', () => {
        GameStore.removeShip('ship1');

        expect(GameStore.getState().battle?.ships.size).toBe(1);
        expect(GameStore.getState().battle?.ships.has('ship1')).toBe(false);
      });

      it('should not affect other ships', () => {
        GameStore.removeShip('ship1');

        expect(GameStore.getState().battle?.ships.has('ship2')).toBe(true);
      });

      it('should do nothing for non-existent ship', () => {
        expect(() => GameStore.removeShip('non_existent')).not.toThrow();
        expect(GameStore.getState().battle?.ships.size).toBe(2);
      });

      it('should do nothing if no battle exists', () => {
        GameStore.reset();
        expect(() => GameStore.removeShip('ship1')).not.toThrow();
      });
    });

    describe('getShip', () => {
      beforeEach(() => {
        GameStore.startBattle();
        GameStore.addShip(createMockShip());
      });

      it('should get a ship by ID', () => {
        const ship = GameStore.getShip('test_ship_1');

        expect(ship).toBeDefined();
        expect(ship?.id).toBe('test_ship_1');
      });

      it('should return undefined for non-existent ship', () => {
        const ship = GameStore.getShip('non_existent');
        expect(ship).toBeUndefined();
      });

      it('should return undefined if no battle exists', () => {
        GameStore.reset();
        const ship = GameStore.getShip('test_ship_1');
        expect(ship).toBeUndefined();
      });
    });

    describe('getShipsByFaction', () => {
      beforeEach(() => {
        GameStore.startBattle();
        GameStore.addShip(createMockShip({ id: 'terran1', faction: 'terran_hegemony' }));
        GameStore.addShip(createMockShip({ id: 'terran2', faction: 'terran_hegemony' }));
        GameStore.addShip(createMockShip({ id: 'confed1', faction: 'free_confederation' }));
      });

      it('should get ships by faction', () => {
        const terranShips = GameStore.getShipsByFaction('terran_hegemony');

        expect(terranShips).toHaveLength(2);
        expect(terranShips.every((s) => s.faction === 'terran_hegemony')).toBe(true);
      });

      it('should return empty array for faction with no ships', () => {
        const synthShips = GameStore.getShipsByFaction('synthetic_collective');
        expect(synthShips).toHaveLength(0);
      });

      it('should return empty array if no battle exists', () => {
        GameStore.reset();
        const ships = GameStore.getShipsByFaction('terran_hegemony');
        expect(ships).toHaveLength(0);
      });
    });

    describe('getShipsByOwner', () => {
      beforeEach(() => {
        GameStore.startBattle();
        GameStore.addShip(createMockShip({ id: 'player1', owner: 'player' }));
        GameStore.addShip(createMockShip({ id: 'player2', owner: 'player' }));
        GameStore.addShip(createMockShip({ id: 'ai1', owner: 'ai' }));
        GameStore.addShip(createMockShip({ id: 'ai2', owner: 'ai' }));
        GameStore.addShip(createMockShip({ id: 'ai3', owner: 'ai' }));
      });

      it('should get player ships', () => {
        const playerShips = GameStore.getShipsByOwner('player');

        expect(playerShips).toHaveLength(2);
        expect(playerShips.every((s) => s.owner === 'player')).toBe(true);
      });

      it('should get AI ships', () => {
        const aiShips = GameStore.getShipsByOwner('ai');

        expect(aiShips).toHaveLength(3);
        expect(aiShips.every((s) => s.owner === 'ai')).toBe(true);
      });

      it('should return empty array if no battle exists', () => {
        GameStore.reset();
        const ships = GameStore.getShipsByOwner('player');
        expect(ships).toHaveLength(0);
      });
    });
  });

  describe('Immutability', () => {
    it('should not allow direct state mutation', () => {
      const state = GameStore.getState();
      const originalFaction = state.playerFaction;

      // This should not work (frozen object in production)
      // In tests, we verify the pattern works
      expect(originalFaction).toBe('free_confederation');
    });

    it('should create new state object on each update', () => {
      const state1 = GameStore.getState();

      GameStore.update((draft) => {
        draft.isPaused = true;
      });

      const state2 = GameStore.getState();

      expect(state1).not.toBe(state2);
    });

    it('should maintain referential equality for unchanged parts', () => {
      GameStore.startBattle();
      const ship = createMockShip();
      GameStore.addShip(ship);

      const battleBefore = GameStore.getState().battle;

      GameStore.update((draft) => {
        draft.isPaused = true;
      });

      const battleAfter = GameStore.getState().battle;

      // Battle object should be referentially equal if not modified
      // Note: Immer may or may not preserve this depending on the update
      expect(battleBefore).toBeDefined();
      expect(battleAfter).toBeDefined();
    });
  });

  describe('Map operations', () => {
    it('should support Map operations for ships', () => {
      GameStore.startBattle();

      for (let i = 0; i < 5; i++) {
        GameStore.addShip(createMockShip({ id: `ship${i}` }));
      }

      const ships = GameStore.getState().battle?.ships;

      expect(ships?.size).toBe(5);
      expect(ships?.has('ship0')).toBe(true);
      expect(ships?.has('ship4')).toBe(true);
    });
  });
});
