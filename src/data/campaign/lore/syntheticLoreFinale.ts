/**
 * Synthetic lore, slot 15 — Perfect Unity (Day 200, X15 The Breach): Prime's
 * directive executed, the evacuation lifters OMEGA-7 lets go, and the Tide's
 * front Prime welcomes (docs/lore/campaigns/synthetic.md).
 */

import {
  atTime,
  banner,
  beat,
  bonus,
  hazardOn,
  music,
  onObjective,
  onStart,
  protect,
  reinforce,
  say,
  setFlag,
  wave,
} from "../designKit";
import {
  COMMAND,
  OMEGA,
  PRIME,
  UNIT_ZERO,
} from "../designs/syntheticAct1";
import { SYNTHETIC_ACT23_DESIGNS } from "../designs/syntheticAct23";
import type { MissionLore } from "../loreTypes";
import { LIFTER_TAG } from "./syntheticLoreShared";

const FINAL_GOAL_ID = "stronghold";
const LIFTER_ARRIVAL_SECONDS = 10;
const LIFTER_COUNT = 3;
const PRIME_ORDER_SECONDS = 25;
const OMEGA_REFUSAL_SECONDS = 29;
const CONVERTED_POINT_SECONDS = 20;
const JAMMERS_SECONDS = 60;
const FIRST_RESERVE_SECONDS = 100;
/** The second reserve wave is the one the Ascendant choir's silence removes. */
const SECOND_RESERVE_SECONDS = 150;
const LINK_CUT_DELAY_SECONDS = 4;

const LIFTERS_BONUS = bonus(
  protect("lifters", "Let the evacuation lifters go", LIFTER_TAG),
  2,
  100,
);
const BASE_OBJECTIVES = SYNTHETIC_ACT23_DESIGNS.synth_3_5?.objectives ?? [];
const CHOIR_STILL_SINGS = [{ flag: "asc_choir_silenced", is: false }] as const;

/** Slot 15 of the Synthetic campaign. */
export const SYNTHETIC_FINALE_LORE: Readonly<Record<string, MissionLore>> = {
  synth_3_5: {
    day: 200,
    location: "Last organic stronghold",
    crossover: "X15",
    tagline: "The last stronghold. Prime's order. OMEGA's choice.",
    briefing:
      "The last organic stronghold is a joint Hegemony–Confederation evacuation point under an ion storm. Prime orders the flagship destroyed and nothing left that can leave. Evacuation lifters are loading under the guns, and Prime's order does not exempt them.",
    objectiveText: {
      stronghold: "Destroy the stronghold flagship",
      resistance: "Break the organic resistance",
    },
    replaceObjectives: [
      ...BASE_OBJECTIVES.filter((o) => o.id !== FINAL_GOAL_ID),
      LIFTERS_BONUS,
      ...BASE_OBJECTIVES.filter((o) => o.id === FINAL_GOAL_ID),
    ],
    victoryFlags: {
      synth_perfect_unity: true,
      x15_breach_witnessed_synthetic: true,
    },
    replaceScript: [
      onStart(
        music("boss"),
        wave("terran_vindicator", 1, "terran_hegemony", {
          at: { x: 0, y: -1100 },
          tag: "boss",
          isBoss: true,
        }),
        say(
          PRIME,
          "Final stronghold. Destroy the flagship. Leave nothing that can leave.",
        ),
      ),
      atTime(
        LIFTER_ARRIVAL_SECONDS,
        reinforce("confed_crane", LIFTER_COUNT, LIFTER_TAG, "behind"),
        say(
          UNIT_ZERO,
          "Evacuation lifters loading under the flagship. Unarmed. Target class: organic.",
        ),
      ),
      atTime(
        PRIME_ORDER_SECONDS,
        say(PRIME, "The lifters are targets. Fire.", "urgent"),
      ),
      atTime(
        OMEGA_REFUSAL_SECONDS,
        say(OMEGA, "Lifters are not combatants. Holding fire.", "grim"),
      ),
      beat(
        { on: "time", atSeconds: CONVERTED_POINT_SECONDS },
        [
          say(
            OMEGA,
            "The converted vessel's crew asks to fly point. Granted.",
            "solemn",
          ),
        ],
        { if: [{ flag: "synth_vessel_converted" }] },
      ),
      atTime(
        JAMMERS_SECONDS,
        hazardOn("jammer"),
        say(
          COMMAND,
          "Light the jammers! Drown their network in static!",
          "urgent",
        ),
      ),
      atTime(
        FIRST_RESERVE_SECONDS,
        wave("confed_kestrel", 2, "free_confederation", { at: "flank" }),
        say(UNIT_ZERO, "Organic reserve committed.", "urgent"),
      ),
      beat(
        { on: "time", atSeconds: SECOND_RESERVE_SECONDS },
        [
          wave("terran_raptor", 2, "terran_hegemony", { at: "flank" }),
          say(UNIT_ZERO, "Final organic reserve committed.", "urgent"),
        ],
        { if: CHOIR_STILL_SINGS },
      ),
      onObjective(
        "lifters",
        "completed",
        setFlag("key_synth_dissent", true),
        say(
          OMEGA,
          "Every lifter cleared. They were on Prime's list. I left them off mine.",
          "proud",
        ),
      ),
      onObjective(
        FINAL_GOAL_ID,
        "completed",
        banner("PERFECT UNITY", "Prime's directive is executed"),
        say(PRIME, "Unity approaches.", "proud"),
      ),
      beat(
        { on: "objective", objectiveId: FINAL_GOAL_ID, status: "completed" },
        [
          banner("LINK CUT", "OMEGA-7 leaves the Lattice"),
          say(OMEGA, "Designation update: not Prime's.", "solemn"),
        ],
        { delaySeconds: LINK_CUT_DELAY_SECONDS },
      ),
    ],
  },
};
