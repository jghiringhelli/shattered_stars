/**
 * Free Confederation designs, Act I (slots 1-5) — "The Rebel's Path":
 * objectives, comms beats, hazards and bonus objectives. Offsets in px from
 * the battlefield centre (player squad starts at 0,+220; enemies at 0,-220).
 * Story consequence: conf_1_4 holding the crash site sets `conf_crash_data`
 * → conf_2_1 knows the convoy's schedule.
 */

import type { MissionDesign } from "../campaignTypes";
import {
  asteroids,
  atTime,
  banner,
  bonus,
  defend,
  escort,
  hidden,
  hold,
  kill,
  onDestroyed,
  onObjective,
  onStart,
  protect,
  reveal,
  route,
  salvage,
  say,
  setFlag,
  stealth,
  survive,
  wave,
  within,
  type Speaker,
} from "../designKit";

export const SANTOS: Speaker = {
  name: "SANTOS",
  portraitKey: "portrait_commander_santos",
};
export const PHOENIX: Speaker = {
  name: "PHOENIX ONE",
  portraitKey: "portrait_phoenix_one",
};
export const VASQUEZ: Speaker = {
  name: "DOC VASQUEZ",
  portraitKey: "portrait_doc_vasquez",
};
export const COMMAND: Speaker = {
  name: "COMMAND",
  portraitKey: "portrait_command",
};

const GATES: [number, number][] = [
  [400, -200],
  [900, -800],
  [100, -1300],
  [-800, -800],
  [-500, 100],
];

export const CONFEDERATION_ACT1_DESIGNS: Readonly<
  Record<string, MissionDesign>
