/**
 * Corsair lore, Act III — The Crown (Days 121–200): slots 11–15
 * (docs/lore/campaigns/corsairs.md).
 */

import {
  atTime,
  banner,
  music,
  onArea,
  onObjective,
  say,
  setFlag,
} from "../designKit";
import { ADMIRAL, BLOODFANG, KIRA } from "../designs/corsairsAct1";
import type { MissionLore } from "../loreTypes";
import {
  CAPTAIN_LABEL_SWAP,
  debriefLine,
  PICKET,
  VOSK,
} from "./corsairsLoreShared";

/** Slots 11–15 of the Corsair campaign. */
export const CORSAIRS_ACT3_LORE: Readonly<Record<string, MissionLore>> = {
  cors_3_1: {
    day: 132,
    location: "The Moot, Brass Anchorage",
    textSwaps: [CAPTAIN_LABEL_SWAP],
  },
  cors_3_2: {
    day: 148,
    location: "Station Kappa, the Outer Drift",
    textSwaps: [CAPTAIN_LABEL_SWAP],
    briefing:
      "Day 148. Station Kappa is a Fleet Intelligence black site in the Outer Drift, where the orders that burned the Rookery were signed. Overload its reactor, break its defenses and get out ahead of the flare front. Take Vance's payroll ledger on the way.",
    objectiveText: { defenses: "Destroy Station Kappa's defenses" },
    variants: [
      {
        when: { flag: "cors_rookery_burned" },
        briefing:
          "Day 148. The Rookery's ash still drifts in our vents. Station Kappa, Fleet Intelligence's black site in the Outer Drift, is where the order was signed. Overload its reactor, break its defenses and get out ahead of the flare front. Take Vance's payroll ledger on the way.",
        script: [
          atTime(
            8,
            say(
              BLOODFANG,
              "Rookery's ash is still in my vents. Kappa pays for it.",
              "grim",
            ),
          ),
        ],
      },
    ],
    script: [
      onObjective(
        "reactor",
        "completed",
        setFlag("cors_kappa_ledger", true),
        say(
          KIRA,
          "Vance's payroll ledger is in my hold. Every crew that hit us was on this list.",
          "grim",
        ),
      ),
    ],
    replaceDebrief: [
      debriefLine(
        KIRA,
        "The ledger has names. Rustjaw. Skarn's cousins. Every clan he bought.",
        "grim",
      ),
      debriefLine(
        ADMIRAL,
        "Someone will want that list more than the gold. Keep it where nobody looks.",
        "solemn",
      ),
    ],
  },
  cors_3_3: {
    day: 166,
    location: "The four fronts, Reach rim",
    textSwaps: [CAPTAIN_LABEL_SWAP],
    briefing:
      "Day 166. The five powers are killing each other across four fronts and nobody is watching the cargo. Sweep every front, raid ten ships from any side and leave before the storms close. Every side calls us thieves. That means we're doing it right.",
    variants: [
      {
        when: { flag: "conf_corsair_pact" },
        briefing:
          "Day 166. The five powers are killing each other across four fronts and nobody is watching the cargo. Sweep every front, raid ten ships from any side and leave before the storms close. Santos's pickets know our transponder: the pact waves us through the first checkpoint.",
        script: [
          onArea(
            -1200,
            -600,
            250,
            say(
              PICKET,
              "Pact transponder, green. Corsair Kira, you're cleared. Don't make us regret it.",
              "neutral",
            ),
          ),
        ],
      },
    ],
  },
  cors_3_4: {
    day: 184,
    location: "The Hegemony treasury ship",
    textSwaps: [CAPTAIN_LABEL_SWAP],
    briefing:
      "Day 184. The Hegemony treasury ship rides behind a mine-ringed vault, and a heavy escort. The gold is the lure. The vault also holds the Hegemony's half of the Nexus gate codes, and the Admiral wants those. Crack it, load the bullion and run for the jump point.",
    script: [
      atTime(
        20,
        say(
          ADMIRAL,
          "Take the gold, let the crews cheer. I want the case with the gate sigil.",
          "solemn",
        ),
      ),
      onObjective(
        "vault",
        "completed",
        setFlag("cors_gate_codes", true),
        say(
          ADMIRAL,
          "Codes copied. They matter more than every crate on this ship.",
          "solemn",
        ),
      ),
    ],
  },
  cors_3_5: {
    day: 200,
    location: "Brass Anchorage",
    crossover: "X15",
    textSwaps: [CAPTAIN_LABEL_SWAP],
    tagline: "Vosk killed Blackmaw. Take his throne.",
    briefing:
      "Day 200. Vosk murdered Blackmaw at the Moot and wants his chair. Over Brass Anchorage, rocks on one side and an ion storm on the other, take Vosk's war galley and cut down his Reaver aces. Win, and the Moot crowns you Pirate King.",
    victoryFlags: { x15_breach_witnessed_corsairs: true },
    script: [
      atTime(
        20,
        say(
          VOSK,
          "Blackmaw died asking for terms, Captain. So will you.",
          "grim",
        ),
      ),
      onObjective(
        "pretender",
        "completed",
        music("tide_motif"),
        banner("THE LANE GOES DEAD", "Three notes. Loud this time."),
        say(KIRA, "That's my nightmare. It's real.", "grim"),
      ),
    ],
    replaceDebrief: [
      debriefLine(
        ADMIRAL,
        "The Moot is on its knees, Pirate King. Blackmaw would have wept.",
        "proud",
      ),
      debriefLine(KIRA, "Then why is every lane silent? Listen to it.", "grim"),
      debriefLine(
        ADMIRAL,
        "I have waited three hundred years to hear it this loud. Hold your course.",
        "solemn",
      ),
    ],
  },
};
