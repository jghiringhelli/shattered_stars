/**
 * ArenaSteering — which steering engine the skill arena's ships fly.
 *
 * Gates and balance harnesses are deterministic experiments, so the arena
 * never reads the player's Settings: it flies the template engine unless a
 * battle names another (`BattleSpec.steering`) or the run switches the
 * default (`setDefaultArenaSteering`, e.g. the skill gates under
 * `SKILL_STEERING=analog`, see tests/skill/steeringSetup.ts).
 */

import type { AnalogTuning } from "../../core/analogTuning";
import type { SteeringMode } from "../../core/steeringMode";
import type { CycleFlightState } from "../../arcade/systems/CycleFlight";

let defaultMode: SteeringMode = "template";
let defaultTuning: AnalogTuning | undefined;

/**
 * @returns The analog tuning battles fly when neither the spec nor the entry
 * names one (undefined = the engine's default).
 */
export function defaultArenaAnalogTuning(): AnalogTuning | undefined {
  return defaultTuning;
}

/**
 * @param tuning - The analog tuning battles fly when their spec names none
 * (e.g. `SKILL_ANALOG_TUNE`, see tests/skill/steeringSetup.ts); undefined = the engine's default.
 */
export function setDefaultArenaAnalogTuning(
  tuning: AnalogTuning | undefined,
): void {
  defaultTuning = tuning;
}

/**
 * @param flight - A ship's flight state.
 * @param tuning - The analog tuning to fly (undefined leaves the ship as built).
 * @returns The flight with the tuning on its capabilities; unchanged for ships
 * that do not steer with the analog key.
 */
export function withAnalogTuning(
  flight: CycleFlightState,
  tuning: AnalogTuning | undefined,
): CycleFlightState {
  const control = flight.motion.control;
  if (!tuning || control.capabilities?.steering !== "analog") return flight;
  return {
    ...flight,
    motion: {
      ...flight.motion,
      control: {
        ...control,
        capabilities: { ...control.capabilities, analogTuning: tuning },
      },
    },
  };
}

/**
 * @returns The steering engine battles fly when their spec names none.
 */
export function defaultArenaSteering(): SteeringMode {
  return defaultMode;
}

/**
 * @param mode - The steering engine battles fly when their spec names none.
 */
export function setDefaultArenaSteering(mode: SteeringMode): void {
  defaultMode = mode;
}
