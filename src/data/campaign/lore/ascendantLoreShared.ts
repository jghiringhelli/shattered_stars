/**
 * Shared pieces of the Ascendant lore overlay: Chen's cameo label, debrief
 * and objective helpers, and the flag conditions the act files read.
 */

import type { DebriefLine, MissionObjective } from "../campaignTypes";
import type { Speaker } from "../designKit";
import type { DialogueMood } from "../../../campaign/scripting/scriptTypes";

/** Chen, when Iron Fist flies on the Crusade's flank (X11 canon). */
export const CDR_CHEN: Speaker = {
  name: "CDR. CHEN",
  portraitKey: "portrait_admiral_chen",
};

/** The false Prophet's broadcast (no portrait of his own yet: comms fallback). */
export const ILSANDRE: Speaker = {
  name: "PROPHET ILSANDRE",
  portraitKey: "portrait_command",
};

/** The Hegemony envoy's parley hail at Cinder Gate. */
export const ENVOY: Speaker = {
  name: "HEGEMONY ENVOY",
  portraitKey: "portrait_command",
};

/** Seconds before the Catalyst's threshold: later kills leave the door open. */
export const CATALYST_THRESHOLD_SECONDS = 180;

/**
 * @param speaker - Who speaks the debrief line.
 * @param text - The line (at most ~140 characters).
 * @param mood - Comms mood.
 * @returns A debrief line.
 */
export function debriefLine(
  speaker: Speaker,
  text: string,
  mood?: DialogueMood,
): DebriefLine {
  return {
    speaker: speaker.name,
    portraitKey: speaker.portraitKey,
    text,
    ...(mood ? { mood } : {}),
  };
}

/**
 * @param objectives - A mission's authored objectives.
 * @param id - The objective id to drop.
 * @returns The objectives without that one (variants swap a bonus in its place).
 */
export function withoutObjective(
  objectives: readonly MissionObjective[] | undefined,
  id: string,
): MissionObjective[] {
  return (objectives ?? []).filter((o) => o.id !== id);
}
