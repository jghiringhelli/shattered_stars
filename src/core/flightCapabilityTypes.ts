/**
 * Flight capability contracts — what a ship may fly beyond the basic moves
 * of its dial (specials printed on the dial, dashes on its action bar).
 * Plain types and constants so the control state (core) can carry them;
 * the rules live in src/arcade/systems/FlightCapabilities.ts.
 */

import type { DialSpeedTable } from "./speedCap";
import type { ManeuverDifficulty } from "./types";

export type { SignatureTrick } from "./types";

/**
 * Which of {barrel roll, Hook Loop, Knife Roll} a ship may fly.
 * `identity`: only its signature trick (default; always used online).
 * `full`: everything its card prints (offline Settings choice).
 */
export const TRICK_RULES = ["identity", "full"] as const;
export type TrickRule = (typeof TRICK_RULES)[number];

/** The rule every mode uses unless Settings lifts it. */
export const DEFAULT_TRICK_RULE: TrickRule = "identity";

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
  /**
   * False for huge ships, which have no maneuver key at all (it shares LT
   * with commander order 1): pressing it does nothing and flashes nothing.
   * Absent = true.
   */
  readonly canManeuver?: boolean;
  /**
   * Speeds the dial prints for each maneuver, for the per-maneuver speed cap
   * (src/core/speedCap). Absent = no cap (huge ships, legacy states).
   */
  readonly dialSpeeds?: DialSpeedTable;
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
