/**
 * ArenaSteering — which steering engine the skill arena's ships fly.
 *
 * Gates and balance harnesses are deterministic experiments, so the arena
 * never reads the player's Settings: it flies the template engine unless a
 * battle names another (`BattleSpec.steering`) or the run switches the
 * default (`setDefaultArenaSteering`, e.g. the skill gates under
 * `SKILL_STEERING=analog`, see tests/skill/steeringSetup.ts).
 */

import type { SteeringMode } from "../../core/steeringMode";

let defaultMode: SteeringMode = "template";

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
