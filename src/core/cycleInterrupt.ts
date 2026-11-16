/**
 * cycleInterrupt — instant turns for the human pilot.
 *
 * A steering command normally waits for the 500 ms cycle boundary. A human's
 * turn (steer edge, hold -> bank upgrade, Q/E hard turn, the roll cancelling its
 * drift) instead CUTS the running cycle: it ends at the ship's current pose
 * (the prefix of its path, nose tangent, so the heading is continuous) and the
 * requested maneuver starts there as a FULL template cycle.
 *
 * The cut is a pure function of the control state, which carries the request
 * (`nextManeuver` + `interruptQueued`) and the cycle phase (`maneuverProgress`),
 * so every lockstep client takes it on the same tick. Bots never set the flag:
 * they keep committing at the boundary. Atomic specials (Snap, Hook, Knife)
 * are never cut and never cut anything: they queue as before. Ships on the
 * analog turn key (src/core/analogCycle) never cut: their turn is already
 * immediate.
 *
 * Pure and serialisable: no Phaser, no clock of its own.
 */

import { CYCLE_DURATION_MS } from "../config";
import {
  startManeuver,
  type ShipControlState,
  type ShipPose,
} from "./ArcadeControls";
import type { ManeuverDirection } from "./types";

/**
 * Shortest time a cycle must have flown before a turn may cut it (ms): five
 * 60 Hz ticks. An earlier request stays queued and cuts at this age, so
 * rapid key changes cannot spam cycles.
 */
export const CYCLE_INTERRUPT_MIN_ELAPSED_MS = 80;

/** Specials that fly their whole cycle: never cut, never cutting (Snap, Hook, Knife). */
const ATOMIC_MANEUVER = /^(kturn|segnor_|tallon_)/;

/**
 * @param direction - Any maneuver.
 * @returns True for the specials that always fly their whole cycle.
 */
export function isAtomicManeuver(direction: ManeuverDirection): boolean {
  return ATOMIC_MANEUVER.test(direction);
}

/**
 * Queue a maneuver that may cut the running cycle.
 *
 * @param control - Control state.
 * @param direction - The turn requested (null = straight, e.g. a roll cancelling a drift).
 * @returns The state with the request queued and flagged.
 */
export function queueInterrupt(
  control: ShipControlState,
  direction: ManeuverDirection | null,
): ShipControlState {
  return { ...control, nextManeuver: direction, interruptQueued: true };
}

/**
 * @param control - Control state.
 * @returns Time the running cycle has flown (ms).
 */
export function cycleElapsedMs(control: ShipControlState): number {
  return control.maneuverProgress * CYCLE_DURATION_MS;
}

/**
 * Whether the queued request cuts the running cycle now: the pilot asked for
 * it, the cycle is old enough, neither maneuver is an atomic special, the
 * request is a different maneuver than the one flying, and the ship is not a
 * capital (its boat easing would stall at every restart).
 *
 * @param control - Control state.
 * @returns True when {@link interruptCycle} should run.
 */
export function canInterruptCycle(control: ShipControlState): boolean {
  const current = control.currentManeuver;
  if (!control.interruptQueued || current === null) return false;
  if (control.analog) return false;
  if (control.movementProfile === "capital") return false;
  const requested = control.nextManeuver ?? "straight";
  if (isAtomicManeuver(current) || isAtomicManeuver(requested)) return false;
  if (requested === current) return false;
  return cycleElapsedMs(control) >= CYCLE_INTERRUPT_MIN_ELAPSED_MS;
}

/** A cycle cut short and the cycle that replaced it. */
export interface InterruptedCycle {
  readonly control: ShipControlState;
  /** Share of the cut cycle that was flown, 0–1 (scales its stress). */
  readonly fraction: number;
}

/**
 * Start the queued maneuver now, from the ship's current pose, as a full
 * template cycle at the flown speed the speed cap gives at this moment. The
 * once-per-cycle weapon latch is kept: a cut grants no extra attack.
 *
 * @param pose - The ship's pose (the cut cycle ends here).
 * @param control - Control state; {@link canInterruptCycle} must hold.
 * @returns The control of the new cycle and the share of the old one flown.
 */
export function interruptCycle(
  pose: ShipPose,
  control: ShipControlState,
): InterruptedCycle {
  const requested = control.nextManeuver ?? "straight";
  const started = startManeuver(
    pose,
    { ...control, nextManeuver: null },
    requested,
  );
  return {
    control: { ...started, firedLaserThisCycle: control.firedLaserThisCycle },
    fraction: control.maneuverProgress,
  };
}
