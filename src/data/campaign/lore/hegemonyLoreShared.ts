/**
 * Shared pieces of the Hegemony lore overlay: the extra speakers the bible
 * adds (Phoenix One, Santos, Rim Command), Chen's pre-promotion label and the
 * helpers the act files use to adapt a mission's own objectives in variants.
 */

import type { MissionObjective } from "../campaignTypes";
import type { Speaker } from "../designKit";
import type { TextSwap } from "../loreTypes";

/** Chen until the end of Act III: a commander ("Iron Actual"), not yet an admiral. */
export const CDR_CHEN: Speaker = {
  name: "CDR. CHEN",
  portraitKey: "portrait_admiral_chen",
};
/** Chen once Fleet Command promotes him (the Last Gate debrief). */
export const ADMIRAL_CHEN: Speaker = {
  name: "ADMIRAL CHEN",
  portraitKey: "portrait_admiral_chen",
};
/** The Confederation ace Chen hunts, then escorts. */
export const PHOENIX: Speaker = {
  name: "PHOENIX ONE",
  portraitKey: "portrait_phoenix_one",
};
/** The Confederation commander who answers Chen's ceasefire. */
export const SANTOS: Speaker = {
  name: "SANTOS",
  portraitKey: "portrait_commander_santos",
};
/** Admiral Kronos: Rim Command's hardliner. */
export const RIM_COMMAND: Speaker = {
  name: "RIM COMMAND",
  portraitKey: "portrait_command",
};

/** The old label of Chen on lines the bible leaves as they are. */
export const CHEN_RANK_SWAP: TextSwap = ["ADMIRAL CHEN", "CDR. CHEN"];

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
