/**
 * Hegemony lore, Act III part 1 — The Purge (Days 121–200): slots 11–13
 * (docs/lore/campaigns/hegemony.md).
 */

import {
  atTime,
  beat,
  bonus,
  kill,
  onObjective,
  onStart,
  protect,
  reinforce,
  say,
  setFlag,
  wave,
} from "../designKit";
import { COMMAND, STRIKER, WHISPER } from "../designs/hegemonyAct1";
import { HEGEMONY_ACT23_DESIGNS } from "../designs/hegemonyAct23";
import type { MissionLore } from "../loreTypes";
import {
  CDR_CHEN,
  CHEN_RANK_SWAP,
  withoutObjective,
} from "./hegemonyLoreShared";

const BETRAYAL_STANDS = [{ flag: "x11_betrayal_averted", is: false }] as const;
const BETRAYAL_AVERTED = [{ flag: "x11_betrayal_averted" }] as const;

/** Civilian lifters Chen refuses to fire on at Halden. */
const LIFTER_TAG = "lifter";

/** Slots 11–13 of the Hegemony campaign. */
export const HEGEMONY_ACT3_LORE_A: Readonly<Record<string, MissionLore>> = {
  heg_3_1: {
    day: 141,
    location: "Halden orbit",
    crossover: "X10",
    tagline: "Fleet against fleet. Vance's war, Chen's wing.",
    mood: "grim",
    briefing:
      "Vance orders the Halden uprising crushed. The Confederation fleet holds the orbit above the capital, and civilian lifters are breaking for open space beneath it. Chen obeys, for now. Break the fleet and take the command buoy. Nothing fires on a lifter.",
    objectiveText: { kill: "Break the Confederation fleet over Halden" },
    textSwaps: [CHEN_RANK_SWAP],
    addObjectives: [
      bonus(
        protect("lifters", "No civilian lifter fired on", LIFTER_TAG),
        2,
        100,
      ),
    ],
    script: [
      atTime(
        10,
        reinforce("confed_crane", 2, LIFTER_TAG, "behind"),
        say(
          COMMAND,
          "Lifters are breaking orbit. Fleet Intelligence relays the order: treat them as hostile.",
          "urgent",
        ),
      ),
      atTime(
        14,
        say(CDR_CHEN, "Negative. Nothing fires on a lifter. That is my order.", "solemn"),
      ),
      onObjective(
        "lifters",
        "completed",
        setFlag("x10_chen_held_fire", true),
        say(WHISPER, "Every lifter cleared the orbit. Command will ask why.", "proud"),
      ),
    ],
  },
  heg_3_2: {
    day: 150,
    location: "Confederation militia depot, Rim",
    tagline: "Steal their logistics. Leave before the garrison wakes.",
    mood: "urgent",
    briefing:
      "A militia depot on the Rim feeds the Confederation's fleet. Slip in, carry out two logistics cores and extract before the garrison wakes. Fleet Intelligence wants the manifests. Whisper wants to know where the weapons came from.",
    objectiveText: {
      intel: "Carry 2 logistics cores to the drop zone (boost/roll drops them)",
    },
    textSwaps: [
      CHEN_RANK_SWAP,
      [
        "The depot is secured. I have the encryption keys. I'm extracting now.",
        "The depot is secured. I have the cores, and the supply codes in them are Vance's. I'm extracting now.",
      ],
    ],
    script: [
      onObjective(
        "intel",
        "completed",
        setFlag("heg_vance_ledger", true),
        say(
          WHISPER,
          "The routing codes on these cores are Hegemony. Vance armed this depot. He supplies both sides.",
          "grim",
        ),
      ),
    ],
  },
  heg_3_3: {
    day: 158,
    location: "Cinder Gate",
    crossover: "X11",
    tagline: "Allies turned. Their mines are already in the water.",
    mood: "grim",
    briefing:
      "Cinder Gate, where the Hegemony trades with the Ascendant. Vance's false orders have turned the Templars hostile, and the approach is already mined. Survive the ambush and break the attackers. Do not follow them into the minefield.",
    replaceEnemies: [],
    replaceScript: [
      onStart(say(STRIKER, "Mines! The field was seeded before we arrived!", "urgent")),
      beat(
        { on: "time", atSeconds: 40 },
        [say(WHISPER, "Templars are herding us into the mines. Don't follow.")],
        { if: BETRAYAL_STANDS },
      ),
      beat(
        { on: "time", atSeconds: 80 },
        [wave("ascendant_seraph", 2, "ascendant_empire", { at: "behind" })],
        { if: BETRAYAL_STANDS },
      ),
      beat(
        { on: "time", atSeconds: 40 },
        [
          say(
            WHISPER,
            "The Templars are holding fire. These mines carry Vance's marks, not theirs.",
            "proud",
          ),
        ],
        { if: BETRAYAL_AVERTED },
      ),
      beat(
        { on: "time", atSeconds: 80 },
        [wave("terran_viper", 2, "terran_hegemony", { at: "behind" })],
        { if: BETRAYAL_AVERTED },
      ),
    ],
    variants: [
      {
        when: { flag: "x11_betrayal_averted", is: false },
        addEnemies: [
          { shipId: "ascendant_seraph", count: 4, faction: "ascendant_empire" },
          { shipId: "ascendant_templar", count: 4, faction: "ascendant_empire" },
        ],
      },
      {
        when: { flag: "x11_betrayal_averted" },
        tagline: "The Templars hold fire. The mines are Vance's.",
        briefing:
          "Cinder Gate, where the Hegemony trades with the Ascendant. The Templars refused Vance's false order and hold fire, but the approach is mined under their colours. The mines, and the mine-tenders still seeding them, are Vance's. Survive the field and break his wing.",
        addEnemies: [
          { shipId: "terran_viper", count: 3, faction: "terran_hegemony" },
        ],
        objectives: [
          ...withoutObjective(HEGEMONY_ACT23_DESIGNS.heg_3_3?.objectives, "kill"),
          kill("kill", "Destroy Vance's mine-tender wing", 3),
        ],
      },
    ],
    replaceDebrief: [
      {
        speaker: COMMAND.name,
        portraitKey: COMMAND.portraitKey,
        text: "Cinder Gate is clear. Hold your course. Do not pursue.",
        mood: "neutral",
      },
      {
        speaker: STRIKER.name,
        portraitKey: STRIKER.portraitKey,
        text: "The mines were seeded before we arrived. Vance told the Ascendant we were hostile. He told us they were.",
        mood: "urgent",
      },
      {
        speaker: WHISPER.name,
        portraitKey: WHISPER.portraitKey,
        text: "He burned the alliance from the inside. Classified channels, false-flag orders on both sides.",
        mood: "grim",
      },
      {
        speaker: CDR_CHEN.name,
        portraitKey: CDR_CHEN.portraitKey,
        text: "He wants a war between the powers. Weaken them all, then hold what is left.",
        mood: "grim",
      },
      {
        speaker: WHISPER.name,
        portraitKey: WHISPER.portraitKey,
        text: "Commander. The Ascendant commander sent a private message after the engagement: \"Iron Fist, we see the truth now. One chance. Take it.\"",
        mood: "solemn",
      },
      {
        speaker: CDR_CHEN.name,
        portraitKey: CDR_CHEN.portraitKey,
        text: "Then we take it.",
        mood: "proud",
      },
    ],
  },
  heg_3_3b: {
    day: 158,
    location: "Cinder Gate",
    crossover: "X11",
    tagline: "Strike Vance's loyalists before they strike first.",
    mood: "grim",
    briefing:
      "Vance's loyalists are staged at Cinder Gate to stage a false flag against the Ascendant. Preempt them: break the loyalist fleet and take down the Vindicator that leads it before the order goes out.",
    victoryFlags: { x11_betrayal_averted: true },
    textSwaps: [CHEN_RANK_SWAP],
  },
};
