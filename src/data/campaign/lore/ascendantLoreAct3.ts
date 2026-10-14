/**
 * Ascendant lore, Act III — Ascension (Days 121–200): slots 11–14
 * (docs/lore/campaigns/ascendant.md); the finale lives in
 * ascendantLoreFinale.ts.
 */

import {
  atTime,
  banner,
  beat,
  bonus,
  onDestroyed,
  onObjective,
  protect,
  reinforce,
  say,
  setFlag,
} from "../designKit";
import { ASCENDANT_ACT23_DESIGNS } from "../designs/ascendantAct23";
import { ARCHON, DREAMER, HERALD } from "../designs/ascendantAct1";
import type { MissionLore } from "../loreTypes";
import {
  CATALYST_THRESHOLD_SECONDS,
  CDR_CHEN,
  debriefLine,
  ENVOY,
} from "./ascendantLoreShared";

const CATALYST_ON_TIME = [
  { flag: "x13_door_opened", is: false },
  { flag: "door_threshold", is: false },
] as const;
const CATALYST_LATE = [
  { flag: "x13_catalyst_destroyed", is: false },
  { flag: "door_threshold" },
] as const;

const PARLEY_SHIP = bonus(
  protect(
    "parley",
    "Hold fire on the parley ship: keep the envoy alive",
    "parley",
  ),
  2,
  80,
);

