/**
 * LocalPilotSampler — reads this client's pilot (InputManager) every
 * rendered frame into a lockstep input word: the held actions, every press
 * since the previous sample (a throttle key going down counts as a press,
 * since throttle is a held intent), and a queued command (the player's
 * reinforcement pick). Pure: the intent source is injected.
 */

import type { ActionIntent, InputEvent } from "../../input/InputTypes";
import type { TickInput } from "../protocol";
import {
  EDGE_ACTIONS,
  encodePilotInput,
  HELD_ACTIONS,
  type EdgeAction,
  type HeldAction,
  type PilotCommand,
} from "../input/PilotInputCodec";

/** The slice of InputManager the sampler reads. */
export interface PilotIntentSource {
  isHeld(intent: ActionIntent): boolean;
  onAny(callback: (event: InputEvent) => void): number;
  off(subscriptionId: number): boolean;
}

/** Presses detected from held state rather than press events. */
const THROTTLE = ["THRUST_UP", "THRUST_DOWN"] as const;
const EVENT_PRESSES: ReadonlySet<string> = new Set(
  EDGE_ACTIONS.filter(
    (edge) => !(THROTTLE as readonly string[]).includes(edge),
  ),
);

export class LocalPilotSampler {
  private pending = new Set<EdgeAction>();
  private command: PilotCommand | null = null;
  private wasHeld = new Set<HeldAction>();
  private subscription: number | null = null;

  /** @param source - The local input (InputManager). */
  constructor(private readonly source: PilotIntentSource) {}

  /** Start collecting presses. */
  attach(): void {
    if (this.subscription !== null) return;
    this.subscription = this.source.onAny((event) => {
      if (EVENT_PRESSES.has(event.intent))
        this.pending.add(event.intent as EdgeAction);
    });
  }

  /** Stop collecting presses. */
  detach(): void {
    if (this.subscription !== null) this.source.off(this.subscription);
    this.subscription = null;
    this.pending.clear();
  }

  /** @param command - Sent with the next sample (e.g. a reinforcement pick). */
  queueCommand(command: PilotCommand): void {
    this.command = command;
  }

  /** @returns This frame's encoded input; clears the presses and command. */
  sample(): TickInput {
    const held = new Set(HELD_ACTIONS.filter((a) => this.source.isHeld(a)));
    const edges = this.pending;
    for (const action of THROTTLE)
      if (held.has(action) && !this.wasHeld.has(action)) edges.add(action);
    this.wasHeld = held;
    this.pending = new Set();
    const command = this.command;
    this.command = null;
    return encodePilotInput({
      held,
      edges,
      ...(command ? { command } : {}),
    });
  }
}
