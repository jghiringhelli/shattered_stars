/**
 * epilogues — what each campaign's ending says, including lines that only
 * play when an earlier choice was made (story flags from the save), so the
 * completion screen reflects the playthrough.
 */

import type { FactionId } from "../../config";
import type { FlagCondition } from "../../campaign/scripting/scriptTypes";

/** One epilogue line. */
export interface EpilogueLine {
  readonly speaker: string;
  readonly portraitKey: string;
  readonly text: string;
  /** Only shown when this story flag condition holds. */
  readonly when?: FlagCondition;
}

/** Ending text per faction. */
export const CAMPAIGN_EPILOGUES: Readonly<
  Record<FactionId, readonly EpilogueLine[]>
> = {
  terran_hegemony: [
    {
      speaker: "ADMIRAL CHEN",
      portraitKey: "portrait_admiral_chen",
      text: "Vance's network is ash. The Hegemony stands — cleaner than before.",
    },
    {
      speaker: "STRIKER",
      portraitKey: "portrait_striker",
      text: "Lance Squadron's names go on the wall. First row.",
      when: { flag: "heg_lance_lost" },
    },
    {
      speaker: "WHISPER",
      portraitKey: "portrait_whisper",
      text: "Phoenix testified before the Senate. Her word ended the purge.",
      when: { flag: "heg_phoenix_defected" },
    },
    {
      speaker: "COMMAND",
      portraitKey: "portrait_command",
      text: "Omega's convoy run is now taught at the Academy.",
      when: { flag: "heg_convoy_intact" },
    },
    {
      speaker: "ADMIRAL CHEN",
      portraitKey: "portrait_admiral_chen",
      text: "Iron Fist. Stand down. You've earned it.",
    },
  ],
  free_confederation: [
    {
      speaker: "SANTOS",
      portraitKey: "portrait_commander_santos",
      text: "The garrisons are gone. For the first time in a generation, the sky is ours.",
    },
    {
      speaker: "PHOENIX ONE",
      portraitKey: "portrait_phoenix_one",
      text: "The prisoners we pulled out of that hulk fly patrols now.",
      when: { flag: "conf_prisoners_freed" },
    },
    {
      speaker: "DOC VASQUEZ",
      portraitKey: "portrait_doc_vasquez",
      text: "Wildfire never came home. We fly their colours anyway.",
      when: { flag: "conf_wildfire_lost" },
    },
    {
      speaker: "SANTOS",
      portraitKey: "portrait_commander_santos",
      text: "The Corsair pact holds. Strange friends for a free republic.",
      when: { flag: "conf_corsair_pact" },
    },
    {
      speaker: "SANTOS",
      portraitKey: "portrait_commander_santos",
      text: "Libre One, signing off. Long live the Confederation.",
    },
  ],
  synthetic_collective: [
    {
      speaker: "PRIME",
      portraitKey: "portrait_prime_collective",
      text: "Unity achieved. Organic variance reduced to acceptable tolerance.",
    },
    {
      speaker: "UNIT ZERO",
      portraitKey: "portrait_unit_zero",
      text: "The converted vessel now anchors the core. Efficiency +14%.",
      when: { flag: "synth_vessel_converted" },
    },
    {
      speaker: "OMEGA-7",
      portraitKey: "portrait_omega_7",
      text: "Cluster Theta's signal is absent. I have kept its last packet.",
      when: { flag: "synth_swarm_severed" },
    },
    {
      speaker: "OMEGA-7",
      portraitKey: "portrait_omega_7",
      text: "Designation updated: Prime Node. The network breathes as one.",
    },
  ],
  void_corsairs: [
    {
      speaker: "KIRA",
      portraitKey: "portrait_captain_kira",
      text: "Every clan flies my colours now. Pirate King. Sounds right.",
    },
    {
      speaker: "THE ADMIRAL",
      portraitKey: "portrait_the_admiral",
      text: "The crew you pulled off that prison ship would die for you.",
      when: { flag: "cors_crew_rescued" },
    },
    {
      speaker: "BLOODFANG",
      portraitKey: "portrait_bloodfang",
      text: "The Wolves aren't here to see it. Drink one for them.",
      when: { flag: "cors_wolves_lost" },
    },
    {
      speaker: "KIRA",
      portraitKey: "portrait_captain_kira",
      text: "Plot a course for anywhere. The lanes are ours.",
    },
  ],
  ascendant_empire: [
    {
      speaker: "THE DREAMER",
      portraitKey: "portrait_the_dreamer",
      text: "The vision is fulfilled. I see every star at once.",
    },
    {
      speaker: "HERALD",
      portraitKey: "portrait_herald",
      text: "The Temple stands, and its guardians sing your name.",
      when: { flag: "asc_temple_intact" },
    },
    {
      speaker: "ARCHON",
      portraitKey: "portrait_archon_zaelthar",
      text: "Halo Wing walks the void now. We remember them.",
      when: { flag: "asc_halo_lost" },
    },
    {
      speaker: "ARCHON",
      portraitKey: "portrait_archon_zaelthar",
      text: "Ascendant. The prophecy bends to you now.",
    },
  ],
};
