/**
 * AnalogCompletion — how a finished free-steer cycle counts for stress.
 *
 * The cycle is classified by the angle it achieved against what the dial
 * allowed at the speed it turned at (the ArcadeStress thresholds): barely
 * turned = straight, up to two thirds = a bank, more = the dial's own entry
 * there. So a fully held hard turn keeps that entry's colour (red stays red),
 * a half-held one is a bank, and a pilot who barely touched the key is flying
 * straight. Pure: no Phaser.
 */

import type { AnalogSteer } from "../../core/analogSteering";
import { DEFAULT_ANALOG_TUNING, type AnalogTuning } from "../../core/analogTuning";
import type { DialSpeedTable } from "../../core/speedCap";
import type { ManeuverDirection } from "../../core/types";
import { classifyManeuver } from "../ArcadeStress";

/** A cycle as stress sees it: a dial maneuver and the speed it was flown at. */
export interface ClassifiedCycle {
  readonly direction: ManeuverDirection;
  readonly speed: number;
}

/**
 * Room above the tuned bank angle (a cycle turned up to this share over it is
 * still a bank): the integrator's float error must not tip a full bank hold.
 */
const BANK_TOLERANCE = 1.02;
/** Share of the dial maximum a cycle within the bank angle counts as (a bank, mid-band). */
const BANK_COUNTS_AS = 0.45;

/**
 * @param analog - Steering state at the end of the cycle.
 * @param table - The ship's dial speeds (undefined = uncapped).
 * @param tuning - The ship's analog tuning: a cycle that turned no more than
 * the tuned bank angle stays a bank on a hard-turn dial, however big that
 * angle is next to the dial's 90° (a 60° bank is 0.67 of 90°, which the
 * stress thresholds would otherwise read as a hard turn).
 * @returns The dial maneuver the cycle counts as, and its speed.
 */
export function classifyAnalogCycle(
  analog: AnalogSteer,
  table: DialSpeedTable | undefined,
  tuning: AnalogTuning = DEFAULT_ANALOG_TUNING,
): ClassifiedCycle {
  const speed = analog.turnSpeed ?? analog.baseSpeed;
  const share = analog.dialMaxDeg > 0 ? analog.turnedDeg / analog.dialMaxDeg : 0;
  const withinBank =
    analog.turnKind === "turn" &&
    analog.turnedDeg <= tuning.bankDegrees * BANK_TOLERANCE;
  const ratio = withinBank && share >= 0.25 ? Math.min(share, BANK_COUNTS_AS) : share;
  const { direction } = classifyManeuver(ratio, speed);
  if (direction === "straight")
    return { direction: "straight", speed: analog.baseSpeed };
  const bankOnDial = table?.bank?.includes(speed) ?? true;
  const turnOnDial = table?.turn?.includes(speed) ?? false;
  const asTurn =
    analog.turnKind === "turn" &&
    (direction === "turn_left" || (!bankOnDial && turnOnDial));
  return { direction: asTurn ? "turn_left" : "bank_left", speed };
}
