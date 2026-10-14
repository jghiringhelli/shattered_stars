/**
 * Hegemony lore, Act III part 2 — The Purge (Days 121–200): slots 14–15
 * (docs/lore/campaigns/hegemony.md). Both are reworks: the Freedom chase and
 * the Brannoc ceasefire that ends on the Breach.
 */

import type { MissionObjective } from "../campaignTypes";
import {
  atTime,
  banner,
  beat,
  bonus,
  hazardOn,
  hold,
  kill,
  music,
  onObjective,
  onStart,
  protect,
  say,
  wave,
} from "../designKit";
import { COMMAND, STRIKER, WHISPER } from "../designs/hegemonyAct1";
import type { MissionLore } from "../loreTypes";
import {
  ADMIRAL_CHEN,
  CDR_CHEN,
  CHEN_RANK_SWAP,
  RIM_COMMAND,
  SANTOS,
} from "./hegemonyLoreShared";

/** Seconds the gate must be held (the Collective's gate virus cuts it short). */
const GATE_HOLD_SECONDS = 60;
const GATE_HOLD_SECONDS_VIRUS = 30;

/**
 * @param gateSeconds - Seconds the Brannoc gate must be held.
 * @returns The Last Gate's objectives.
 */
function lastGateObjectives(gateSeconds: number): MissionObjective[] {
  return [
    hold("gate", `Hold Brannoc Gate for ${gateSeconds} seconds`, {
      at: [0, -900],
      radius: 300,
      seconds: gateSeconds,
    }),
    kill("kill", "Break the holdouts that ignore the ceasefire", 12),
    bonus(protect("clean", "No losses in your squad", "squad"), 3, 150),
  ];
}

