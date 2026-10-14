/**
 * Central input manager that aggregates all input adapters
 * and dispatches action intents to the game
 */

import type {
  ActionIntent,
  InputAdapter,
  InputEvent,
  InputProfile,
  InputSource,
} from "./InputTypes";
import { DEFAULT_INPUT_PROFILE } from "./DefaultBindings";
import { READY_COOLDOWNS, type FlightCooldowns } from "./flightCooldowns";

type IntentCallback = (event: InputEvent) => void;

interface IntentSubscription {
  readonly id: number;
  readonly intent: ActionIntent | "*";
  readonly callback: IntentCallback;
}

class InputManagerClass {
  private adapters: Map<InputSource, InputAdapter> = new Map();
  private subscriptions: IntentSubscription[] = [];
  private nextId = 1;
  private profile: InputProfile = DEFAULT_INPUT_PROFILE;

  // Held state for continuous inputs (movement, etc.)
  private heldIntents: Map<ActionIntent, InputEvent> = new Map();

  /** How far the flown ship's roll / Snap turn have recharged (touch rings). */
  private flightCooldowns: FlightCooldowns = READY_COOLDOWNS;

  /** Intents not dispatched while a modal owns them (count per intent). */
  private suppressed: Map<ActionIntent, number> = new Map();

  /**
   * Stop dispatching `intent` (adapters keep polling, so presses made while
   * suppressed are consumed, not replayed). Used by modals, e.g. a confirm
   * dialog over the pause menu must not let ESC toggle pause underneath.
   *
   * @param intent - Intent to hold back.
   * @returns Release function (idempotent).
   */
  suppress(intent: ActionIntent): () => void {
    this.suppressed.set(intent, (this.suppressed.get(intent) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const remaining = (this.suppressed.get(intent) ?? 1) - 1;
      if (remaining > 0) this.suppressed.set(intent, remaining);
      else this.suppressed.delete(intent);
    };
  }

  /**
   * Register an input adapter
   */
  registerAdapter(adapter: InputAdapter): void {
    if (this.adapters.has(adapter.source)) {
      console.warn(
        `InputManager: Replacing existing adapter for ${adapter.source}`,
      );
      this.adapters.get(adapter.source)?.destroy();
    }

    adapter.init();
    this.adapters.set(adapter.source, adapter);
  }

  /**
   * Remove an input adapter
   */
  unregisterAdapter(source: InputSource): void {
    const adapter = this.adapters.get(source);
    if (adapter) {
      adapter.destroy();
      this.adapters.delete(source);
    }
  }

  /**
   * Subscribe to a specific action intent
   */
  on(intent: ActionIntent, callback: IntentCallback): number {
    const id = this.nextId++;
    this.subscriptions.push({ id, intent, callback });
    return id;
  }

  /**
   * Subscribe to all action intents
   */
  onAny(callback: IntentCallback): number {
    const id = this.nextId++;
    this.subscriptions.push({ id, intent: "*", callback });
    return id;
  }

  /**
   * Unsubscribe by ID
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
   * Poll all adapters and dispatch events (call each frame)
   */
  update(): void {
    // Clear held intents that are no longer active
    const activeIntents = new Set<ActionIntent>();

    for (const adapter of this.adapters.values()) {
      if (!adapter.isAvailable()) continue;

      const events = adapter.poll();
      for (const event of events) {
        // Track held state
        if (event.value > 0) {
          this.heldIntents.set(event.intent, event);
          activeIntents.add(event.intent);
        }

        // Dispatch to subscribers
        this.dispatch(event);
      }
    }

    // Clear intents that are no longer held
    for (const intent of this.heldIntents.keys()) {
      if (!activeIntents.has(intent)) {
        this.heldIntents.delete(intent);
      }
    }
  }

  /**
   * @param cooldowns - The flown ship's recharge fractions this frame.
   */
  reportFlightCooldowns(cooldowns: FlightCooldowns): void {
    this.flightCooldowns = cooldowns;
  }

  /** @returns The latest flight cooldowns reported by the flying scene. */
  getFlightCooldowns(): FlightCooldowns {
    return this.flightCooldowns;
  }

  /**
   * Check if an intent is currently held (for continuous actions)
   */
  isHeld(intent: ActionIntent): boolean {
    return this.heldIntents.has(intent);
  }

  /**
   * Get the value of a held intent (for analog inputs)
   */
  getHeldValue(intent: ActionIntent): number {
    return this.heldIntents.get(intent)?.value ?? 0;
  }

  /**
   * Get current input profile
   */
  getProfile(): InputProfile {
    return this.profile;
  }

  /**
   * Set input profile (user preferences)
   */
  setProfile(profile: InputProfile): void {
    this.profile = profile;
    // Notify adapters of profile change if needed
  }

  /**
   * Get all available input sources
   */
  getAvailableSources(): InputSource[] {
    return Array.from(this.adapters.entries())
      .filter(([, adapter]) => adapter.isAvailable())
      .map(([source]) => source);
  }

  private dispatch(event: InputEvent): void {
    if (this.suppressed.has(event.intent)) return;
    for (const sub of this.subscriptions) {
      if (sub.intent === event.intent || sub.intent === "*") {
        try {
          sub.callback(event);
        } catch (error) {
          console.error(
            `InputManager: Error in callback for ${event.intent}:`,
            error,
          );
        }
      }
    }
  }

  /**
   * Clean up all adapters
   */
  destroy(): void {
    for (const adapter of this.adapters.values()) {
      adapter.destroy();
    }
    this.adapters.clear();
    this.subscriptions = [];
    this.heldIntents.clear();
    this.suppressed.clear();
  }
}

// Singleton instance
export const InputManager = new InputManagerClass();