/** Slots 11–14 of the Ascendant campaign. */
export const ASCENDANT_ACT3_LORE: Readonly<Record<string, MissionLore>> = {
  asc_3_1: {
    day: 158,
    location: "Cinder Gate",
    crossover: "X11",
    tagline:
      "The orders carry the Archons' seal. The Dreamer says they read wrong.",
    briefing:
      "Orders under the Archons' seal send the Crusade's first strike at the Hegemony 'traitors' gathered at Cinder Gate. The seal is good. The orders are Vance's forgery, and the Dreamer feels it before anyone can prove it. Break the line, plant the standard, and hold fire on any envoy that flies a parley transponder.",
    textSwaps: [
      [
        "Convert or destroy the Hegemony line",
        "Break the line the orders name",
      ],
    ],
    addObjectives: [PARLEY_SHIP],
    script: [
      onDestroyed(
        "parley",
        1,
        "player",
        say(
          HERALD,
          "The envoy is down. Whatever was meant here, it is lost.",
          "solemn",
        ),
      ),
      onObjective(
        "parley",
        "completed",
        setFlag("x11_betrayal_averted", true),
        say(
          DREAMER,
          "The envoy lives. Nobody here was owed this fight. Someone will want to know who ordered it.",
          "solemn",
        ),
      ),
    ],
    variants: [
      {
        when: { flag: "x11_betrayal_averted", is: false },
        script: [
          atTime(
            25,
            reinforce("terran_raptor", 1, "parley", "flank"),
            say(
              ENVOY,
              "Ascendant fleet, this is a Hegemony envoy under truce. We hold no order to fire. Hold yours.",
              "urgent",
            ),
          ),
        ],
      },
      {
        when: { flag: "x11_betrayal_averted" },
        tagline:
          "Vance's loyalists wear Hegemony grey. Iron Fist flies with you.",
        briefing:
          "Orders under the Archons' seal send the Crusade's first strike at Cinder Gate, and the Hegemony has already exposed the forgery. The line you meet flies Vance's colours, not the Directorate's, and Commander Chen's Iron Fist holds your flank. Break the loyalists and plant the standard.",
        objectives: ASCENDANT_ACT23_DESIGNS.asc_3_1?.objectives ?? [],
        addAllies: [
          {
            shipId: "terran_viper",
            count: 2,
            tag: "iron_fist",
            name: "Iron Fist",
          },
        ],
        script: [
          atTime(
            12,
            say(
              CDR_CHEN,
              "Iron Fist on your flank, Templar. Vance's loyalists wear our grey tonight. Let's finish them.",
              "proud",
            ),
          ),
        ],
      },
    ],
    debriefAppend: [
      debriefLine(
        ARCHON,
        "The Oracles will call this the first victory of the Crusade. The Dreamer calls it a lesson in who writes our orders.",
        "grim",
      ),
    ],
  },
  asc_3_2: {
    day: 186,
    location: "Nexus Approach",
    crossover: "X13",
    briefing:
      "The Dreamer has seen this place burn. A Collective machine, the Catalyst, is seeding the Nexus Approach with Prime's cores, and every core that roots opens a door in the veil. Destroy it before the threshold, then run: the void behind it does not close politely.",
    objectiveText: {
      catalyst: "Destroy the Catalyst before the threshold opens the door",
    },
    script: [
      atTime(
        CATALYST_THRESHOLD_SECONDS,
        setFlag("door_threshold"),
        banner("THRESHOLD CROSSED", "The door is opening"),
        say(
          ARCHON,
          "The threshold is behind us. The door opens whether it lives or dies.",
          "grim",
        ),
      ),
      beat(
        { on: "objective", objectiveId: "catalyst", status: "completed" },
        [setFlag("x13_catalyst_destroyed", true)],
        { if: CATALYST_ON_TIME },
      ),
      beat(
        { on: "objective", objectiveId: "catalyst", status: "completed" },
        [setFlag("x13_door_opened", true)],
        { if: CATALYST_LATE },
      ),
    ],
    variants: [
      {
        when: { flag: "x13_door_opened" },
        tagline: "The door is open. Do not let it be tended.",
        briefing:
          "Prime's seeds are already rooted at the Nexus Approach: the door is open, and the Catalyst only tends it. Destroy it anyway, because a tended door opens wider. Then run.",
      },
    ],
    debriefAppend: [
      debriefLine(
        DREAMER,
        "Whatever opens that door was built to. I could feel it listening. I do not think it was listening to us.",
        "grim",
      ),
    ],
  },
  asc_3_3: {
    day: 171,
    location: "Halden's Reach",
    crossover: "X12",
    briefing:
      "The Coalition rendezvous at Halden's Reach is being purged, and the Collective is hunting what is left of it: refugees out of Vega Prime, human and Unbound, bound for sanctuary. Archon Zaelthar calls them converts. The Dreamer calls them people. Get them through.",
    textSwaps: [
      [
        "Escort the faithful to the sanctuary",
        "Escort the refugees to the Coalition sanctuary",
      ],
      ["Lose none of the faithful", "Lose none of the refugees"],
      ["Organics who kneel.", "People who run."],
      [
        "Organics who accept the faith. The machines call it contamination. Shield them.",
        "Refugees out of Vega Prime, human and Unbound. I call them converts. The machines call them contamination. Shield them.",
      ],
      [
        "They are not like us. They came anyway. That is faith.",
        "They are not converts, Archon. They are people. They came anyway.",
      ],
      ["One of the faithful is lost.", "One of the refugees is lost."],
      ["The faithful are home", "The refugees are through"],
    ],
    script: [
      onObjective(
        "faithful",
        "completed",
        setFlag("x12_sanctuary_reached", true),
        say(
          DREAMER,
          "They are through. Not one of them believes what we believe. I have never felt a prayer so loud.",
          "proud",
        ),
      ),
    ],
    variants: [
      {
        when: { flag: "x12_rendezvous_denied" },
        briefing:
          "The Coalition rendezvous at Halden's Reach has already been struck, and its refugees are scattered across the Reach with the Collective's pickets between them and any sanctuary. Gather the Vega Prime survivors and bring them through. The Archon calls them converts. The Dreamer calls them people.",
        addEnemies: [
          {
            shipId: "synth_hunter",
            count: 2,
            faction: "synthetic_collective",
          },
        ],
      },
    ],
    debriefAppend: [
      debriefLine(
        HERALD,
        "The Archon watched them go. He did not say convert. I noticed.",
        "solemn",
      ),
    ],
  },
  asc_3_4: {
    day: 192,
    location: "The Eleven",
    briefing:
      "The Eleven: the suns the Ascendancy broke, now a field of mines and wreckage. The Collective's machine prophets predict the Tide's arrival to the hour, and Prime is counting down. Break the guard around the prediction lattice and learn what the machines think they know.",
    script: [
      atTime(
        25,
        say(
          DREAMER,
          "Prime is counting down. The hour it counts to is the one I have been afraid of since I woke.",
          "grim",
        ),
      ),
    ],
    debriefAppend: [
      debriefLine(
        ARCHON,
        "The machines' prophets have the same hour as ours. The Oracles will call that a coincidence.",
        "grim",
      ),
    ],
  },
};
