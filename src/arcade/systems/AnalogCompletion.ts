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
import type { DialSpeedTable } from "../../core/speedCap";
import type { ManeuverDirection } from "../../core/types";
import { classifyManeuver } from "../ArcadeStress";

/** A cycle as stress sees it: a dial maneuver and the speed it was flown at. */
export interface ClassifiedCycle {
  readonly direction: ManeuverDirection;
  readonly speed: number;
}

/**
 * @param analog - Steering state at the end of the cycle.
 * @param table - The ship's dial speeds (undefined = uncapped).
 * @returns The dial maneuver the cycle counts as, and its speed.
 */
export function classifyAnalogCycle(
  analog: AnalogSteer,
  table: DialSpeedTable | undefined,
): ClassifiedCycle {
  const speed = analog.turnSpeed ?? analog.baseSpeed;
  const ratio =
    analog.dialMaxDeg > 0 ? analog.turnedDeg / analog.dialMaxDeg : 0;
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
