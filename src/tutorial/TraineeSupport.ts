/**
 * TraineeSupport — what keeps Flight School from ever blocking a lesson.
 *
 * The trainee flies a simulator configuration (every special and dash
 * unlocked, see {@link trainerFlight}). Stress and the shared 5 s
 * Snap / Hook / Knife recharge still carry over from lesson to lesson, so a
 * Hook followed by a Knife roll was refused ("stressed", "recharging") with
 * no explanation. {@link refreshTrainee} clears both when a lesson starts
 * (and while no special is in flight), and the notices say why a gesture was
 * refused.
 *
 * Pure: no Phaser.
 */

import { INITIAL_STRESS } from "../arcade/ArcadeStress";
import type { CycleFlightState } from "../arcade/systems/CycleFlight";
import type {
  FlightRefusal,
  FlightRefusalReason,
} from "../arcade/systems/FlightCapabilities";
import { UNRESTRICTED_CAPABILITIES } from "../core/flightCapabilityTypes";
import type { ShipControlState } from "../core/ArcadeControls";

/** The trainee's hull (a ship with Snap, Hook and Knife cells on its dial). */
export const SCHOOL_TRAINEE_DEFINITION = "confed_falcon";

/** A trick a lesson teaches (the action names of a flight refusal). */
export type TrickAction = FlightRefusal["action"];

const TRICK_NAMES: Readonly<Record<TrickAction, string>> = {
  kturn: "SNAP TURN",
  segnor: "HOOK LOOP",
  tallon: "KNIFE ROLL",
  boost: "BOOST",
  barrel_roll: "BARREL ROLL",
};

const REASON_TEXT: Readonly<Record<FlightRefusalReason, string>> = {
  stressed: "STRESSED: NO {name} — training clears it, try again",
  not_on_dial: "{name} NOT ON DIAL",
  no_action: "NO {name} ACTION",
};

/**
 * The lessons where the trainee is never blocked (stress and recharges are
 * cleared whenever no special is in flight), with the trick each teaches
 * (null: the radar lesson only needs a free Snap turn).
 */
export const TRAINER_LESSONS: Readonly<Record<string, TrickAction | null>> = {
  kturn: "kturn",
  segnor: "segnor",
  tallon: "tallon",
  boost: "boost",
  barrel_roll: "barrel_roll",
  radar: null,
};

const SPECIAL_MANEUVER = /^(kturn|segnor_|tallon_)/;

/**
 * The trainee flies a simulator configuration with every special and dash
 * unlocked (whatever the trick rule in Settings), so each lesson can be
 * practised in one ship; real ships fly only what their card lists.
 *
 * @param flight - The trainee's flight state as built from its card.
 * @returns The flight state with unrestricted capabilities.
 */
export function trainerFlight(flight: CycleFlightState): CycleFlightState {
  const control = {
    ...flight.motion.control,
    capabilities: UNRESTRICTED_CAPABILITIES,
  };
  return { ...flight, motion: { ...flight.motion, control } };
}

/**
 * Clear the trainee's stress and every recharge (pose, speed and the queued
 * maneuver are kept).
 *
 * @param flight - The trainee's flight state.
 * @returns The refreshed flight state.
 */
export function refreshTrainee(flight: CycleFlightState): CycleFlightState {
  const control = {
    ...flight.motion.control,
    kturnCooldown: 0,
    barrelRollCooldown: 0,
    boostCooldown: 0,
  };
  return {
    stress: INITIAL_STRESS,
    motion: { ...flight.motion, control },
  };
}

/**
 * Training never blocks a lesson: on the trainer lessons, stress and
 * recharges are cleared as soon as no Snap, Hook or Knife is queued or flying.
 *
 * @param stepId - The current lesson id.
 * @param flight - The trainee's flight state.
 * @returns The cleared flight state, or null when nothing needs clearing.
 */
export function freedTrainee(
  stepId: string | undefined,
  flight: CycleFlightState,
): CycleFlightState | null {
  if (stepId === undefined || !(stepId in TRAINER_LESSONS)) return null;
  const control = flight.motion.control;
  if (isSpecialInProgress(control)) return null;
  const blocked =
    flight.stress.level > 0 ||
    control.kturnCooldown > 0 ||
    control.boostCooldown > 0 ||
    control.barrelRollCooldown > 0;
  return blocked ? refreshTrainee(flight) : null;
}

/**
 * @param control - The trainee's control state.
 * @returns Whether a Snap, Hook or Knife is queued or flying.
 */
export function isSpecialInProgress(
  control: Pick<ShipControlState, "currentManeuver" | "nextManeuver">,
): boolean {
  return (
    SPECIAL_MANEUVER.test(control.currentManeuver ?? "") ||
    SPECIAL_MANEUVER.test(control.nextManeuver ?? "")
  );
}

/**
 * @param refusal - A refusal reported by the pilot controls.
 * @returns The line to show in the lesson card.
 */
export function refusalNotice(refusal: FlightRefusal): string {
  return REASON_TEXT[refusal.reason].replace(
    "{name}",
    TRICK_NAMES[refusal.action],
  );
}

/**
 * @param action - The trick that was attempted.
 * @param remainingMs - Recharge left when it was attempted.
 * @returns The line to show, or null when nothing was recharging.
 */
export function rechargeNotice(
  action: TrickAction,
  remainingMs: number,
): string | null {
  if (remainingMs <= 0) return null;
  const seconds = (remainingMs / 1000).toFixed(1);
  return `RECHARGING: ${TRICK_NAMES[action]} ready in ${seconds} s`;
}

/**
 * @param control - The trainee's control state.
 * @param action - A trick.
 * @returns The recharge time left on the timer that trick uses (ms).
 */
export function rechargeLeftMs(
  control: Pick<
    ShipControlState,
    "kturnCooldown" | "boostCooldown" | "barrelRollCooldown"
  >,
  action: TrickAction,
): number {
  if (action === "boost") return control.boostCooldown;
  if (action === "barrel_roll") return control.barrelRollCooldown;
  return control.kturnCooldown;
}
