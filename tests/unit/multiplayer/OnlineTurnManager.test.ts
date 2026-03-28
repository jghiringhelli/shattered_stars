/**
 * Tests for OnlineTurnManager
 *
 * Verifies planning-phase network sync, state hashing, turn sync logic,
 * and mid-battle disconnect handling (Phase B).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OnlineTurnManager, type ManeuverPacket } from '../../../src/multiplayer/OnlineTurnManager';
import type { NetworkService, GameAction } from '../../../src/services/NetworkService';
import type { ShipState } from '../../../src/core/types';

// ─── Minimal NetworkService stub ─────────────────────────────────────────────

function createMockNetworkService(): {
  service: NetworkService;
  capturedActions: GameAction[];
  triggerGameAction: (action: GameAction) => void;
  triggerPlayerDisconnected: (data: { playerId: string; inBattle: boolean }) => void;
} {
  const capturedActions: GameAction[] = [];
  // Multi-event listener map: event → registered handlers
  const eventListeners = new Map<string, Array<(d: unknown) => void>>();

  const service = {
    on: vi.fn((event: string, fn: (data: unknown) => void) => {
      if (!eventListeners.has(event)) eventListeners.set(event, []);
      eventListeners.get(event)!.push(fn);
    }),
    off: vi.fn(),
    sendGameAction: vi.fn((action: GameAction) => {
      capturedActions.push(action);
    }),
  } as unknown as NetworkService;

  const emit = (event: string, data: unknown) =>
    (eventListeners.get(event) ?? []).forEach((fn) => fn(data));

  return {
    service,
    capturedActions,
    triggerGameAction: (action: GameAction) => emit('game_action', action),
    triggerPlayerDisconnected: (data) => emit('player_disconnected', data),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OnlineTurnManager', () => {
  let mock: ReturnType<typeof createMockNetworkService>;
  let manager: OnlineTurnManager;

  beforeEach(() => {
    mock = createMockNetworkService();
    manager = new OnlineTurnManager(mock.service);
  });

  describe('constructor', () => {
    it('registers a game_action listener on the network service', () => {
      expect(mock.service.on).toHaveBeenCalledWith('game_action', expect.any(Function), manager);
    });

    it('registers a player_disconnected listener on the network service', () => {
      expect(mock.service.on).toHaveBeenCalledWith('player_disconnected', expect.any(Function), manager);
    });
  });

  describe('submitAndWait', () => {
    it('sends a submit_maneuvers game_action with the provided maneuvers', async () => {
      const maneuvers: ManeuverPacket[] = [
        { shipId: 'ship_0', direction: 'straight', speed: 3, difficulty: 'white' },
      ];

      const promise = manager.submitAndWait(maneuvers, () => {});
      mock.triggerGameAction({ type: 'submit_maneuvers', data: { maneuvers: [] } });
      await promise;

      const sent = mock.capturedActions[0];
      expect(sent?.type).toBe('submit_maneuvers');
      expect((sent?.data as { maneuvers: ManeuverPacket[] }).maneuvers).toEqual(maneuvers);
    });

    it('calls onWaiting immediately after sending', () => {
      const onWaiting = vi.fn();
      const promise = manager.submitAndWait([], onWaiting);
      expect(onWaiting).toHaveBeenCalledOnce();
      // Resolve the promise to avoid unhandled rejection
      mock.triggerGameAction({ type: 'submit_maneuvers', data: { maneuvers: [] } });
      return promise;
    });

    it('resolves with the opponent maneuvers from an incoming submit_maneuvers action', async () => {
      const opponentManeuvers: ManeuverPacket[] = [
        { shipId: 'enemy_0', direction: 'bank_left', speed: 2, difficulty: 'red' },
      ];

      const promise = manager.submitAndWait([], () => {});
      mock.triggerGameAction({ type: 'submit_maneuvers', data: { maneuvers: opponentManeuvers } });

      const result = await promise;
      expect(result).toEqual(opponentManeuvers);
    });

    it('ignores incoming turn_sync actions while waiting', async () => {
      const promise = manager.submitAndWait([], () => {});
      // Send a turn_sync first — should not resolve the submit promise
      mock.triggerGameAction({ type: 'turn_sync', data: { turnNumber: 1, stateHash: 'abc' } });
      // Now send the correct action
      mock.triggerGameAction({ type: 'submit_maneuvers', data: { maneuvers: [] } });

      const result = await promise;
      expect(result).toEqual([]);
    });

    it('resolves with empty array when opponent sends no maneuvers', async () => {
      const promise = manager.submitAndWait([], () => {});
      mock.triggerGameAction({ type: 'submit_maneuvers', data: { maneuvers: undefined } });
      const result = await promise;
      expect(result).toEqual([]);
    });

    it('resolves with [] immediately when opponent disconnects mid-wait', async () => {
      const promise = manager.submitAndWait([], () => {});
      mock.triggerPlayerDisconnected({ playerId: 'remote_001', inBattle: true });
      const result = await promise;
      expect(result).toEqual([]);
    });
  });

  describe('computeStateHash', () => {
    it('returns the same hash for the same ship states', () => {
      const ships = new Map<string, ShipState>([
        ['ship_0', { id: 'ship_0', x: 100, y: 200, hull: 3, shields: 1 } as ShipState],
      ]);
      expect(manager.computeStateHash(ships)).toBe(manager.computeStateHash(ships));
    });

    it('returns a different hash when ship state changes', () => {
      const ships1 = new Map<string, ShipState>([
        ['ship_0', { id: 'ship_0', x: 100, y: 200, hull: 3, shields: 1 } as ShipState],
      ]);
      const ships2 = new Map<string, ShipState>([
        ['ship_0', { id: 'ship_0', x: 100, y: 200, hull: 2, shields: 1 } as ShipState],
      ]);
      expect(manager.computeStateHash(ships1)).not.toBe(manager.computeStateHash(ships2));
    });

    it('is order-independent (sorts by ship ID)', () => {
      const shipsAB = new Map<string, ShipState>([
        ['b_ship', { id: 'b_ship', x: 50, y: 50, hull: 4, shields: 2 } as ShipState],
        ['a_ship', { id: 'a_ship', x: 10, y: 10, hull: 2, shields: 0 } as ShipState],
      ]);
      const shipsBA = new Map<string, ShipState>([
        ['a_ship', { id: 'a_ship', x: 10, y: 10, hull: 2, shields: 0 } as ShipState],
        ['b_ship', { id: 'b_ship', x: 50, y: 50, hull: 4, shields: 2 } as ShipState],
      ]);
      expect(manager.computeStateHash(shipsAB)).toBe(manager.computeStateHash(shipsBA));
    });
  });

  describe('sendTurnSync', () => {
    it('sends a turn_sync game_action with turnNumber and stateHash', () => {
      manager.sendTurnSync(3, 'deadbeef');
      const sent = mock.capturedActions[0];
      expect(sent?.type).toBe('turn_sync');
      expect(sent?.data).toEqual({ turnNumber: 3, stateHash: 'deadbeef' });
    });
  });

  describe('onTurnSync', () => {
    it('fires the callback when a turn_sync action arrives', () => {
      const cb = vi.fn();
      manager.onTurnSync(cb);
      mock.triggerGameAction({ type: 'turn_sync', data: { turnNumber: 2, stateHash: '12ab34cd' } });
      expect(cb).toHaveBeenCalledWith(2, '12ab34cd');
    });
  });

  describe('onDisconnect', () => {
    it('fires the callback with the player ID when player_disconnected arrives', () => {
      const cb = vi.fn();
      manager.onDisconnect(cb);
      mock.triggerPlayerDisconnected({ playerId: 'remote_001', inBattle: true });
      expect(cb).toHaveBeenCalledWith('remote_001');
    });

    it('does not resolve pendingResolve when inBattle is false', async () => {
      let resolved = false;
      const promise = manager.submitAndWait([], () => {}).then((v) => { resolved = true; return v; });
      mock.triggerPlayerDisconnected({ playerId: 'remote_001', inBattle: false });
      // Give event loop a tick — promise should NOT resolve
      await new Promise((r) => setTimeout(r, 10));
      expect(resolved).toBe(false);
      // Clean up: resolve normally to avoid dangling Promise
      mock.triggerGameAction({ type: 'submit_maneuvers', data: { maneuvers: [] } });
      await promise;
    });
  });

  describe('destroy', () => {
    it('deregisters the game_action listener on the network service', () => {
      manager.destroy();
      expect(mock.service.off).toHaveBeenCalledWith('game_action', expect.any(Function), manager);
    });

    it('deregisters the player_disconnected listener on the network service', () => {
      manager.destroy();
      expect(mock.service.off).toHaveBeenCalledWith('player_disconnected', expect.any(Function), manager);
    });

    it('does not dispatch to onTurnSync callbacks after destroy', () => {
      const cb = vi.fn();
      manager.onTurnSync(cb);
      manager.destroy();
      mock.triggerGameAction({ type: 'turn_sync', data: { turnNumber: 1, stateHash: 'abc' } });
      expect(cb).not.toHaveBeenCalled();
    });

    it('does not dispatch onDisconnect callbacks after destroy', () => {
      const cb = vi.fn();
      manager.onDisconnect(cb);
      manager.destroy();
      mock.triggerPlayerDisconnected({ playerId: 'remote_001', inBattle: true });
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
