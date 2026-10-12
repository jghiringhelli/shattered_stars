/**
 * Flight capability contracts — what a ship may fly beyond the basic moves
 * of its dial (specials printed on the dial, dashes on its action bar).
 * Plain types and constants so the control state (core) can carry them;
 * the rules live in src/arcade/systems/FlightCapabilities.ts.
 */

import type { ManeuverDifficulty } from "./types";

/** A special maneuver queued by a dedicated key or gesture. */
export type SpecialManeuver =
  "kturn" | "segnor_left" | "segnor_right" | "tallon_left" | "tallon_right";

/** An instant dash from the action bar. */
export type FlightDash = "boost" | "barrel_roll";

/** What a ship may fly beyond its basic dial. */
export interface FlightCapabilities {
  readonly boost: boolean;
  readonly barrelRoll: boolean;
  /** Easiest dial difficulty of each special; absent = not on the dial. */
  readonly specials: Readonly<
    Partial<Record<SpecialManeuver, ManeuverDifficulty>>
  >;
}

/** Anything goes: unknown ships and legacy/test control states. */
export const UNRESTRICTED_CAPABILITIES: FlightCapabilities = {
  boost: true,
  barrelRoll: true,
  specials: {
    kturn: "red",
    segnor_left: "red",
    segnor_right: "red",
    tallon_left: "red",
    tallon_right: "red",
  },
};
