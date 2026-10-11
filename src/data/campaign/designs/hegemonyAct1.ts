/**
 * Hegemony designs, Act I (slots 1-5) — "The Iron Fist": objectives, comms
 * beats, hazards and bonus objectives. Offsets in px from the battlefield
 * centre (player squad starts at 0,+220; enemies at 0,-220).
 */

import type { MissionDesign } from "../campaignTypes";
import {
  asteroids,
  atTime,
  banner,
  bonus,
  hit,
  hold,
  kill,
  onObjective,
  onStart,
  protect,
  route,
  say,
  setFlag,
  stealth,
  wave,
  within,
  type Speaker,
} from "../designKit";

export const CHEN: Speaker = {
  name: "ADMIRAL CHEN",
  portraitKey: "portrait_admiral_chen",
};
export const STRIKER: Speaker = {
  name: "STRIKER",
  portraitKey: "portrait_striker",
};
export const WHISPER: Speaker = {
  name: "WHISPER",
  portraitKey: "portrait_whisper",
};
export const COMMAND: Speaker = {
  name: "COMMAND",
  portraitKey: "portrait_command",
};

const COURSE: [number, number][] = [
  [-500, -100],
  [-700, -700],
  [0, -1000],
  [700, -600],
  [400, 100],
];

export const HEGEMONY_ACT1_DESIGNS: Readonly<Record<string, MissionDesign>> = {
  heg_1_1: {
    style: "race",
    tagline: "Gates hot. Clock running. Fly clean.",
    mood: "neutral",
    objectives: [
      route("course", "Fly the academy gate course", COURSE, { radius: 150 }),
      bonus(
        route("fast", "Clear the course in 75 seconds", COURSE, {
          radius: 150,
          seconds: 75,
        }),
        1,
        40,
      ),
    ],
    script: [
      onStart(
        say(
          COMMAND,
          "Cadet, follow the gate markers. Edge arrows point the way.",
        ),
      ),
      atTime(
        20,
        say(
          STRIKER,
          "Bank into the gates, don't brake. The dial forgives nothing.",
        ),
      ),
      onObjective(
        "fast",
        "completed",
        say(WHISPER, "Course record. Instructors will hate that.", "proud"),
      ),
      onObjective(
        "course",
        "completed",
        banner("COURSE COMPLETE", "Report to Delta Station"),
      ),
    ],
  },
  heg_1_2: {
    style: "assault",
    tagline: "One raider. Live rounds. Don't hesitate.",
    mood: "urgent",
    objectives: [
      kill("kill", "Destroy the pirate raider", 1),
      bonus(
        within(kill("quick", "Down the raider within 60 seconds", 1), 60),
        1,
        40,
      ),
    ],
    script: [
      onStart(
        say(
          CHEN,
          "Contact bearing north. It's real this time, pilot.",
          "urgent",
        ),
      ),
      atTime(
        15,
        say(
          STRIKER,
          "Raider's jinking. Stay on his six and let the guns cycle.",
        ),
      ),
      onObjective(
        "kill",
        "completed",
        say(WHISPER, "They were waiting for us. Someone told them.", "grim"),
      ),
    ],
  },
  heg_1_3: {
    style: "assault",
    tagline: "Two ships. One will. Hold formation.",
    objectives: [
      kill("kill", "Destroy pirate fighters", 3),
      bonus(protect("survive", "Keep your wingman alive", "wingman")),
    ],
    script: [
      onStart(
        say(
          CHEN,
          "Wingman on my left. Press R to mark — your wing hits what you mark.",
        ),
      ),
      atTime(25, say(STRIKER, "Three blades, tight pack. Split them up.")),
      onObjective(
        "survive",
        "failed",
        say(WHISPER, "Wingman down. Finish this.", "grim"),
      ),
    ],
  },
  heg_1_3b: {
    style: "stealth",
    tagline: "Dark running. No transponders. No witnesses.",
    mood: "grim",
    objectives: [
      kill("kill", "Eliminate Corsair scout ships", 3),
      bonus(
        stealth(
          "survive",
          "Return without triggering an alarm",
          [
            [-600, -700],
            [600, -700],
          ],
          { radius: 360 },
        ),
        2,
        60,
      ),
    ],
    script: [
      onStart(
        say(
          WHISPER,
          "Two sensor buoys on the ridge. Stay out of their cones or the nest wakes.",
        ),
      ),
      onObjective(
        "survive",
        "failed",
        say(STRIKER, "Alarm's up! Here they come!", "urgent"),
        wave("corsair_blade", 2, "void_corsairs", { at: "ahead" }),
      ),
      onObjective(
        "kill",
        "completed",
        say(CHEN, "Scouts silenced. Nobody saw a thing.", "proud"),
      ),
    ],
  },
  heg_1_4: {
    style: "assassination",
    tagline: "A Confederation ace. Ground him before he runs.",
    objectives: [
      hit("ace", "Shoot down the patrol leader before he escapes", {
        shipId: "confed_hawk",
        at: [0, -700],
        flee: [[0, -1900]],
        fleeAtHull: 0.45,
        hullScale: 1.5,
      }),
      bonus(kill("patrol", "Destroy the rebel patrol", 4)),
    ],
    script: [
      onStart(
        say(
          COMMAND,
          "Patrol leader is a known ace. He runs when hurt. Don't let him reach the jump lane.",
        ),
      ),
      onObjective("ace", "failed", say(STRIKER, "He jumped. Damn it.", "grim")),
      onObjective(
        "ace",
        "completed",
        say(CHEN, "Leader down. That's a promotion talking.", "proud"),
      ),
    ],
  },
  heg_1_5: {
    style: "hazard",
    tagline: "The border runs through a rock field. So do we.",
    objectives: [
      kill("kill", "Destroy all enemy ships", 6),
      bonus(
        hold("relay", "Hold the border relay for 20 seconds", {
          at: [-900, -300],
          radius: 220,
          seconds: 20,
        }),
        2,
        60,
      ),
    ],
    hazards: [asteroids("belt", 0, -400, 700, 6, 1500)],
    script: [
      onStart(
        say(
          WHISPER,
          "Asteroid belt between us and them. Every second inside it costs hull.",
        ),
      ),
      atTime(
        30,
        say(
          STRIKER,
          "Drones flanking through the rocks — they don't care about scratches.",
        ),
      ),
      atTime(
        50,
        wave("synth_drone", 2, "synthetic_collective", { at: "behind" }),
        say(WHISPER, "More drones, behind us!", "urgent"),
      ),
      onObjective(
        "relay",
        "completed",
        setFlag("heg_relay_held"),
        say(CHEN, "Relay's ours. Command sees everything now."),
      ),
    ],
  },
};
