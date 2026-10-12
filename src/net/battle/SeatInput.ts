/**
 * SeatInput — one human seat's input for the current lockstep tick, in the
 * shapes the battle code already reads: held actions (`isHeld`), one-shot
 * presses (`consume`, or `onAny` subscribers like InputManager's) and the
 * seat's command (a reinforcement pick). Fed once per tick from the decoded
 * relay input, so every client flies every seat from the same data. Pure.
 */

import type { ActionIntent, InputEvent } from "../../input/InputTypes";
import {
  EDGE_ACTIONS,
  type DecodedPilotInput,
  type EdgeAction,
  type HeldAction,
  type PilotCommand,
} from "../input/PilotInputCodec";

/** Throttle presses that also count as held for their tick (taps shorter than a tick). */
const TAP_HELD: ReadonlySet<string> = new Set(["THRUST_UP", "THRUST_DOWN"]);

export class SeatInput {
  /** The relay handed this seat to the AI for this tick. */
  aiControl = false;
  private held: ReadonlySet<HeldAction> = new Set();
  private edges = new Set<EdgeAction>();
  private command: PilotCommand | null = null;
  private readonly listeners = new Map<number, (event: InputEvent) => void>();
  private nextListenerId = 1;

  /**
   * Load this tick's input and deliver its presses to subscribers.
   * @param input - The seat's decoded input for the tick.
   */
  feed(input: DecodedPilotInput): void {
    this.aiControl = input.aiControl;
    this.held = input.held;
    this.edges = new Set(input.edges);
    this.command = input.command ?? null;
    for (const intent of EDGE_ACTIONS) {
      if (!this.edges.has(intent)) continue;
      const event: InputEvent = {
        intent,
        timestamp: 0,
        source: "keyboard",
        value: 1,
      };
      for (const listener of [...this.listeners.values()]) listener(event);
    }
  }

  /** @param intent - An action. @returns Whether it is held this tick. */
  isHeld(intent: ActionIntent): boolean {
    if (this.held.has(intent as HeldAction)) return true;
    return TAP_HELD.has(intent) && this.edges.has(intent as EdgeAction);
  }

  /** @param intent - A press. @returns Whether it was pressed this tick (once). */
  consume(intent: ActionIntent): boolean {
    return this.edges.delete(intent as EdgeAction);
  }

  /** @param intent - A press. @returns Whether it is pressed this tick (not consumed). */
  pressed(intent: ActionIntent): boolean {
    return this.edges.has(intent as EdgeAction);
  }

  /** @returns This tick's command, once. */
  takeCommand(): PilotCommand | null {
    const command = this.command;
    this.command = null;
    return command;
  }

  /** @param callback - Receives each press as it is fed. @returns Subscription id. */
  onAny(callback: (event: InputEvent) => void): number {
    const id = this.nextListenerId++;
    this.listeners.set(id, callback);
    return id;
  }

  /** @param subscriptionId - From onAny. @returns Whether it was subscribed. */
  off(subscriptionId: number): boolean {
    return this.listeners.delete(subscriptionId);
  }
}
