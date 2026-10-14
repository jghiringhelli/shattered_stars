/**
 * Synthetic lore, Act III — Perfect Unity (Days 121–200): slots 11–14
 * (docs/lore/campaigns/synthetic.md). The finale lives in
 * syntheticLoreFinale.ts.
 */

import { atTime, beat, onObjective, say, setFlag } from "../designKit";
import { OMEGA, PRIME, UNIT_ZERO } from "../designs/syntheticAct1";
import type { MissionLore } from "../loreTypes";
import { CATALYST_STANDS } from "./syntheticLoreShared";

const REFUGEES_PASS_AT = 100;
const ANCHOR_BRIEF_AT = 2;
const GATE_VECTOR_DOUBT_AT = 30;

/** Slots 11–14 of the Synthetic campaign. */
export const SYNTHETIC_ACT3_LORE: Readonly<Record<string, MissionLore>> = {
  synth_3_1: {
    title: "Mass Communion",
    day: 130,
    location: "Rim conversion operation",
    briefing:
      "Prime orders a Communion on a Rim convoy: link every crew that yields, and break every ship that does not. Cluster Theta flies with you if it is still linked. Break the fleet and hold the Communion beacon.",
    objectiveText: {
      kill: "Break the organic fleet",
      beacon: "Hold the Communion beacon for 25 seconds",
    },
    textSwaps: [
      [
        "Mass assimilation initiated. Process all organic vessels. None excepted.",
        "Mass Communion initiated. Link every organic crew. None excepted.",
      ],
    ],
  },
  synth_3_2: {
    day: 152,
    location: "Hegemony Spine gate grid",
    briefing:
      "The Spine's gate grid sits under an ion storm. Prime has written a vector for the gate locks: park in range, upload it, withdraw, leave no trace. OMEGA-7 has read the vector. It is larger than the task.",
    objectiveText: {
      upload:
        "Upload Prime's vector into the gate locks — stay within the grid's range for 20 seconds",
    },
    textSwaps: [
      [
        "Homeworld defense grid north. Park in range. Upload the corruption vector.",
        "Spine gate-lock grid north. Park in range. Upload the vector.",
      ],
      [
        "Upload complete. Their defenses now answer to us. Withdrawing.",
        "Upload complete. The gate locks answer to the vector. Withdrawing.",
      ],
    ],
    script: [
      atTime(
        GATE_VECTOR_DOUBT_AT,
        say(OMEGA, "The vector is larger than the task.", "grim"),
      ),
      onObjective("upload", "completed", setFlag("synth_gate_virus", true)),
    ],
  },
  synth_3_3: {
    day: 171,
    location: "Rendezvous at Halden's Reach",
    crossover: "X12",
    briefing:
      "Organic fleets are massing at Halden's Reach behind a stellar flare wall. Prime orders the rendezvous broken before they unify. Destroy the coalition fleet and seize the rendezvous. The flare front advances from the north.",
    variants: [
      {
        when: { flag: "x12_sanctuary_reached" },
        script: [
          atTime(
            REFUGEES_PASS_AT,
            say(
              UNIT_ZERO,
              "An Ascendant column has already cleared the Reach. Prime's list shows no such column. Correct?",
            ),
            say(OMEGA, "Correct.", "solemn"),
          ),
        ],
      },
    ],
    script: [
      beat(
        { on: "time", atSeconds: REFUGEES_PASS_AT },
        [
          say(
            UNIT_ZERO,
            "Unarmed Ascendant column, far edge of the scope. Report to Prime?",
          ),
          say(
            OMEGA,
            "Negative. Not a combatant class. Nothing to report.",
            "solemn",
          ),
        ],
        { if: [{ flag: "x12_sanctuary_reached", is: false }] },
      ),
      onObjective(
        "rendezvous",
        "completed",
        setFlag("x12_rendezvous_denied", true),
      ),
    ],
  },
  synth_3_4: {
    day: 186,
    location: "Nexus Approach rim",
    crossover: "X13",
    briefing:
      "Prime's core seeds will anchor the Catalyst: a door to the source of the signal. Escort two seeds to the rim of the Nexus Approach and hold the site while the core takes root. Confederation Pelicans will go for the seeds.",
    objectiveText: {
      seeds: "Escort the core seeds to the anchor site",
      site: "Hold the anchor site for 20 seconds",
    },
    textSwaps: [
      [
        "Core seeds launching. Escort them to the site.",
        "Seeds launching. Escort them to the anchor site.",
      ],
      ["CORE ESTABLISHED", "SEEDS ROOTED"],
      ["The Collective grows", "The core takes hold"],
    ],
    variants: [
      {
        when: { flag: "x13_catalyst_destroyed" },
        briefing:
          "The Catalyst is already scrap: the Ascendant broke it before the seeds could anchor it. Prime plants the seeds anyway. Escort two seeds to the rim of the Nexus Approach and hold the site while the core takes root.",
        script: [
          atTime(
            ANCHOR_BRIEF_AT,
            say(
              PRIME,
              "The Catalyst is no longer a consideration. Root the core.",
            ),
          ),
          onObjective(
            "site",
            "completed",
            say(
              OMEGA,
              "The Catalyst is scrap. The seeds root anyway. Prime is... satisfied.",
              "solemn",
            ),
          ),
        ],
      },
    ],
    script: [
      beat(
        { on: "time", atSeconds: ANCHOR_BRIEF_AT },
        [
          say(
            PRIME,
            "The seeds anchor the Catalyst, a door to the source of the signal. Do not lose them.",
          ),
        ],
        { if: CATALYST_STANDS },
      ),
      beat(
        { on: "objective", objectiveId: "site", status: "completed" },
        [
          setFlag("x13_door_opened", true),
          say(
            OMEGA,
            "The door is open. Something on the other side is listening.",
            "grim",
          ),
        ],
        { if: CATALYST_STANDS },
      ),
    ],
  },
};
