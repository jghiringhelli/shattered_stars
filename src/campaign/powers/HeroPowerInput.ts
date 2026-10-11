/**
 * HeroPowerInput — latches the hero-power intents (HERO_POWER_1 = V / pad
 * Y, HERO_POWER_2 = B / pad L3) from an injected intent source, the same
 * pattern PlayerFlightPilot uses for MARK_TARGET. One instance per battle
 * scene: attach() on create, detach() on shutdown.
 */

import type { ActionIntent, InputEvent } from "../../input/InputTypes";

/** The slice of InputManager the latch needs. */
export interface HeroPowerIntentSource {
  onAny(callback: (event: InputEvent) => void): number;
  off(subscriptionId: number): boolean;
}

/** Intent of each power slot, by slot index. */
export const HERO_POWER_INTENTS: readonly ActionIntent[] = [
  "HERO_POWER_1",
  "HERO_POWER_2",
];

export class HeroPowerInput {
  private subscriptionId: number | null = null;
  private pressed: number[] = [];

  /**
   * @param source - Where intents come from (InputManager in scenes).
   */
  constructor(private readonly source: HeroPowerIntentSource) {}

  /** Start listening. */
  attach(): void {
    if (this.subscriptionId !== null) return;
    this.subscriptionId = this.source.onAny((event) => {
      const slot = HERO_POWER_INTENTS.indexOf(event.intent);
      if (slot >= 0 && !this.pressed.includes(slot)) this.pressed.push(slot);
    });
  }

  /** Stop listening and forget pending presses. */
  detach(): void {
    if (this.subscriptionId !== null) this.source.off(this.subscriptionId);
    this.subscriptionId = null;
    this.pressed = [];
  }

  /**
   * Slots pressed since the last call (consumed).
   *
   * @returns Slot indexes, in press order.
   */
  takeRequests(): number[] {
    const pressed = this.pressed;
    this.pressed = [];
    return pressed;
  }
}
