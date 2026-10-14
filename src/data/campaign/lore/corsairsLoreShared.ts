/**
 * Shared pieces of the Corsair lore overlay: the extra speakers the bible
 * adds (Blackmaw, Vosk, the Dreamer, a Confederation picket), Kira's captain
 * label and the swap that applies it from the second act on.
 */

import type { DebriefLine } from "../campaignTypes";
import type { Speaker } from "../designKit";
import type { TextSwap } from "../loreTypes";

/** Kira's old comms label, on lines authored before her promotion. */
export const KIRA_LABEL = "KIRA";
/** Kira once Blackmaw gives her a ship and a crew (Prison Ship debrief). */
export const CAPT_KIRA: Speaker = {
  name: "CAPT. KIRA",
  portraitKey: "portrait_captain_kira",
};
/** Swap that labels every Kira line of a mission as the captain's. */
export const CAPTAIN_LABEL_SWAP: TextSwap = [KIRA_LABEL, CAPT_KIRA.name];

/** Kira's captain, murdered by Vosk before the Moot. */
export const BLACKMAW: Speaker = {
  name: "BLACKMAW",
  portraitKey: "portrait_command",
};
/** The usurper (renamed from the old Corsair rival). */
export const VOSK: Speaker = {
  name: "VOSK",
  portraitKey: "portrait_command",
};
/** The Ascendant voice Kira hears over the Cinder Gate comms. */
export const DREAMER: Speaker = {
  name: "THE DREAMER",
  portraitKey: "portrait_the_dreamer",
};
/** An Ascendant Convergence flight lead. */
export const HERALD: Speaker = {
  name: "HERALD",
  portraitKey: "portrait_herald",
};
/** A Confederation picket the pact waves Kira past. */
export const PICKET: Speaker = {
  name: "CONFEDERATION PICKET",
  portraitKey: "portrait_command",
};

/**
 * @param speaker - Who talks.
 * @param text - The line (about 140 characters at most).
 * @param mood - Plate colour.
 * @returns A debrief line.
 */
export function debriefLine(
  speaker: Speaker,
  text: string,
  mood?: DebriefLine["mood"],
): DebriefLine {
  return {
    speaker: speaker.name,
    portraitKey: speaker.portraitKey,
    text,
    ...(mood ? { mood } : {}),
  };
}
