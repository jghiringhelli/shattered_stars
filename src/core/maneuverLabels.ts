/**
 * Player-facing words for the parts of a maneuver id ("segnor_left" →
 * "HOOK L"). Ids stay internal; every HUD readout derived from an id
 * goes through here.
 */

/** Pilot-slang names of the three special maneuvers, keyed by id part. */
export const SPECIAL_MANEUVER_WORDS: Readonly<Record<string, string>> = {
  kturn: "SNAP",
  segnor: "HOOK",
  tallon: "KNIFE",
};

/** Short words for maneuver-name parts on the flight readout. */
export const MANEUVER_WORDS: Readonly<Record<string, string>> = {
  ...SPECIAL_MANEUVER_WORDS,
  left: "L",
  right: "R",
};