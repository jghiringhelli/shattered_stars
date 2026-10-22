/**
 * FlightCapabilities — what a ship may fly beyond the basic moves of its
 * dial, read from its card: the special maneuvers printed on its dial
 * (Snap turn, Hook Loop, Knife Roll) and the dashes on its action bar
 * (boost, barrel roll). Huge ships fly neither, whatever the data says.
 *
 * Ship identity: unless the trick rule is "full", a ship keeps at most one of
 * {barrel roll, Hook Loop, Knife Roll} (src/data/shipSpecials.ts); boost and
 * Snap Turn are never affected. Bots and the player share this one rule.
 *
 * Tabletop stress rule: a stressed pilot cannot execute a red maneuver and
 * cannot perform actions, so it is refused red specials and every dash.
 *
 * Pure: no Phaser. The pilot flight controls consult it every frame, for
 * the player and the bots alike.
 */

import type { ManeuverDefinition, ManeuverDifficulty } from "../../core/types";
import {
  DEFAULT_TRICK_RULE,
  UNRESTRICTED_CAPABILITIES,
  type FlightCapabilities,
  type FlightDash,
  type SpecialManeuver,
  type TrickRule,
} from "../../core/flightCapabilityTypes";
import { dialSpeedTable } from "../../core/speedCap";
import {
  getMovementProfile,
  getShipDefinition,
} from "../../data/ShipDefinitions";
import { effectiveActions, effectiveDial } from "../../data/shipSpecials";
import { shipSpecialsRule } from "../../systems/SettingsStorage";

export {
  UNRESTRICTED_CAPABILITIES,
  type FlightCapabilities,
  type FlightDash,
  type SpecialManeuver,
  type TrickRule,
  DEFAULT_TRICK_RULE,
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
  canManeuver: false,
};

/** Set by online battles: lockstep needs identical rules on every client. */
let onlineLock = false;

/**
 * Online hook: while locked, every capability lookup that names no rule uses
 * "identity", whatever the local Settings say. The online battle code calls
 * `lockTrickRuleToIdentity(true)` when a lockstep battle is built and
 * `false` when it ends (or passes "identity" explicitly to
 * flightCapabilitiesOf / createCycleFlight / createShipControl).
 *
 * @param locked - Whether to force the identity rule.
 */
export function lockTrickRuleToIdentity(locked: boolean): void {
  onlineLock = locked;
}

/**
 * @returns The trick rule in force when a caller names none: identity while
 * the online lock is set, else the Settings choice (default identity).
 */
export function activeTrickRule(): TrickRule {
  return onlineLock ? DEFAULT_TRICK_RULE : shipSpecialsRule();
}

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
 * @param trickRule - Pure rule override; omitted = {@link activeTrickRule}.
 * @returns What the ship may fly beyond its basic dial.
 */
export function flightCapabilitiesOf(
  definitionId: string,
  trickRule: TrickRule = activeTrickRule(),
): FlightCapabilities {
  const def = getShipDefinition(definitionId);
  if (!def) return UNRESTRICTED_CAPABILITIES;
  if (def.baseStats.size === "huge") return HUGE_CAPABILITIES;
  const actions: readonly string[] = effectiveActions(def, trickRule);
  const dial = effectiveDial(definitionId, trickRule);
  return {
    boost: actions.includes("boost"),
    barrelRoll: actions.includes("barrel_roll"),
    specials: specialsOnDial(dial),
    ...(getMovementProfile(definitionId) === "capital"
      ? {}
      : { dialSpeeds: dialSpeedTable(dial) }),
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
