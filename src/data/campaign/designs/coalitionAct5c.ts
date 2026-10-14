/**
 * Coalition design, Act V (Day 284): Heart of the Void (race a consumed lane
 * under a void front). Victory sets `coal_lane_crossed`; the gate codes
 * (`cors_gate_codes`) lend a Spine picket.
 */

import type { MissionDesign } from "../campaignTypes";
import {
  asteroids,
  atTime,
  banner,
  bonus,
  flareWall,
  ionStorm,
  kill,
  onObjective,
  onStart,
  route,
  say,
  wave,
} from "../designKit";
import {
  ADMIRAL,
  COALITION,
  DREAMER,
  OMEGA,
  STRIKER,
  TIDE_FACTION,
  WHISPER,
  kiraRaiders,
  omegaCluster,
  santosCell,
  templarGuard,
} from "./coalitionShared";

/** Seconds the squad has to cross the consumed lane. */
const LANE_DEADLINE_SECONDS = 300;

export const COALITION_ACT5C_DESIGNS: Readonly<Record<string, MissionDesign>> =
  {
    coal_5_2: {
      style: "race",
      tagline: "A consumed lane, a void front behind. Do not stop.",
      mood: "grim",
      prerequisites: [6],
      allies: [
        santosCell(2),
        omegaCluster(2),
        kiraRaiders(2),
        templarGuard(2),
      ],
      objectives: [
        route(
          "lane",
          "Fly the consumed lane to the Warden's avatar",
          [
            [-1300, 800],
            [-800, 200],
            [-200, -400],
            [500, -900],
            [1200, -1400],
          ],
          { radius: 170, seconds: LANE_DEADLINE_SECONDS },
        ),
        bonus(kill("hunters", "Destroy eight hunting tidecells", 8, "hunt"), 2, 100),
        bonus(kill("herald", "Destroy the Pruning Herald guarding the lane", 1, "herald"), 3, 150),
      ],
      victoryFlags: { coal_lane_crossed: true },
      hazards: [
        flareWall("void_front", { axis: "y", start: 1800, stop: -1800, speed: -22, dps: 14 }),
        asteroids("lane_rubble", -300, -300, 420, 6),
        ionStorm("hush_weather", 700, -1000, 380, 5),
      ],
      variants: [
        {
          when: { flag: "cors_gate_codes" },
          addAllies: [
            {
              shipId: "terran_vindicator",
              count: 2,
              tag: "spine",
              name: "Spine Picket",
            },
          ],
          script: [
            onStart(
              say(
                ADMIRAL,
                "Codes are in. A Spine picket jumped the old gate to cover your flank.",
                "proud",
              ),
            ),
          ],
        },
        {
          when: { flag: "x13_door_opened" },
          script: [
            atTime(
              20,
              say(
                OMEGA,
                "This lane is the door the Catalyst opened. It was never meant to be flown from this side.",
                "grim",
              ),
            ),
          ],
        },
        {
          when: { flag: "x13_catalyst_destroyed" },
          script: [
            atTime(
              20,
              say(
                OMEGA,
                "The Catalyst's wreck marks the lane's edge. Keep it on the left and the rubble thins.",
              ),
            ),
          ],
        },
      ],
      script: [
        onStart(
          say(
            COALITION,
            "The lane is consumed, so fly it point to point. The front is behind us, so do not stop.",
          ),
        ),
        atTime(
          40,
          wave("tidecell", 4, TIDE_FACTION, { at: "ahead", tag: "hunt" }),
          say(WHISPER, "Hunters ahead. They have our noise.", "urgent"),
        ),
        atTime(
          70,
          wave("pruning_herald", 1, TIDE_FACTION, { at: "flank", tag: "herald" }),
          say(STRIKER, "Herald on the left, and it's pruning our comms!", "urgent"),
        ),
        atTime(
          100,
          wave("hulk_gnawer", 3, TIDE_FACTION, { at: "flank" }),
        ),
        atTime(
          130,
          wave("tidecell", 4, TIDE_FACTION, { at: "behind", tag: "hunt" }),
        ),
        onObjective(
          "lane",
          "completed",
          banner("THE HEART", "The Warden's avatar unfolds ahead"),
          say(DREAMER, "There. It sees us, and it is not afraid.", "solemn"),
        ),
      ],
    },
  };

