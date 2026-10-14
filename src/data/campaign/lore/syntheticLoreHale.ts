/**
 * Synthetic lore, slot 10 — Organic Command (Day 112, X9 Hale's Run): the
 * first campaign to finish the crossover writes the canon; the other side
 * plays an adapted mission (docs/lore/campaigns/synthetic.md).
 */

import {
  atTime,
  banner,
  beat,
  hit,
  kill,
  onStart,
  reinforce,
  say,
  setFlag,
} from "../designKit";
import { OMEGA, PRIME, UNIT_ZERO } from "../designs/syntheticAct1";
import { SYNTHETIC_ACT23_DESIGNS } from "../designs/syntheticAct23";
import type { MissionLore } from "../loreTypes";
import {
  HALE,
  HALE_NOT_DOWN,
  HALE_NOT_ESCAPED,
  swapObjective,
} from "./syntheticLoreShared";

const COMMANDER_ID = "commander";
const HALE_SHIP = "terran_sentinel";
const HALE_POSITION = [0, -1000] as const;
/** Hull of Hale's flagship once Corsair gunnery has already broken it. */
const CRIPPLED_HULL_SCALE = 0.6;
/** Enemy ships at the Crossing: four Vipers and the Bastion guard. */
const REAR_GUARD_COUNT = 5;
const PIRATE_ARRIVAL_SECONDS = 40;
const DRIVE_SPOOL_SECONDS = 80;

const HALE_STILL_THERE = [...HALE_NOT_ESCAPED, ...HALE_NOT_DOWN] as const;
const BASE_OBJECTIVES = SYNTHETIC_ACT23_DESIGNS.synth_2_5?.objectives;

/** Slot 10 of the Synthetic campaign. */
export const SYNTHETIC_HALE_LORE: Readonly<Record<string, MissionLore>> = {
  synth_2_5: {
    day: 112,
    location: "Varn's Crossing",
    crossover: "X9",
    briefing:
      "Commodore Hale, Kronos's escort commander, runs the Hegemony's coordination across Varn's Crossing. Remove him and the organics lose their pattern. Corsair ships are hitting the same target from the far side. Do not engage them.",
    objectiveText: {
      commander: "Terminate Commodore Hale before his command ship escapes",
    },
    variants: [
      {
        when: { flag: "x9_hale_down" },
        briefing:
          "Corsair gunnery has already broken Commodore Hale's flagship from the far side of Varn's Crossing. Finish the hull before the Hegemony tows it clear. The Corsair ships are still on station. Do not engage them.",
        objectives: swapObjective(
          BASE_OBJECTIVES,
          COMMANDER_ID,
          hit(COMMANDER_ID, "Finish Commodore Hale's crippled command ship", {
            shipId: HALE_SHIP,
            at: HALE_POSITION,
            hullScale: CRIPPLED_HULL_SCALE,
          }),
        ),
        script: [
          atTime(
            5,
            say(
              UNIT_ZERO,
              "Command ship breached from the far side. The pirates did the work. Finish it.",
            ),
          ),
        ],
      },
      {
        when: { flag: "x9_hale_escaped" },
        briefing:
          "Commodore Hale has already slipped the Corsair net at Varn's Crossing and is running for Kronos's lines. His rear guard has not run. Cut it down before the Hegemony regroups. The Corsair ships are still on station. Do not engage them.",
        objectives: swapObjective(
          BASE_OBJECTIVES,
          COMMANDER_ID,
          kill(COMMANDER_ID, "Cut down Hale's rear guard", REAR_GUARD_COUNT),
        ),
        script: [
          atTime(
            5,
            say(
              OMEGA,
              "Hale is already gone. His rear guard is not. Take what he left.",
              "grim",
            ),
          ),
          beat(
            { on: "objective", objectiveId: COMMANDER_ID, status: "completed" },
            [
              banner("REAR GUARD BROKEN", "Hale is beyond the Crossing"),
              say(PRIME, "Commander not terminated. Variance noted.", "neutral"),
            ],
          ),
        ],
      },
    ],
    replaceScript: [
      onStart(
        say(
          PRIME,
          "Commodore Hale, Kronos's escort commander, aboard the command ship. Terminate. Escorts are irrelevant.",
        ),
      ),
      beat(
        { on: "time", atSeconds: 30 },
        [
          say(
            HALE,
            "They're coming for me. Keep that Bastion between us and them!",
            "urgent",
          ),
        ],
        { if: HALE_NOT_ESCAPED },
      ),
      atTime(
        PIRATE_ARRIVAL_SECONDS,
        reinforce("corsair_talon", 2, "pirates", "flank"),
        say(
          UNIT_ZERO,
          "Organic pirates share our objective. Do not engage them.",
        ),
      ),
      beat(
        { on: "time", atSeconds: DRIVE_SPOOL_SECONDS },
        [
          say(
            UNIT_ZERO,
            "Command ship drive spooling. Escape window closing.",
            "urgent",
          ),
        ],
        { if: HALE_STILL_THERE },
      ),
      beat(
        { on: "objective", objectiveId: COMMANDER_ID, status: "completed" },
        [
          setFlag("x9_hale_down", true),
          banner("COMMAND SEVERED", "Organic coordination collapsing"),
          say(
            OMEGA,
            "Hale is down. The pirates will claim it. The claim is irrelevant.",
            "proud",
          ),
        ],
        { if: HALE_NOT_ESCAPED },
      ),
      beat(
        { on: "objective", objectiveId: COMMANDER_ID, status: "failed" },
        [
          setFlag("x9_hale_escaped", true),
          say(OMEGA, "He escaped. He will remember our pattern.", "grim"),
        ],
        { if: HALE_NOT_DOWN },
      ),
    ],
  },
};
