/**
 * Tests for NetworkService — battle seed tracking
 *
 * NetworkService extends Phaser.Events.EventEmitter.
 * We mock Phaser to avoid a full browser/renderer setup in Node.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Minimal Phaser EventEmitter mock so NetworkService can extend it
vi.mock('phaser', () => {
  class EventEmitter {
    private _listeners: Map<string, Array<(data: unknown) => void>> = new Map();

    on(event: string, fn: (data: unknown) => void): this {
      if (!this._listeners.has(event)) this._listeners.set(event, []);
      this._listeners.get(event)!.push(fn);
      return this;
    }

    off(event: string, fn: (data: unknown) => void): this {
      const fns = this._listeners.get(event) ?? [];
      this._listeners.set(event, fns.filter(f => f !== fn));
      return this;
    }

    emit(event: string, data?: unknown): boolean {
      const fns = this._listeners.get(event) ?? [];
      fns.forEach(fn => fn(data));
      return fns.length > 0;
    }

    removeAllListeners(): this { this._listeners.clear(); return this; }
  }

  return {
    default: {
      Events: { EventEmitter },
    },
  };
});

// Import after mock is registered
const { NetworkService } = await import('../../../src/services/NetworkService');

// Access the singleton instance and reset it between tests
function getService() {
  (NetworkService as unknown as { instance: unknown }).instance = null;
  return NetworkService.getInstance();
}

describe('NetworkService — battle seed tracking', () => {
  beforeEach(() => {
    // Reset singleton so each test starts fresh
    (NetworkService as unknown as { instance: unknown }).instance = null;
  });

  it('returns null for getCurrentBattleSeed() before any game_start', () => {
    const service = getService();
    expect(service.getCurrentBattleSeed()).toBeNull();
  });

  it('stores seed when game_start message is received', () => {
    const service = getService();
    const SEED = 98765;

    // Simulate receiving a game_start message from the server
    (service as unknown as { handleMessage: (m: unknown) => void }).handleMessage({
      type: 'game_start',
      payload: { seed: SEED },
      timestamp: Date.now(),
    });

    expect(service.getCurrentBattleSeed()).toBe(SEED);
  });

  it('overwrites previous seed on a new game_start', () => {
    const service = getService();

    (service as unknown as { handleMessage: (m: unknown) => void }).handleMessage({
      type: 'game_start',
      payload: { seed: 111 },
      timestamp: Date.now(),
    });

    (service as unknown as { handleMessage: (m: unknown) => void }).handleMessage({
      type: 'game_start',
      payload: { seed: 222 },
      timestamp: Date.now(),
    });

    expect(service.getCurrentBattleSeed()).toBe(222);
  });

  it('ignores game_start messages without a seed field', () => {
    const service = getService();

    // First set a valid seed
    (service as unknown as { handleMessage: (m: unknown) => void }).handleMessage({
      type: 'game_start',
      payload: { seed: 555 },
      timestamp: Date.now(),
    });

    // Then receive a malformed game_start with no seed
    (service as unknown as { handleMessage: (m: unknown) => void }).handleMessage({
      type: 'game_start',
      payload: {},
      timestamp: Date.now(),
    });

    // Previous seed should be preserved
    expect(service.getCurrentBattleSeed()).toBe(555);
  });

  it('emits game_start event so LobbyScene can react', () => {
    const service = getService();
    const listener = vi.fn();
    service.on('game_start', listener);

    (service as unknown as { handleMessage: (m: unknown) => void }).handleMessage({
      type: 'game_start',
      payload: { seed: 42 },
      timestamp: Date.now(),
    });

    expect(listener).toHaveBeenCalledWith({ seed: 42 });
  });

  it('connect() with no URL sets local mode', async () => {
    const service = getService();
    const result = await service.connect();
    expect(result).toBe(true);
    expect(service.isInLocalMode()).toBe(true);
  });
});