/** Slots 14–15 of the Hegemony campaign. */
export const HEGEMONY_ACT3_LORE_B: Readonly<Record<string, MissionLore>> = {
  heg_3_4: {
    day: 186,
    location: "Deep Rim",
    tagline: "CNS Freedom. Vance flies stolen colours.",
    mood: "urgent",
    briefing:
      "Vance's loyalists have seized the captured carrier CNS Freedom to run for the Rim. Confederation hulls, Hegemony crews, and Vance aboard. Overload her shield pylon, disable the ship and take him alive. Her reactor is venting: that is Vance's scorched earth.",
    objectiveText: {
      shields: "Overload CNS Freedom's shield pylon",
      kill: "Disable CNS Freedom",
      fast: "Disable CNS Freedom within 3 minutes",
    },
    victoryFlags: { heg_vance_captured: true },
    textSwaps: [CHEN_RANK_SWAP],
    replaceScript: [
      onStart(
        say(
          COMMAND,
          "CNS Freedom: our captured carrier. Vance's loyalists took her to run. Hit the pylon to strip her shields, then gut her.",
        ),
      ),
      atTime(
        8,
        say(
          STRIKER,
          "Confederation hulls, Hegemony crews. He flies stolen colours.",
          "grim",
        ),
      ),
      beat(
        { on: "time", atSeconds: 20 },
        [
          say(
            WHISPER,
            "The depot cores matched his armoury route. Every loyalist wing aboard is his.",
            "grim",
          ),
        ],
        { if: [{ flag: "heg_vance_ledger" }] },
      ),
      onObjective(
        "shields",
        "completed",
        say(
          WHISPER,
          "Pylon down. The reactor is venting. Vance would rather burn her than lose her. A flare front is coming from the south!",
          "urgent",
        ),
        hazardOn("flare"),
      ),
      beat(
        { on: "time", atSeconds: 90 },
        [
          wave("confed_falcon", 2, "free_confederation", { at: "flank" }),
          say(STRIKER, "Last loyalist wave launching!", "urgent"),
        ],
        { if: [{ flag: "cors_kappa_ledger", is: false }] },
      ),
      beat(
        { on: "time", atSeconds: 90 },
        [
          say(
            WHISPER,
            "Kappa's ledger gave me his payroll. The last wave's crews never got their launch orders.",
            "proud",
          ),
        ],
        { if: [{ flag: "cors_kappa_ledger" }] },
      ),
    ],
  },
  heg_3_5: {
    title: "The Last Gate",
    day: 199,
    location: "Brannoc Gate",
    crossover: "X14",
    tagline: "The last gate. Hold it, and then hold your fire.",
    mood: "proud",
    briefing:
      "The Confederation's Final Offensive hits Fort Brannoc. Hold the gate. Admiral Kronos wants a massacre. Chen wants a ceasefire, and a gate held long enough to call one. Then break whoever ignores it.",
    replaceObjectives: lastGateObjectives(GATE_HOLD_SECONDS),
    victoryFlags: {
      x14_ceasefire_called: true,
      x15_breach_witnessed_hegemony: true,
    },
    variants: [
      {
        when: { flag: "synth_gate_virus" },
        briefing:
          "The Confederation's Final Offensive hits Fort Brannoc, and the gate network is already sick: a Collective virus is eating the Spine. The gate will not last. Hold it long enough to call the ceasefire, then break whoever ignores it.",
        objectives: lastGateObjectives(GATE_HOLD_SECONDS_VIRUS),
        script: [
          onStart(
            say(
              WHISPER,
              "Something in the gate software is eating the Spine. Brannoc will go dark early.",
              "urgent",
            ),
          ),
        ],
      },
    ],
    replaceScript: [
      onStart(
        say(
          CDR_CHEN,
          "The Final Offensive comes through Brannoc Gate. Hold it, Iron Fist.",
          "proud",
        ),
      ),
      atTime(
        10,
        say(RIM_COMMAND, "Weapons free. Nothing leaves that gate alive.", "grim"),
      ),
      atTime(
        14,
        say(
          CDR_CHEN,
          "Negative, Rim Command. I'll hold the gate. I won't hold a massacre.",
          "solemn",
        ),
      ),
      atTime(
        50,
        wave("confed_albatross", 1, "free_confederation", { at: "ahead" }),
        say(STRIKER, "Bomber run on the gate!", "urgent"),
      ),
      onObjective(
        "gate",
        "completed",
        banner("CEASEFIRE CALLED", "Chen on the open channel"),
        say(
          CDR_CHEN,
          "All Confederation vessels, this is Commander Chen. Cease fire. I repeat, cease fire. The gate is ours, and the war is over.",
          "solemn",
        ),
      ),
      beat(
        { on: "objective", objectiveId: "gate", status: "completed" },
        [
          say(
            SANTOS,
            "Chen. Santos. Cells, stand down. Hold your fire.",
            "solemn",
          ),
        ],
        { if: [{ flag: "x14_ceasefire_called" }], delaySeconds: 4 },
      ),
      beat(
        { on: "objective", objectiveId: "gate", status: "completed" },
        [
          say(
            RIM_COMMAND,
            "Chen, you do not command this gate. Finish them.",
            "urgent",
          ),
        ],
        { delaySeconds: 6 },
      ),
      onObjective(
        "kill",
        "completed",
        music("tension"),
        say(
          WHISPER,
          "Commander, the Spine gates. They are going dark, one by one.",
          "urgent",
        ),
      ),
    ],
    replaceDebrief: [
      {
        speaker: CDR_CHEN.name,
        portraitKey: CDR_CHEN.portraitKey,
        text: "The ceasefire holds. Brannoc Gate holds. Nobody else dies on this approach.",
        mood: "proud",
      },
      {
        speaker: STRIKER.name,
        portraitKey: STRIKER.portraitKey,
        text: "Iron Fist. Undefeated. How about that.",
        mood: "proud",
      },
      {
        speaker: WHISPER.name,
        portraitKey: WHISPER.portraitKey,
        text: "Commander, look at the Spine. Every gate is dark, all the way to Sol.",
        mood: "urgent",
      },
      {
        speaker: CDR_CHEN.name,
        portraitKey: CDR_CHEN.portraitKey,
        text: "That is not Confederation work. That is not anyone's.",
        mood: "solemn",
      },
      {
        speaker: COMMAND.name,
        portraitKey: COMMAND.portraitKey,
        text: "Commander Chen, Fleet Command has announced it. You are promoted to Admiral. Iron Fist is redesignated the First Response Wing. Striker, your own command. Whisper, your own unit.",
        mood: "proud",
      },
      {
        speaker: STRIKER.name,
        portraitKey: STRIKER.portraitKey,
        text: "ADMIRAL CHEN! There it is! ...Sir? You're breaking up the squadron?",
        mood: "proud",
      },
      {
        speaker: ADMIRAL_CHEN.name,
        portraitKey: ADMIRAL_CHEN.portraitKey,
        text: "No. I'm making it bigger. Iron Fist never flies alone. Not today. Not ever.",
        mood: "proud",
      },
      {
        speaker: WHISPER.name,
        portraitKey: WHISPER.portraitKey,
        text: "Two hundred days. One conspiracy dismantled, one war halted. And whatever Vance started, the fractures remain.",
        mood: "solemn",
      },
      {
        speaker: ADMIRAL_CHEN.name,
        portraitKey: ADMIRAL_CHEN.portraitKey,
        text: "Then we mend them. That is what we do.",
        mood: "proud",
      },
    ],
  },
};
