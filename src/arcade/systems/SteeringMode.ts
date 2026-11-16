/**
 * Active steering mode: the Settings choice offline, the online mode while a
 * lockstep battle is built. Mirrors the trick-rule lock in FlightCapabilities.
 */

import type { AnalogTuning } from "../../core/analogTuning";
import {
  ONLINE_STEERING_MODE,
  type SteeringMode,
} from "../../core/steeringMode";
import { steeringModePreference } from "../../systems/SettingsStorage";

/** Set by online battles: lockstep needs identical rules on every client. */
let onlineLock = false;

/** Dev-only analog tuning override (src/debug/analogTuneOverride); null = the default. */
let tuningOverride: AnalogTuning | null = null;

/**
 * @param tuning - The analog tuning every ship built from now on flies, or
 * null for the default (dev override, never persisted).
 */
export function setAnalogTuningOverride(tuning: AnalogTuning | null): void {
  tuningOverride = tuning;
}

/**
 * @returns The dev override of the analog tuning, or undefined when none is set.
 */
export function activeAnalogTuning(): AnalogTuning | undefined {
  return tuningOverride ?? undefined;
}

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
