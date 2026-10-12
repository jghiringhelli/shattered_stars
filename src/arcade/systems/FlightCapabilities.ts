/**
 * FlightCapabilities — what a ship may fly beyond the basic moves of its
 * dial, read from its card: the special maneuvers printed on its dial
 * (K-turn, Segnor's Loop, Tallon Roll) and the dashes on its action bar
 * (boost, barrel roll). Huge ships fly neither, whatever the data says.
 *
 * X-Wing stress rule: a stressed pilot cannot execute a red maneuver and
 * cannot perform actions, so it is refused red specials and every dash.
 *
 * Pure: no Phaser. The pilot flight controls consult it every frame, for
 * the player and the bots alike.
 */

import type { ManeuverDefinition, ManeuverDifficulty } from "../../core/types";
import {
  UNRESTRICTED_CAPABILITIES,
  type FlightCapabilities,
  type FlightDash,
  type SpecialManeuver,
} from "../../core/flightCapabilityTypes";
import { getShipDefinition, getShipDial } from "../../data/ShipDefinitions";

export {
  UNRESTRICTED_CAPABILITIES,
  type FlightCapabilities,
  type FlightDash,
  type SpecialManeuver,
} from "../../core/flightCapabilityTypes";

/** Why the controls refused a special or a dash. */
export type FlightRefusalReason = "stressed" | "not_on_dial" | "no_action";

/** A refused special or dash, for HUD feedback. */
export interface FlightRefusal {
  readonly action: "kturn" | "segnor" | "tallon" | FlightDash;
  readonly reason: FlightRefusalReason;
}

const SPECIALS: readonly SpecialManeuver[] = [
  "kturn",
  "segnor_left",
  "segnor_right",
  "tallon_left",
  "tallon_right",
];

/** Difficulty order, easiest first. */
const DIFFICULTY_RANK: Readonly<Record<ManeuverDifficulty, number>> = {
  green: 0,
  white: 1,
  red: 2,
};

/** Huge ships (capitals) never flip, loop, boost or roll. */
const HUGE_CAPABILITIES: FlightCapabilities = {
  boost: false,
  barrelRoll: false,
  specials: {},
};

/**
 * @param dial - A ship's dial.
 * @returns The easiest difficulty of each special printed on it.
 */
function specialsOnDial(
  dial: readonly ManeuverDefinition[],
): Partial<Record<SpecialManeuver, ManeuverDifficulty>> {
  const specials: Partial<Record<SpecialManeuver, ManeuverDifficulty>> = {};
  for (const maneuver of dial) {
    const special = SPECIALS.find((name) => name === maneuver.direction);
    if (!special) continue;
    const known = specials[special];
    if (!known || DIFFICULTY_RANK[maneuver.difficulty] < DIFFICULTY_RANK[known])
      specials[special] = maneuver.difficulty;
  }
  return specials;
}

/**
 * @param definitionId - Ship definition id.
 * @returns What the ship may fly beyond its basic dial.
 */
export function flightCapabilitiesOf(definitionId: string): FlightCapabilities {
  const def = getShipDefinition(definitionId);
  if (!def) return UNRESTRICTED_CAPABILITIES;
  if (def.baseStats.size === "huge") return HUGE_CAPABILITIES;
  const actions: readonly string[] = def.baseStats.actions ?? [];
  return {
    boost: actions.includes("boost"),
    barrelRoll: actions.includes("barrel_roll"),
    specials: specialsOnDial(getShipDial(definitionId)),
  };
}

/**
 * @param capabilities - The ship's capabilities.
 * @param special - The special requested.
 * @param isStressed - Whether the pilot is stressed.
 * @returns Why it is refused, or null when it may be queued.
 */
export function specialRefusal(
  capabilities: FlightCapabilities,
  special: SpecialManeuver,
  isStressed: boolean,
): FlightRefusalReason | null {
  const difficulty = capabilities.specials[special];
  if (!difficulty) return "not_on_dial";
  if (isStressed && difficulty === "red") return "stressed";
  return null;
}

/**
 * @param capabilities - The ship's capabilities.
 * @param dash - The dash requested.
 * @param isStressed - Whether the pilot is stressed.
 * @returns Why it is refused, or null when it may be performed.
 */
export function dashRefusal(
  capabilities: FlightCapabilities,
  dash: FlightDash,
  isStressed: boolean,
): FlightRefusalReason | null {
  const onBar = dash === "boost" ? capabilities.boost : capabilities.barrelRoll;
  if (!onBar) return "no_action";
  if (isStressed) return "stressed";
  return null;
}
