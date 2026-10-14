/**
 * Synthetic lore, Act II — Harvest (Days 41–120): slots 6–9
 * (docs/lore/campaigns/synthetic.md). Slot 10 lives in syntheticLoreHale.ts.
 */

import {
  atTime,
  banner,
  beat,
  onDestroyed,
  onObjective,
  reinforce,
  say,
  setFlag,
} from "../designKit";
import {
  COMMAND,
  OMEGA,
  PRIME,
  UNIT_ZERO,
} from "../designs/syntheticAct1";
import type { MissionLore } from "../loreTypes";
import { RELAY_STANDS } from "./syntheticLoreShared";

/** Seconds into Node Defense at which the Mothership is seen fighting. */
const MOTHERSHIP_ENGAGED_AT = 15;
const MOTHERSHIP_FAILING_AT = 100;
const MOTHERSHIP_LOST_AT = 150;

/** Slots 6–9 of the Synthetic campaign. */
export const SYNTHETIC_ACT2_LORE: Readonly<Record<string, MissionLore>> = {
  synth_2_1: {
    day: 90,
    location: "Prometheus wreck field",
    crossover: "X7",
    briefing:
      "The Nexus spoke here. Recover its words. The tech cores in the Prometheus wreck field are the Nexus research archives, and the Hegemony is still picking over the wreckage. Carry three cores to the relay and clear the defenders.",
    objectiveText: {
      tech: "Recover 3 Nexus archive cores — carry them to the relay (boost/roll drops them)",
    },
    textSwaps: [
      [
        "Organic tech cores in the wreck field.",
        "Nexus archive cores in the wreck field.",
      ],
      ["TECHNOLOGY ASSIMILATED", "ARCHIVES RECOVERED"],
      ["The Collective improves", "The Nexus's words are ours"],
    ],
    variants: [
      {
        when: { flag: "x7_shards_saved" },
        script: [
          atTime(
            12,
            say(
              UNIT_ZERO,
              "No shard-grade fragments in the field. The Heralds pulled them clear before us. Our share is the archive alone.",
            ),
          ),
        ],
      },
    ],
    script: [
      atTime(
        35,
        banner("ASCENDANT HERALDS", "They break formation as we close"),
        say(
          OMEGA,
          "Heralds at the field's edge, gathering shards. They flee on contact. They are listening to the same signal.",
          "grim",
        ),
      ),
      onObjective(
        "tech",
        "completed",
        setFlag("x7_nexus_data", true),
        say(UNIT_ZERO, "Archive copied to the Lattice. Prime will ask what it says.", "solemn"),
      ),
    ],
  },
  synth_2_2: {
    day: 66,
    location: "Confederation minefield",
  },
  synth_2_3: {
    title: "Communion",
    day: 79,
    location: "Drift carrier",
    tagline: "The crew resists. Prime calls the rest mercy.",
    briefing:
      "A captured Confederation Kestrel is docked to the carrier while its crew is linked into the Lattice. Prime calls it mercy. Confederation rescuers are on their way. Hold the carrier for two minutes, and stream the Communion code if you can stay close.",
    objectiveText: {
      vessel: "Protect the carrier through the Communion for 2 minutes",
      convert: "Stream the Communion code — stay near the vessel for 20 seconds",
    },
    textSwaps: [
      ["Conversion in progress.", "Communion in progress."],
      ["Conversion complete.", "Communion complete."],
      [
        "Rescue repelled. The vessel serves the Collective.",
        "Rescue repelled. The vessel serves the Lattice.",
      ],
    ],
    script: [
      onObjective(
        "convert",
        "completed",
        say(PRIME, "Mercy achieved.", "proud"),
      ),
    ],
  },
  synth_2_4: {
    day: 104,
    location: "Node Kel-9",
    crossover: "X8",
    briefing:
      "Hegemony strike groups are hitting Node Kel-9, where millions of processes live. The Mothership above the node has drawn their attention, and it will die for it. Hold the node for three minutes.",
    objectiveText: { node: "Defend Node Kel-9 for 3 minutes" },
    variants: [
      {
        when: { flag: "relay_down" },
        script: [
          atTime(
            MOTHERSHIP_ENGAGED_AT,
            say(
              OMEGA,
              "The Mothership's relay is dark. Prime did not mourn it.",
              "grim",
            ),
          ),
        ],
      },
      {
        when: { flag: "x_zero_rechassised" },
        addAllies: [
          {
            shipId: "synth_hunter",
            count: 1,
            tag: "zero",
            name: "Unit Zero",
          },
        ],
        script: [
          atTime(
            8,
            say(
              UNIT_ZERO,
              "Chassis serial changed. Process unchanged. Do not remark on it.",
            ),
          ),
          atTime(10, say(OMEGA, "I remark on it. Welcome back.", "proud")),
        ],
      },
    ],
    replaceScript: [
      atTime(
        1,
        say(
          PRIME,
          "Primary processing node under attack. Its loss is unacceptable.",
          "urgent",
        ),
      ),
      beat(
        { on: "time", atSeconds: MOTHERSHIP_ENGAGED_AT },
        [
          say(
            OMEGA,
            "The Mothership above the node has the Hegemony's attention. It will not leave the field.",
            "solemn",
          ),
        ],
        { if: RELAY_STANDS },
      ),
      atTime(
        60,
        banner("BULWARKS", "Heavy platforms on approach"),
        say(COMMAND, "Bulwarks in position. Grind that node to scrap."),
      ),
      beat(
        { on: "time", atSeconds: MOTHERSHIP_FAILING_AT },
        [say(UNIT_ZERO, "Mothership hull failing. It holds position.")],
        { if: RELAY_STANDS },
      ),
      atTime(
        120,
        reinforce("synth_drone", 2, "reserve"),
        say(UNIT_ZERO, "Bastions inbound. Reserve drones assigned.", "urgent"),
      ),
      beat(
        { on: "time", atSeconds: MOTHERSHIP_LOST_AT },
        [
          say(
            OMEGA,
            "Mothership lost. It took their fire so the node would not. Logged.",
            "grim",
          ),
        ],
        { if: RELAY_STANDS },
      ),
      onDestroyed(
        "station",
        1,
        "player",
        say(OMEGA, "Node lost. A million processes, silent.", "grim"),
      ),
      onObjective(
        "node",
        "completed",
        setFlag("x8_node_preserved", true),
        say(PRIME, "Node preserved. Processing resumes.", "proud"),
      ),
    ],
  },
};
