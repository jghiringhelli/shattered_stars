/**
 * Ship specials choices of Settings › Gameplay (split out of settingsSchema,
 * which re-exports them).
 */

import type { TrickRule } from "../core/flightCapabilityTypes";

/** Ship specials choices (Settings › Gameplay): label and what it means. */
export const SHIP_SPECIALS_OPTIONS: ReadonlyArray<{
  readonly value: TrickRule;
  readonly label: string;
  readonly hint: string;
}> = [
  {
    value: "identity",
    label: "Ship identity",
    hint: "One signature trick per ship: barrel roll, Hook Loop or Knife Roll",
  },
  {
    value: "full",
    label: "Full card",
    hint: "Everything the ship card prints (offline modes only)",
  },
];
