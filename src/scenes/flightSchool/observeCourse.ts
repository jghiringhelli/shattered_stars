/**
 * observeCourse — what the Flight School step machine sees each frame: the
 * trainee's real flight state (speed, maneuvers, dash recharges), the intents
 * pressed, the hits landed and the state of the range.
 */

import Phaser from "phaser";
import type { ActionIntent } from "../../input/InputTypes";
import type { FlightSchoolObservation } from "../../tutorial/FlightSchoolSteps";
import type { SchoolField } from "./SchoolField";

/** Counters and presses the scene keeps for the lessons. */
export interface CourseTally {
  readonly pressed: ReadonlySet<ActionIntent>;
  readonly primaryHits: number;
  readonly secondaryHits: number;
}

/**
 * @param field - The ships on the range.
 * @param camera - The main camera.
 * @param nowMs - Scene time.
 * @param tally - Presses and hits so far.
 * @returns The observation for this frame.
 */
export function observeCourse(
  field: SchoolField,
  camera: Phaser.Cameras.Scene2D.Camera,
  nowMs: number,
  tally: CourseTally,
): FlightSchoolObservation {
  const control = field.player.flight.motion.control;
  return {
    nowMs,
    speed: control.speed,
    minSpeed: control.minSpeed,
    maxSpeed: control.maxSpeed,
    currentManeuver: control.currentManeuver,
    nextManeuver: control.nextManeuver,
    boostCooldownMs: control.boostCooldown,
    barrelRollCooldownMs: control.barrelRollCooldown,
    pressed: tally.pressed,
    primaryHits: tally.primaryHits,
    secondaryHits: tally.secondaryHits,
    markedTargetId: field.crew?.markedTargetOf("player", nowMs) ?? null,
    beaconOnScreen: field.beaconOnScreen(camera),
    enemiesAlive: field.enemiesAlive(),
  };
}
