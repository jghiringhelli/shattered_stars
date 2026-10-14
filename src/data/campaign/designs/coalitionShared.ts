/**
 * Shared pieces of the Coalition designs (Acts IV-V): the voices, the allied
 * squads of every hero (each absent when its own faction is the lead) and
 * the helpers that gate a hero's line on who the player leads.
 */

import type { FactionId } from "../../../config";
import type {
  FlagCondition,
  ScriptAction,
  ScriptBeat,
  ScriptTrigger,
} from "../../../campaign/scripting/scriptTypes";
import type { MissionAlly, DebriefLine } from "../campaignTypes";
import { beat, say, type Speaker } from "../designKit";
import { CHEN, STRIKER, WHISPER } from "./hegemonyAct1";
import { PHOENIX, SANTOS, VASQUEZ } from "./confederationAct1";
import { ADMIRAL, BLOODFANG, KIRA } from "./corsairsAct1";
import { OMEGA, PRIME, UNIT_ZERO } from "./syntheticAct1";
import { ARCHON, DREAMER, HERALD } from "./ascendantAct1";

export {
  ADMIRAL,
  ARCHON,
  BLOODFANG,
  CHEN,
  DREAMER,
  HERALD,
  KIRA,
  OMEGA,
  PHOENIX,
  PRIME,
  SANTOS,
  STRIKER,
  UNIT_ZERO,
  VASQUEZ,
  WHISPER,
};

/** The joint command of the Coalition fleet. */
export const COALITION: Speaker = {
  name: "COALITION COMMAND",
  portraitKey: "portrait_command",
};
/** Admiral Lucan Vance, the Hollowed. */
export const VANCE: Speaker = { name: "VANCE", portraitKey: "portrait_command" };

/** Faction the Tide's creatures are drawn with (the Tide has none: looks only). */
export const TIDE_FACTION = "void_corsairs";
/** Faction of Kronos's remnant fleet and Vance's loyalists. */
export const LOYALIST_FACTION = "terran_hegemony";
/** Faction of the hulls Vance's money bought on the Confederation side. */
export const MERCENARY_FACTION = "free_confederation";
/** Placeholder squad list: the launcher swaps in the lead hero's faction roster. */
export const PLACEHOLDER_SHIPS: readonly string[] = [
  "terran_viper",
  "terran_raptor",
  "terran_centurion",
  "terran_thunderbolt",
];

/** The mission-local flag the launcher sets for the chosen lead's faction. */
export const leadFlag = (faction: FactionId): string => `lead_${faction}`;

/** Trigger shortcuts for the helpers below. */
export const AT_START: ScriptTrigger = { on: "start" };
/**
 * @param atSeconds - Mission time.
 * @returns A time trigger.
 */
export const AT = (atSeconds: number): ScriptTrigger => ({
  on: "time",
  atSeconds,
});

/**
 * @param hero - The faction whose hero speaks.
 * @returns The condition "the player does not lead that faction".
 */
export const unlessLeading = (hero: FactionId): FlagCondition => ({
  flag: leadFlag(hero),
  is: false,
});

/**
 * A hero's line that plays only when the player leads somebody else, so it
 * never reads as the lead talking to themselves.
 *
 * @param hero - The faction whose hero speaks.
 * @param when - Trigger.
 * @param speaker - The hero's voice.
 * @param text - The line.
 * @param mood - Optional mood.
 * @returns The beat.
 */
export function heroSays(
  hero: FactionId,
  when: ScriptTrigger,
  speaker: Speaker,
  text: string,
  mood?: Parameters<typeof say>[2],
): ScriptBeat {
  const action: ScriptAction = say(speaker, text, mood);
  return beat(when, [action], { if: [unlessLeading(hero)] });
}

/**
 * @param speaker - The voice.
 * @param text - The line (about 140 characters at most).
 * @param mood - Optional mood.
 * @returns A debrief line.
 */
export function line(
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

const ally = (
  faction: FactionId,
  shipId: string,
  count: number,
  tag: string,
  name: string,
): MissionAlly => ({ shipId, count, tag, name, unlessLead: faction });

/** @param count - Ships. @returns Chen's Iron Fist (absent when Hegemony leads). */
export const ironFist = (count = 2): MissionAlly =>
  ally("terran_hegemony", "terran_viper", count, "ironfist", "Iron Fist Squadron");
/** @param count - Ships. @returns Santos's cell (absent when the Confederation leads). */
export const santosCell = (count = 2): MissionAlly =>
  ally("free_confederation", "confed_falcon", count, "libre", "Santos's Cell");
/** @param count - Ships. @returns OMEGA-7's dissident cluster (absent when the Collective leads). */
export const omegaCluster = (count = 2): MissionAlly =>
  ally(
    "synthetic_collective",
    "synth_interceptor_drone",
    count,
    "dissent",
    "Dissident Cluster",
  );
/** @param count - Ships. @returns Kira's raiders (absent when the Corsairs lead). */
export const kiraRaiders = (count = 2): MissionAlly =>
  ally("void_corsairs", "corsair_fang", count, "raiders", "Kira's Raiders");
/** @param count - Ships. @returns The Dreamer's Templars (absent when the Ascendant lead). */
export const templarGuard = (count = 2): MissionAlly =>
  ally("ascendant_empire", "ascendant_templar", count, "templars", "Templar Guard");
