/**
 * EventBus Tests
 *
 * Tests for the typed event bus system used for
 * decoupled communication between game systems.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus, type EventBusScope } from '../../../src/core/EventBus';
import type { GameEvent, GameEventType } from '../../../src/core/types';

describe('EventBus', () => {
  beforeEach(() => {
    // Clear all subscriptions before each test
    EventBus.clear();
  });

  describe('Basic subscription (on)', () => {
    it('should subscribe to a specific event type', () => {
      const callback = vi.fn();
      const id = EventBus.on('SHIP_SPAWNED', callback);

      expect(id).toBeGreaterThan(0);
      expect(EventBus.subscriptionCount).toBe(1);
    });

    it('should call callback when event is emitted', () => {
      const callback = vi.fn();
      EventBus.on('SHIP_SPAWNED', callback);

      EventBus.emit('SHIP_SPAWNED', { shipId: 'ship1' });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SHIP_SPAWNED',
          data: { shipId: 'ship1' },
        })
      );
    });

    it('should not call callback for different event types', () => {
      const callback = vi.fn();
      EventBus.on('SHIP_SPAWNED', callback);

      EventBus.emit('SHIP_DESTROYED', { shipId: 'ship1' });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should call callback multiple times for repeated events', () => {
      const callback = vi.fn();
      EventBus.on('SHIP_SPAWNED', callback);

      EventBus.emit('SHIP_SPAWNED', { shipId: 'ship1' });
      EventBus.emit('SHIP_SPAWNED', { shipId: 'ship2' });
      EventBus.emit('SHIP_SPAWNED', { shipId: 'ship3' });

      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should support multiple subscribers for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      EventBus.on('SHIP_SPAWNED', callback1);
      EventBus.on('SHIP_SPAWNED', callback2);

      EventBus.emit('SHIP_SPAWNED', { shipId: 'ship1' });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Subscribe to all (onAny)', () => {
    it('should call callback for any event type', () => {
      const callback = vi.fn();
      EventBus.onAny(callback);

      EventBus.emit('SHIP_SPAWNED', {});
      EventBus.emit('SHIP_DESTROYED', {});
      EventBus.emit('BATTLE_STARTED', {});

      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should receive correct event data for each type', () => {
      const events: GameEvent[] = [];
      EventBus.onAny((event) => events.push(event));

      EventBus.emit('SHIP_SPAWNED', { shipId: 'ship1' });
      EventBus.emit('SHIP_DESTROYED', { shipId: 'ship2' });

      expect(events).toHaveLength(2);
      expect(events[0]!.type).toBe('SHIP_SPAWNED');
      expect(events[1]!.type).toBe('SHIP_DESTROYED');
    });
  });

  describe('One-time subscription (once)', () => {
    it('should only call callback once', () => {
      const callback = vi.fn();
      EventBus.once('SHIP_SPAWNED', callback);

      EventBus.emit('SHIP_SPAWNED', { shipId: 'ship1' });
      EventBus.emit('SHIP_SPAWNED', { shipId: 'ship2' });
      EventBus.emit('SHIP_SPAWNED', { shipId: 'ship3' });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should automatically unsubscribe after first trigger', () => {
      const callback = vi.fn();
      EventBus.once('SHIP_SPAWNED', callback);

      expect(EventBus.subscriptionCount).toBe(1);
      EventBus.emit('SHIP_SPAWNED', {});
      expect(EventBus.subscriptionCount).toBe(0);
    });
  });

  describe('Unsubscribe (off)', () => {
    it('should unsubscribe by ID', () => {
      const callback = vi.fn();
      const id = EventBus.on('SHIP_SPAWNED', callback);

      const result = EventBus.off(id);

      expect(result).toBe(true);
      expect(EventBus.subscriptionCount).toBe(0);
    });

    it('should return false for invalid ID', () => {
      const result = EventBus.off(999);
      expect(result).toBe(false);
    });

    it('should not call callback after unsubscribing', () => {
      const callback = vi.fn();
      const id = EventBus.on('SHIP_SPAWNED', callback);

      EventBus.off(id);
      EventBus.emit('SHIP_SPAWNED', {});

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Event emission', () => {
    it('should include timestamp in event', () => {
      const callback = vi.fn();
      EventBus.on('SHIP_SPAWNED', callback);

      EventBus.emit('SHIP_SPAWNED', {});

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
        })
      );
    });

    it('should emit with empty data by default', () => {
      const callback = vi.fn();
      EventBus.on('SHIP_SPAWNED', callback);

      EventBus.emit('SHIP_SPAWNED');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {},
        })
      );
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const successCallback = vi.fn();

      EventBus.on('SHIP_SPAWNED', errorCallback);
      EventBus.on('SHIP_SPAWNED', successCallback);

      // Should not throw
      expect(() => EventBus.emit('SHIP_SPAWNED', {})).not.toThrow();

      // Both callbacks should still be called (error is caught)
      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
    });
  });

  describe('Event history', () => {
    it('should store event history', () => {
      const historyBefore = EventBus.getHistory().length;

      EventBus.emit('SHIP_SPAWNED', { shipId: 'ship1' });
      EventBus.emit('SHIP_DESTROYED', { shipId: 'ship2' });

      const history = EventBus.getHistory();

      // Should have added 2 new events
      expect(history.length).toBe(historyBefore + 2);
      // Most recent events should be our emitted ones
      expect(history[history.length - 2]!.type).toBe('SHIP_SPAWNED');
      expect(history[history.length - 1]!.type).toBe('SHIP_DESTROYED');
    });

    it('should limit history to maxHistory entries', () => {
      // Emit more than 100 events
      for (let i = 0; i < 150; i++) {
        EventBus.emit('SHIP_MOVED', { index: i });
      }

      const history = EventBus.getHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });

    it('should keep most recent events in history', () => {
      for (let i = 0; i < 150; i++) {
        EventBus.emit('SHIP_MOVED', { index: i });
      }

      const history = EventBus.getHistory();
      const lastEvent = history[history.length - 1]!;

      expect(lastEvent.data.index).toBe(149);
    });
  });

  describe('Clear subscriptions', () => {
    it('should clear all subscriptions', () => {
      EventBus.on('SHIP_SPAWNED', vi.fn());
      EventBus.on('SHIP_DESTROYED', vi.fn());
      EventBus.onAny(vi.fn());

      expect(EventBus.subscriptionCount).toBe(3);

      EventBus.clear();

      expect(EventBus.subscriptionCount).toBe(0);
    });
  });

  describe('Scoped subscriptions (createScope)', () => {
    let scope: EventBusScope;

    beforeEach(() => {
      scope = EventBus.createScope();
    });

    it('should create a new scope', () => {
      expect(scope).toBeDefined();
      expect(scope.subscriptionCount).toBe(0);
    });

    it('should track subscriptions in scope', () => {
      scope.on('SHIP_SPAWNED', vi.fn());
      scope.on('SHIP_DESTROYED', vi.fn());

      expect(scope.subscriptionCount).toBe(2);
      expect(EventBus.subscriptionCount).toBe(2);
    });

    it('should support scoped once subscriptions', () => {
      const callback = vi.fn();
      scope.once('SHIP_SPAWNED', callback);

      expect(scope.subscriptionCount).toBe(1);
      EventBus.emit('SHIP_SPAWNED', {});
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support scoped onAny subscriptions', () => {
      const callback = vi.fn();
      scope.onAny(callback);

      EventBus.emit('SHIP_SPAWNED', {});
      EventBus.emit('SHIP_DESTROYED', {});

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should cleanup all scope subscriptions', () => {
      scope.on('SHIP_SPAWNED', vi.fn());
      scope.on('SHIP_DESTROYED', vi.fn());
      scope.onAny(vi.fn());

      expect(EventBus.subscriptionCount).toBe(3);

      scope.cleanup();

      expect(scope.subscriptionCount).toBe(0);
      expect(EventBus.subscriptionCount).toBe(0);
    });

    it('should not affect other scopes when cleaning up', () => {
      const scope2 = EventBus.createScope();

      scope.on('SHIP_SPAWNED', vi.fn());
      scope2.on('SHIP_DESTROYED', vi.fn());

      scope.cleanup();

      expect(scope.subscriptionCount).toBe(0);
      expect(scope2.subscriptionCount).toBe(1);
      expect(EventBus.subscriptionCount).toBe(1);
    });

    it('should allow calling cleanup multiple times safely', () => {
      scope.on('SHIP_SPAWNED', vi.fn());

      scope.cleanup();
      scope.cleanup();
      scope.cleanup();

      expect(scope.subscriptionCount).toBe(0);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complex subscription patterns', () => {
      const results: string[] = [];

      // Regular subscription
      EventBus.on('SHIP_SPAWNED', () => results.push('on'));

      // One-time subscription
      EventBus.once('SHIP_SPAWNED', () => results.push('once'));

      // Any subscription
      EventBus.onAny((e) => results.push(`any:${e.type}`));

      EventBus.emit('SHIP_SPAWNED', {});
      EventBus.emit('SHIP_SPAWNED', {});

      expect(results).toEqual([
        'on',
        'once',
        'any:SHIP_SPAWNED',
        'on',
        'any:SHIP_SPAWNED',
      ]);
    });

    it('should handle rapid event emission', () => {
      let count = 0;
      EventBus.on('SHIP_MOVED', () => count++);

      for (let i = 0; i < 1000; i++) {
        EventBus.emit('SHIP_MOVED', { frame: i });
      }

      expect(count).toBe(1000);
    });
  });
});
