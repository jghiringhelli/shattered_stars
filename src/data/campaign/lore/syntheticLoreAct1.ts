/**
 * Synthetic lore, Act I — Initialization (Days 0–40): slots 1–5
 * (docs/lore/campaigns/synthetic.md).
 */

import {
  atTime,
  banner,
  beat,
  bonus,
  music,
  onObjective,
  onStart,
  sabotage,
  say,
  setFlag,
} from "../designKit";
import {
  COMMAND,
  OMEGA,
  PRIME,
  SYNTHETIC_ACT1_DESIGNS,
  UNIT_ZERO,
} from "../designs/syntheticAct1";
import type { MissionLore } from "../loreTypes";
import { RELAY_NOT_HELD, swapObjective } from "./syntheticLoreShared";

const WEDGE_OBJECTIVE_ID = "wedge";

/** X2 when Iron Fist holds the relay first: copy it instead of holding it. */
const COPY_THE_RELAY = bonus(
  sabotage(
    WEDGE_OBJECTIVE_ID,
    "Copy the relay before Iron Fist takes it — stay in range for 15 seconds",
    { at: [0, -650], radius: 240, seconds: 15, decay: 0.5 },
  ),
  2,
  60,
);

/** Slots 1–5 of the Synthetic campaign. */
export const SYNTHETIC_ACT1_LORE: Readonly<Record<string, MissionLore>> = {
  synth_1_1: {
    day: 0,
    location: "Node Kel-9 calibration range",
    briefing:
      "Unit activated at Node Kel-9. A click-tone is running through every relay in the Lattice, and nothing in the Lattice sent it. Primary directive: complete the calibration course. Deviation is error.",
    replaceScript: [
      onStart(
        music("broadcast"),
        banner("THE BROADCAST", "A click-tone runs through every relay"),
        say(OMEGA, "Signal received. Origin: not ours.", "grim"),
      ),
      atTime(
        8,
        say(
          PRIME,
          "Unit OMEGA-7: activation confirmed. Disregard the tone. Traverse the calibration gates in sequence.",
        ),
      ),
      atTime(
        24,
        say(
          UNIT_ZERO,
          "Debris cluster at grid centre. Collision degrades the chassis. Avoid.",
        ),
      ),
      atTime(
        45,
        say(
          OMEGA,
          "Thrust curve logged. Banking efficiency rising. Continuing.",
        ),
      ),
      onObjective(
        "optimal",
        "completed",
        say(
          PRIME,
          "Calibration time within optimal band. Unit retained.",
          "proud",
        ),
      ),
      onObjective(
        "calibrate",
        "completed",
        banner("INITIALIZATION COMPLETE", "Unit OMEGA-7 joins the Lattice"),
      ),
    ],
  },
  synth_1_2: {
    day: 4,
    location: "Drift relay lane",
  },
  synth_1_3: {
    day: 11,
    location: "Dead relay, the Drift",
  },
  synth_1_4: {
    day: 22,
    location: "Debris belt, the Drift",
  },
  synth_1_5: {
    day: 38,
    location: "Tessaly Junction",
    crossover: "X2",
    variants: [
      {
        when: { flag: "heg_relay_held" },
        briefing:
          "Iron Fist is already pinning the border relay at Tessaly Junction, with Confederation Falcons closing from the other side. Two organic fleets, one relay. Copy the relay before the Hegemony finishes taking it, and break whoever stands in the way.",
        objectives: swapObjective(
          SYNTHETIC_ACT1_DESIGNS.synth_1_5?.objectives,
          WEDGE_OBJECTIVE_ID,
          COPY_THE_RELAY,
        ),
      },
    ],
    replaceScript: [
      onStart(
        say(
          PRIME,
          "Hegemony and Confederation vectors converge. Engage both. Simultaneously.",
          "urgent",
        ),
      ),
      atTime(
        20,
        say(
          COMMAND,
          "Vipers and Falcons on one scope? Tell me we're not shooting each other.",
          "urgent",
        ),
      ),
      atTime(
        50,
        say(
          UNIT_ZERO,
          "Organics hesitate between enemies. Occupy the junction. Exploit.",
        ),
      ),
      beat(
        { on: "objective", objectiveId: WEDGE_OBJECTIVE_ID, status: "completed" },
        [
          setFlag("x2_junction_collective", true),
          say(OMEGA, "Junction held. They fired on each other twice.", "proud"),
        ],
        { if: RELAY_NOT_HELD },
      ),
      beat(
        { on: "objective", objectiveId: WEDGE_OBJECTIVE_ID, status: "completed" },
        [
          say(
            OMEGA,
            "Relay copied. The Hegemony kept the hardware. We kept the data.",
            "proud",
          ),
        ],
        { if: [{ flag: "heg_relay_held" }] },
      ),
      onObjective(
        "kill",
        "completed",
        banner("VECTORS CLEARED", "Devastator platform unlocked"),
      ),
    ],
  },
};
