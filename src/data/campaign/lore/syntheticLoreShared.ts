/**
 * Shared pieces of the Synthetic Collective lore overlay: the extra speaker
 * the bible adds (Commodore Hale), flag guards for Chronicle exclusivity and
 * the helper variants use to swap one authored objective for another.
 */

import type { MissionObjective } from "../campaignTypes";
import type { Speaker } from "../designKit";

/** Kronos's escort commander, the target at Varn's Crossing (X9). */
export const HALE: Speaker = {
  name: "COMMODORE HALE",
  portraitKey: "portrait_command",
};

/** Tag of the evacuation lifters OMEGA-7 refuses to fire on at the Breach. */
export const LIFTER_TAG = "lifter";

/** Hegemony did not hold the Tessaly relay (X2: the Collective writes canon). */
export const RELAY_NOT_HELD = [{ flag: "heg_relay_held", is: false }] as const;
/** Hale did not get away from the Corsairs first (X9). */
export const HALE_NOT_ESCAPED = [
  { flag: "x9_hale_escaped", is: false },
] as const;
/** Hale was not shot down by the Corsairs first (X9). */
export const HALE_NOT_DOWN = [{ flag: "x9_hale_down", is: false }] as const;
/** No Ascendant canon exists for the Catalyst (X13). */
export const CATALYST_STANDS = [
  { flag: "x13_catalyst_destroyed", is: false },
] as const;
/** The Mothership's relay still stands (X8). */
export const RELAY_STANDS = [{ flag: "relay_down", is: false }] as const;

/**
 * @param objectives - A mission's authored objectives.
 * @param id - The objective to replace.
 * @param replacement - The objective that takes its place (same id).
 * @returns The list with that one objective swapped (variants use this).
 */
export function swapObjective(
  objectives: readonly MissionObjective[] | undefined,
  id: string,
  replacement: MissionObjective,
): MissionObjective[] {
  return (objectives ?? []).map((o) => (o.id === id ? replacement : o));
}