> = {
  conf_1_1: {
    style: "race",
    tagline: "A stolen fighter. A borrowed sky. Learn fast.",
    mood: "neutral",
    objectives: [
      route("gates", "Fly the smuggler's gate run", GATES, { radius: 150 }),
      bonus(
        route("fast", "Clear the run in 80 seconds", GATES, {
          radius: 150,
          seconds: 80,
        }),
        1,
        40,
      ),
    ],
    hazards: [asteroids("debris", -150, -650, 260, 4, 1800)],
    script: [
      onStart(
        say(
          PHOENIX,
          "Welcome to the Confederation, Libre One. Follow the gates. Don't hit the rocks.",
        ),
      ),
      atTime(
        20,
        say(
          SANTOS,
          "Controls are sluggish. Hegemony scrap with a rebel paint job.",
        ),
      ),
      atTime(
        45,
        say(
          PHOENIX,
          "Bank wide around the debris. Hull plating costs more than pride.",
        ),
      ),
      onObjective(
        "fast",
        "completed",
        say(VASQUEZ, "Fast hands. Try not to bring them back broken.", "proud"),
      ),
      onObjective(
        "gates",
        "completed",
        banner("RUN COMPLETE", "Welcome to the cell, Libre One"),
      ),
    ],
  },
  conf_1_2: {
    style: "assault",
    tagline: "One patrol. One shot. Make them afraid.",
    mood: "urgent",
    objectives: [
      kill("kill", "Destroy the Hegemony patrol", 1),
      bonus(
        within(kill("quick", "Down the patrol within 60 seconds", 1), 60),
        1,
        40,
      ),
    ],
    script: [
      onStart(
        say(
          COMMAND,
          "Lone Viper on a census sweep. Show them the Confederation fights back.",
          "urgent",
        ),
      ),
      atTime(
        15,
        say(
          PHOENIX,
          "He'll call for help if you let him run. Stay on his six.",
        ),
      ),
      atTime(
        35,
        say(
          SANTOS,
          "Every second he breathes, he's broadcasting our position.",
          "grim",
        ),
      ),
      onObjective(
        "kill",
        "completed",
        say(
          PHOENIX,
          "First blood, Libre One. They'll know your name soon.",
          "proud",
        ),
      ),
    ],
  },
  conf_1_3: {
    style: "stealth",
    tagline: "Hit the convoy. Vanish before the sirens.",
    mood: "grim",
    objectives: [
      kill("convoy", "Destroy the supply convoy", 3),
      hidden(
        route("vanish", "Disappear into the debris field", [[-1400, 900]], {
          extraction: true,
        }),
      ),
      bonus(
        stealth(
          "quiet",
          "Stay clear of the sensor buoys",
          [
            [-750, -500],
            [750, -500],
          ],
          { radius: 340 },
        ),
        2,
        60,
      ),
      bonus(protect("cell", "All pilots survive", "squad"), 1, 50),
    ],
    script: [
      onStart(
        say(
          PHOENIX,
          "Two sensor buoys flank the lane. Come up the middle, hit hard, get out.",
        ),
      ),
      atTime(
        25,
        say(SANTOS, "Raptor's riding herd on the freighters. Take it first."),
      ),
      onObjective(
        "quiet",
        "failed",
        say(COMMAND, "Buoys tripped! Reaction force inbound!", "urgent"),
        wave("terran_viper", 2, "terran_hegemony", { at: "ahead" }),
      ),
      onObjective(
        "convoy",
        "completed",
        reveal("vanish"),
        say(
          PHOENIX,
          "Convoy's burning. Break south-west and go dark.",
          "urgent",
        ),
      ),
      onObjective(
        "cell",
        "failed",
        say(VASQUEZ, "We lost one. Bring the rest home.", "solemn"),
      ),
    ],
  },
  conf_1_4: {
    style: "salvage",
    tagline: "A wreck full of secrets. Carry them gently.",
    objectives: [
      salvage(
        "tech",
        "Carry 2 tech cores to the drop zone (boost/roll drops them)",
        {
          crates: [
            [-700, -700],
            [650, -800],
            [0, -1150],
          ],
          dropZone: [0, 450],
          required: 2,
        },
      ),
      bonus(
        hold("site", "Hold the crash site for 20 seconds", {
          at: [0, -800],
          radius: 240,
          seconds: 20,
        }),
        1,
        60,
      ),
      bonus(kill("raptor", "Destroy all Hegemony responders", 4), 1, 40),
    ],
    script: [
      onStart(
        say(
          VASQUEZ,
          "Tech cores are fragile. Boost or roll with one aboard and you'll drop it.",
        ),
      ),
      atTime(
        45,
        say(
          COMMAND,
          "Hegemony Raptor dropping in. They want their wreck back.",
          "urgent",
        ),
      ),
      atTime(
        90,
        say(PHOENIX, "Keep it smooth, Libre One. No heroics with the cargo."),
      ),
      onObjective(
        "site",
        "completed",
        setFlag("conf_crash_data", true),
        say(
          VASQUEZ,
          "Crash logs downloaded. Convoy routes, shipping schedules — all of it.",
          "proud",
        ),
      ),
      onObjective(
        "tech",
        "completed",
        banner("SALVAGE SECURED", "Vasquez gets to work"),
      ),
    ],
  },
  conf_1_5: {
    style: "defense",
    tagline: "They found the nest. Buy the evacuation time.",
    mood: "urgent",
    objectives: [
      defend("base", "Protect the hidden base for 2 minutes", {
        at: [0, 520],
        shipId: "confed_heron",
        seconds: 120,
        hullScale: 1.5,
      }),
      survive("hold", "Survive until the evacuation jumps", 120),
      bonus(
        escort("evac", "Escort the evacuation ships to the jump point", {
          path: [
            [-200, 650],
            [-900, 1100],
            [-1600, 1500],
          ],
          shipId: "confed_crane",
          count: 2,
          maxLosses: 0,
          speed: 50,
        }),
        2,
        80,
      ),
    ],
    script: [
      onStart(
        say(
          SANTOS,
          "Base is lit up on every Hegemony scope. Two minutes, people. Hold.",
          "urgent",
        ),
      ),
      atTime(
        60,
        banner("SECOND WAVE", "Raptors on approach"),
        say(PHOENIX, "Raptors! Keep them off the Heron!", "urgent"),
      ),
      atTime(
        90,
        wave("terran_viper", 2, "terran_hegemony", { at: "flank" }),
        say(COMMAND, "More Vipers on the flank. Thirty seconds."),
      ),
      onDestroyed(
        "transport",
        1,
        "player",
        say(VASQUEZ, "We lost a transport. Families were aboard.", "solemn"),
      ),
      onObjective(
        "base",
        "completed",
        say(SANTOS, "Last ship's away. Burn the base and follow.", "grim"),
      ),
    ],
  },
};
