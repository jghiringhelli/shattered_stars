/**
 * shipSpecials — the ship identity rule: by default a ship flies AT MOST ONE
 * of {barrel roll, Hook Loop, Knife Roll}, its signature trick. Boost and
 * Snap Turn are never affected. Pure data helpers shared by the flight rules
 * (FlightCapabilities), the pick screen and the encyclopedia, so every place
 * that lists a ship's specials shows the same effective set.
 *
 * The signature is the ship definition's `signatureTrick`; when absent it is
 * the first trick the hull's card prints out of its role's preference order.
 * Table: docs/specs/flight-controls.md › Ship identity.
 */

import type {
  ActionType,
  ManeuverDefinition,
  ShipDefinition,
  ShipRole,
  SignatureTrick,
} from "../core/types";
import type { TrickRule } from "../core/flightCapabilityTypes";
import { getShipDefinition, getShipDial } from "./ShipDefinitions";

/** A trick that can be a signature. */
type Trick = Exclude<SignatureTrick, "none">;

/** Role preference when the definition names no signature (first one the card prints wins). */
const ROLE_PREFERENCE: Readonly<Record<ShipRole, readonly Trick[]>> = {
  light_fighter: ["barrel_roll", "knife_roll", "hook_loop"],
  interceptor: ["barrel_roll", "knife_roll", "hook_loop"],
  heavy_fighter: ["hook_loop", "knife_roll", "barrel_roll"],
  gunship: ["hook_loop", "knife_roll", "barrel_roll"],
  bomber: ["hook_loop", "knife_roll", "barrel_roll"],
  support: [],
  capital: [],
};

const HOOK_DIRECTIONS: ReadonlySet<string> = new Set([
  "segnor_left",
  "segnor_right",
]);
const KNIFE_DIRECTIONS: ReadonlySet<string> = new Set([
  "tallon_left",
  "tallon_right",
]);

/**
 * @param direction - A dial maneuver direction.
 * @returns The trick it belongs to, or null for ordinary and Snap maneuvers.
 */
function trickOfDirection(direction: string): Trick | null {
  if (HOOK_DIRECTIONS.has(direction)) return "hook_loop";
  if (KNIFE_DIRECTIONS.has(direction)) return "knife_roll";
  return null;
}

/**
 * @param def - A ship definition.
 * @param trick - A trick.
 * @returns Whether the hull's card prints it (action bar or dial).
 */
function cardPrints(def: ShipDefinition, trick: Trick): boolean {
  if (trick === "barrel_roll") return def.baseStats.actions.includes("barrel_roll");
  return getShipDial(def.id).some((m) => trickOfDirection(m.direction) === trick);
}

/**
 * @param definitionId - Ship definition id.
 * @returns The ship's signature trick ("none" for huge hulls and unknown ids).
 */
export function signatureTrickOf(definitionId: string): SignatureTrick {
  const def = getShipDefinition(definitionId);
  if (!def || def.baseStats.size === "huge") return "none";
  if (def.signatureTrick) return def.signatureTrick;
  const printed = ROLE_PREFERENCE[def.role].find((t) => cardPrints(def, t));
  return printed ?? "none";
}

/**
 * @param definitionId - Ship definition id.
 * @param trick - A trick.
 * @param rule - The trick rule in force.
 * @returns Whether the ship may fly the trick (card permitting).
 */
export function trickAllowed(
  definitionId: string,
  trick: Trick,
  rule: TrickRule,
): boolean {
  return rule === "full" || signatureTrickOf(definitionId) === trick;
}

/**
 * @param definitionId - Ship definition id.
 * @param rule - The trick rule in force.
 * @returns The ship's dial without the Hook / Knife cells it may not fly.
 */
export function effectiveDial(
  definitionId: string,
  rule: TrickRule,
): readonly ManeuverDefinition[] {
  const dial = getShipDial(definitionId);
  if (rule === "full") return dial;
  return dial.filter((m) => {
    const trick = trickOfDirection(m.direction);
    return trick === null || trickAllowed(definitionId, trick, rule);
  });
}

/**
 * @param def - A ship definition.
 * @param rule - The trick rule in force.
 * @returns The action bar without the barrel roll when it is not the signature.
 */
export function effectiveActions(
  def: ShipDefinition,
  rule: TrickRule,
): readonly ActionType[] {
  const actions = def.baseStats.actions ?? [];
  if (trickAllowed(def.id, "barrel_roll", rule)) return actions;
  return actions.filter((a) => a !== "barrel_roll");
}

/**
 * The effective specials for the pick screen and encyclopedia: dashes
 * first, then the dial's specials.
 *
 * @param definitionId - Ship definition id.
 * @param rule - The trick rule in force.
 * @returns Labels such as ["Boost", "Barrel Roll", "Snap Turn"].
 */
export function shipSpecialLabels(
  definitionId: string,
  rule: TrickRule,
): string[] {
  const def = getShipDefinition(definitionId);
  if (!def || def.baseStats.size === "huge") return [];
  const labels: string[] = [];
  const actions = effectiveActions(def, rule);
  if (actions.includes("boost")) labels.push("Boost");
  if (actions.includes("barrel_roll")) labels.push("Barrel Roll");
  const directions = new Set(
    effectiveDial(definitionId, rule).map((m) => m.direction as string),
  );
  if (directions.has("kturn")) labels.push("Snap Turn");
  if ([...HOOK_DIRECTIONS].some((d) => directions.has(d))) labels.push("Hook Loop");
  if ([...KNIFE_DIRECTIONS].some((d) => directions.has(d))) labels.push("Knife Roll");
  return labels;
}
