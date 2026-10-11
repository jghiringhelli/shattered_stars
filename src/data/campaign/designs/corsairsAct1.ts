/**
 * Void Corsairs designs, Act I (slots 1-5) — "The Plunder Path": objectives,
 * comms beats, hazards and bonus objectives. Offsets in px from the
 * battlefield centre (player squad starts at 0,+220; enemies at 0,-220).
 */

import type { MissionDesign } from "../campaignTypes";
import {
  asteroids,
  atTime,
  banner,
  bonus,
  defend,
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
  stealth,
  wave,
  within,
  type Speaker,
} from "../designKit";

export const KIRA: Speaker = {
  name: "KIRA",
  portraitKey: "portrait_captain_kira",
};
export const ADMIRAL: Speaker = {
  name: "THE ADMIRAL",
  portraitKey: "portrait_the_admiral",
};
export const BLOODFANG: Speaker = {
  name: "BLOODFANG",
  portraitKey: "portrait_bloodfang",
};
export const COMMAND: Speaker = {
  name: "COMMAND",
  portraitKey: "portrait_command",
};

const SHAKEDOWN: [number, number][] = [
  [300, -300],
  [900, -900],
  [300, -1500],
  [-600, -1200],
  [-1100, -400],
  [-400, 300],
];

export const CORSAIR_ACT1_DESIGNS: Readonly<Record<string, MissionDesign>> = {
  cors_1_1: {
    style: "race",
    tagline: "New blood. Old rocks. Fly or scrape.",
    mood: "neutral",
    objectives: [
      route("run", "Fly Blackmaw's shakedown run", SHAKEDOWN, { radius: 150 }),
      bonus(
        route("fast", "Clear the run in 75 seconds", SHAKEDOWN, {
          radius: 150,
          seconds: 75,
        }),
        1,
        40,
      ),
    ],
    hazards: [
      asteroids("rocks", 600, -1200, 320, 5, 1600),
      asteroids("teeth", -900, -800, 260, 5, 1600),
    ],
    script: [
      onStart(
        say(
          ADMIRAL,
          "Blackmaw takes no passengers, Kira. Run the markers. Don't kiss the rocks.",
        ),
      ),
      atTime(
        20,
        say(
          BLOODFANG,
          "Corsairs don't brake. Corsairs bank. Feel the Talon slide.",
        ),
      ),
      atTime(
        50,
        say(
          ADMIRAL,
          "Boost through the straights, roll around the rocks. That's the whole trade.",
        ),
      ),
      onObjective(
        "fast",
        "completed",
        say(BLOODFANG, "Ha! The kid's got teeth. Buy her a drink.", "proud"),
      ),
      onObjective(
        "run",
        "completed",
        banner("SHAKEDOWN COMPLETE", "Welcome aboard the Black Maw"),
      ),
    ],
  },
  cors_1_2: {
    style: "assault",
    tagline: "A fat merchant. One guard. Easy money.",
    mood: "urgent",
    objectives: [
      salvage(
        "pods",
        "Haul 2 jettisoned cargo pods home (boost/roll drops them)",
        {
          crates: [
            [-500, -700],
            [450, -850],
            [0, -1150],
          ],
          dropZone: [0, 500],
          required: 2,
        },
      ),
      kill("kill", "Destroy the merchant's escort", 1),
      bonus(
        within(kill("quick", "Down the escort within 60 seconds", 1), 60),
        1,
        40,
      ),
    ],
    script: [
      onStart(
        say(
          ADMIRAL,
          "Merchant dumped cargo to run lighter. Kill the guard, then scoop the pods.",
        ),
      ),
      atTime(
        15,
        say(
          COMMAND,
          "Falcon Two to convoy: pirate contact. Engaging. Keep running.",
          "urgent",
        ),
      ),
      atTime(
        40,
        say(
          BLOODFANG,
          "Carry gently with a pod aboard. Roll and you'll drop it.",
        ),
      ),
      onObjective(
        "kill",
        "completed",
        say(KIRA, "Escort's scrap. Who's next on the menu?", "proud"),
      ),
      onObjective(
        "pods",
        "completed",
        banner("FIRST PLUNDER", "The crew eats tonight"),
      ),
    ],
  },
  cors_1_3: {
    style: "stealth",
    tagline: "Slip in quiet. Leave them screaming.",
    mood: "grim",
    objectives: [
      kill("kill", "Destroy the convoy escorts", 3),
      hidden(
        route("vanish", "Vanish into the nebula", [[1400, 1000]], {
          extraction: true,
        }),
      ),
      bonus(
        stealth(
          "quiet",
          "Stay clear of the convoy's picket buoys",
          [
            [-700, -450],
            [700, -450],
          ],
          { radius: 330 },
        ),
        2,
        60,
      ),
      bonus(protect("crew", "No casualties", "squad"), 1, 50),
    ],
    script: [
      onStart(
        say(
          ADMIRAL,
          "Two picket buoys flank the lane. Slip up the middle, strike, and vanish.",
        ),
      ),
      atTime(
        25,
        say(
          BLOODFANG,
          "Gut the Kestrel first. Fear spreads faster when the big one burns.",
        ),
      ),
      onObjective(
        "quiet",
        "failed",
        say(
          COMMAND,
          "Picket alarm! Pirates in the lane! All escorts respond!",
          "urgent",
        ),
        wave("confed_kestrel", 1, "free_confederation", { at: "ahead" }),
      ),
      onObjective(
        "kill",
        "completed",
        reveal("vanish"),
        say(KIRA, "Let them tell the story. Breaking south-east.", "proud"),
      ),
      onObjective(
        "crew",
        "failed",
        say(
          ADMIRAL,
          "We lost one. Corsairs don't leave the dead hungry. Finish it.",
          "solemn",
        ),
      ),
    ],
  },
  cors_1_4: {
    style: "training",
    tagline: "Stolen gunship. Fresh paint. Break it in.",
    objectives: [
      kill("kill", "Test your new ship against the Viper patrol", 4),
      bonus(
        hold(
          "beacon",
          "Hold the salvage beacon for 20 seconds (medium hulls count double)",
          { at: [-700, -500], radius: 240, seconds: 20 },
        ),
        1,
        50,
      ),
      bonus(
        within(kill("fast", "Destroy the patrol within 90 seconds", 4), 90),
        1,
        40,
      ),
    ],
    script: [
      onStart(
        say(
          BLOODFANG,
          "That Marauder used to be Hegemony. Show its old friends who owns it now.",
        ),
      ),
      atTime(
        30,
        say(
          ADMIRAL,
          "Heavier hull, slower turns. Let the guns do your arguing.",
        ),
      ),
      atTime(
        60,
        say(
          COMMAND,
          "Patrol Seven: the gunship's transponder is ours. Why is it firing?",
          "urgent",
        ),
      ),
      onObjective(
        "beacon",
        "completed",
        say(
          ADMIRAL,
          "Beacon's ours. A medium hull holds ground like two.",
          "proud",
        ),
      ),
      onObjective(
        "kill",
        "completed",
        banner("SHIP EVOLVED", "The Marauder answers to Kira"),
      ),
    ],
  },
  cors_1_5: {
    style: "defense",
    tagline: "Our space. Our rules. Their funeral.",
    mood: "urgent",
    objectives: [
      defend("rookery", "Protect the Rookery frigate for 2½ minutes", {
        at: [0, 480],
        shipId: "corsair_frigate",
        seconds: 150,
        hullScale: 1.5,
      }),
      kill("kill", "Destroy all intruders", 6),
      bonus(
        within(kill("quick", "Destroy 6 intruders within 100 seconds", 6), 100),
        2,
        70,
      ),
    ],
    script: [
      onStart(
        say(
          ADMIRAL,
          "Hegemony patrols sniffing at the Rookery. Hold them off until her drives spool.",
        ),
      ),
      atTime(
        50,
        wave("terran_viper", 2, "terran_hegemony", { at: "flank" }),
        say(BLOODFANG, "Vipers on the flank! Teeth out!", "urgent"),
      ),
      atTime(
        100,
        wave("terran_raptor", 1, "terran_hegemony", { at: "ahead" }),
        say(
          COMMAND,
          "Raptor lead: target the frigate. End the nest.",
          "urgent",
        ),
      ),
      onDestroyed(
        "station",
        1,
        "player",
        say(
          ADMIRAL,
          "The Rookery's gone. We'll make them pay in blood.",
          "grim",
        ),
      ),
      onObjective(
        "rookery",
        "completed",
        banner("TERRITORY HELD", "This space belongs to the Corsairs"),
      ),
    ],
  },
};
