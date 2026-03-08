/**
 * Typed event bus for decoupled communication between game systems
 */

import type { GameEvent, GameEventType } from './types';

type EventCallback = (event: GameEvent) => void;

interface Subscription {
  readonly id: number;
  readonly eventType: GameEventType | '*';
  readonly callback: EventCallback;
  readonly once: boolean;
}

class EventBusClass {
  private subscriptions: Subscription[] = [];
  private nextId = 1;
  private eventHistory: GameEvent[] = [];
  private readonly maxHistory = 100;

  /**
   * Subscribe to a specific event type
   */
  on(eventType: GameEventType, callback: EventCallback): number {
    const id = this.nextId++;
    this.subscriptions.push({
      id,
      eventType,
      callback,
      once: false,
    });
    return id;
  }

  /**
   * Subscribe to all events
   */
  onAny(callback: EventCallback): number {
    const id = this.nextId++;
    this.subscriptions.push({
      id,
      eventType: '*',
      callback,
      once: false,
    });
    return id;
  }

  /**
   * Subscribe to an event type, automatically unsubscribe after first trigger
   */
  once(eventType: GameEventType, callback: EventCallback): number {
    const id = this.nextId++;
    this.subscriptions.push({
      id,
      eventType,
      callback,
      once: true,
    });
    return id;
  }

  /**
   * Unsubscribe by subscription ID
   */
  off(subscriptionId: number): boolean {
    const index = this.subscriptions.findIndex((s) => s.id === subscriptionId);
    if (index !== -1) {
      this.subscriptions.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Emit an event to all subscribers
   */
  emit(type: GameEventType, data: Record<string, unknown> = {}): void {
    const event: GameEvent = {
      type,
      timestamp: performance.now(),
      data,
    };

    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    // Notify subscribers
    const toRemove: number[] = [];

    for (const sub of this.subscriptions) {
      if (sub.eventType === type || sub.eventType === '*') {
        try {
          sub.callback(event);
        } catch (error) {
          console.error(`EventBus: Error in callback for ${type}:`, error);
        }

        if (sub.once) {
          toRemove.push(sub.id);
        }
      }
    }

    // Clean up one-time subscriptions
    for (const id of toRemove) {
      this.off(id);
    }
  }

  /**
   * Get recent event history (useful for debugging)
   */
  getHistory(): readonly GameEvent[] {
    return this.eventHistory;
  }

  /**
   * Clear all subscriptions (useful for scene cleanup)
   */
  clear(): void {
    this.subscriptions = [];
  }

  /**
   * Get subscription count (for debugging)
   */
  get subscriptionCount(): number {
    return this.subscriptions.length;
  }

  /**
   * Create a scoped subscription manager for easy cleanup
   * Returns an object with subscribe methods that track all subscriptions
   * and a cleanup method to remove them all at once
   */
  createScope(): EventBusScope {
    const subscriptionIds: number[] = [];

    return {
      on: (eventType: GameEventType, callback: EventCallback): number => {
        const id = this.on(eventType, callback);
        subscriptionIds.push(id);
        return id;
      },

      once: (eventType: GameEventType, callback: EventCallback): number => {
        const id = this.once(eventType, callback);
        subscriptionIds.push(id);
        return id;
      },

      onAny: (callback: EventCallback): number => {
        const id = this.onAny(callback);
        subscriptionIds.push(id);
        return id;
      },

      cleanup: (): void => {
        for (const id of subscriptionIds) {
          this.off(id);
        }
        subscriptionIds.length = 0;
      },

      get subscriptionCount(): number {
        return subscriptionIds.length;
      },
    };
  }
}

/**
 * Scoped event bus interface for scene-level subscription management
 */
export interface EventBusScope {
  on(eventType: GameEventType, callback: EventCallback): number;
  once(eventType: GameEventType, callback: EventCallback): number;
  onAny(callback: EventCallback): number;
  cleanup(): void;
  readonly subscriptionCount: number;
}

// Singleton instance
export const EventBus = new EventBusClass();
