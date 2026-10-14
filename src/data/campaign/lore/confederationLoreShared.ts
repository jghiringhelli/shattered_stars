/**
 * Shared pieces of the Confederation lore overlay ("Libre"): the extra
 * speakers the bible adds (Captain Kira, Ironwing Chen, Cdr. Chen, Kronos)
 * and the debrief-line builder the act files use.
 */

import type { DebriefLine } from "../campaignTypes";
import type { Speaker } from "../designKit";
import type { DialogueMood } from "../../../campaign/scripting/scriptTypes";

/** The Corsair captain Santos parleys with in the ion storm. */
export const KIRA: Speaker = {
  name: "CAPTAIN KIRA",
  portraitKey: "portrait_captain_kira",
};
/** Lena Chen, Marcus Chen's sister, in the Halden strike group. */
export const IRONWING: Speaker = {
  name: "IRONWING",
  portraitKey: "portrait_command",
};
/** The Hegemony commander who calls the ceasefire at Brannoc. */
export const CDR_CHEN: Speaker = {
  name: "CDR. CHEN",
  portraitKey: "portrait_admiral_chen",
};
/** Admiral Kronos, Rim Command's hardliner. */
export const KRONOS: Speaker = {
  name: "ADMIRAL KRONOS",
  portraitKey: "portrait_command",
};

/**
 * @param speaker - Who talks.
 * @param text - The line (about 140 characters at most).
 * @param mood - Comms mood.
 * @returns A debrief line.
 */
export function debriefLine(
  speaker: Speaker,
  text: string,
  mood: DialogueMood = "neutral",
): DebriefLine {
  return {
    speaker: speaker.name,
    portraitKey: speaker.portraitKey,
    text,
    mood,
  };
}
