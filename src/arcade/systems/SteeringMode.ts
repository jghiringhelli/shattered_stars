/**
 * Active steering mode: the Settings choice offline, the online mode while a
 * lockstep battle is built. Mirrors the trick-rule lock in FlightCapabilities.
 */

import {
  ONLINE_STEERING_MODE,
  type SteeringMode,
} from "../../core/steeringMode";
import { steeringModePreference } from "../../systems/SettingsStorage";

/** Set by online battles: lockstep needs identical rules on every client. */
let onlineLock = false;

/**
 * Online hook: while locked, every lookup that names no mode uses
 * ONLINE_STEERING_MODE, whatever the local Settings say. The online battle
 * code calls `lockSteeringToOnlineMode(true)` when a lockstep battle is built
 * and `false` when it ends.
 *
 * @param locked - Whether to force the online steering mode.
 */
export function lockSteeringToOnlineMode(locked: boolean): void {
  onlineLock = locked;
}

/**
 * @returns The steering mode in force when a caller names none.
 */
export function activeSteeringMode(): SteeringMode {
  return onlineLock ? ONLINE_STEERING_MODE : steeringModePreference();
}
