/**
 * AnalogKeyHold — a bot's finger on the single analog turn key. It holds the
 * key for the share of each cycle that flies the maneuver its intent asks for
 * (full hold = the dial's own turn, a bank on a hard-turn dial = half the
 * cycle, ...), starting when the cycle starts — bots keep deciding at the
 * boundary, then the key does the rest — and releases it mid-cycle.
 *
 * Pure: no Phaser.
 */

import { CYCLE_DURATION_MS } from "../../config";
import { holdPlanFor, type HoldPlan } from "../../core/analogHold";
import {
  ANALOG_TURN_DEGREES,
  steeringCapacity,
} from "../../core/analogSteering";
import type { ShipControlState } from "../../core/ArcadeControls";
import { flownSpeed } from "../../core/speedCap";
import type { ManeuverDirection } from "../../core/types";

/** Arrow keys held this frame. */
export interface HeldKeys {
  readonly left: boolean;
  readonly right: boolean;
}

const NO_KEYS: HeldKeys = { left: false, right: false };

export class AnalogKeyHold {
  private armed = true;
  /** The maneuver queued when the cycle started (the intent may move on before the key plans). */
  private armedManeuver: ManeuverDirection | null = null;
  private plan: HoldPlan | null = null;
  private remainingMs = 0;

  /**
   * A cycle started: the next frame plans its hold. Like a template queued
   * before the boundary, it flies what the intent asked for AT the commit,
   * whatever the intent turns into afterwards.
   *
   * @param committed - The maneuver the intent asked for at the commit.
   */
  arm(committed: ManeuverDirection): void {
    this.armed = true;
    this.armedManeuver = committed;
  }

  /** Forget the hold (new round / respawn). */
  reset(): void {
    this.armed = true;
    this.armedManeuver = null;
    this.plan = null;
    this.remainingMs = 0;
  }

  /** @returns How much longer the key stays down in this cycle (ms). */
  holdLeftMs(): number {
    return this.remainingMs;
  }

  /**
   * A pilot with no throttle plan of its own (a novice) still has to slow
   * down for a hard turn the dial prints only at a lower speed — with the
   * analog key nothing does it for the pilot. It taps the throttle down to
   * its hard-turn speed the first time it wants a turn and stays there.
   *
   * @param control - The ship's control state.
   * @param wished - The throttle the intent asks for (null = none).
   * @param wanted - The maneuver the intent asks for each cycle.
   * @returns The throttle to move toward, or null to leave it.
   */
  throttleWish(
    control: ShipControlState,
    wished: number | null,
    wanted: ManeuverDirection,
  ): number | null {
    const table = control.capabilities?.dialSpeeds;
    if (wished !== null || !control.analog || !table?.turn?.length || !wanted.startsWith("turn"))
      return wished;
    const capacity = steeringCapacity(table, control.speed, false);
    if (capacity.dialMaxDeg >= ANALOG_TURN_DEGREES) return null;
    return flownSpeed(table, "turn_left", control.speed);
  }

  /**
   * The keys for this frame.
   *
   * @param control - The ship's control state (cycle phase, set speed).
   * @param wanted - The maneuver the intent asks for each cycle.
   * @param stressed - Whether the pilot is stressed.
   * @param deltaMs - Frame length (ms).
   * @returns The arrows held this frame.
   */
  keys(
    control: ShipControlState,
    wanted: ManeuverDirection,
    stressed: boolean,
    deltaMs: number,
  ): HeldKeys {
    if (!control.analog?.free) {
      this.remainingMs = 0;
      return NO_KEYS;
    }
    if (this.armed) this.planCycle(control, wanted, stressed);
    const plan = this.plan;
    // Rounded to the nearest tick: a key is all-or-nothing within a frame.
    const down = plan !== null && this.remainingMs >= deltaMs / 2;
    this.remainingMs = Math.max(0, this.remainingMs - deltaMs);
    if (!down || plan === null) return NO_KEYS;
    return plan.side === "left"
      ? { left: true, right: false }
      : { left: false, right: true };
  }

  /**
   * @param control - The ship's control state.
   * @param wanted - The maneuver wanted.
   * @param stressed - Whether the pilot is stressed.
   */
  private planCycle(
    control: ShipControlState,
    wanted: ManeuverDirection,
    stressed: boolean,
  ): void {
    this.armed = false;
    this.plan = holdPlanFor(
      this.armedManeuver ?? wanted,
      control.capabilities?.dialSpeeds,
      control.speed,
      stressed,
      control.capabilities?.analogRateScale,
    );
    this.armedManeuver = null;
    const elapsedMs = control.maneuverProgress * CYCLE_DURATION_MS;
    this.remainingMs = Math.max(0, this.plan.holdMs - elapsedMs);
  }
}
