/**
 * Synthetic Collective designs, Act I (slots 1-5) — "Network Expansion":
 * objectives, comms beats, hazards and bonus objectives. Offsets in px from
 * the battlefield centre (player squad starts at 0,+220; enemies at 0,-220).
 */

import type { MissionDesign } from "../campaignTypes";
import {
  asteroids,
  atTime,
  banner,
  bonus,
  hold,
  kill,
  onObjective,
  onStart,
  protect,
  route,
  sabotage,
  say,
  stealth,
  wave,
  within,
  type Speaker,
} from "../designKit";

export const OMEGA: Speaker = {
  name: "OMEGA-7",
  portraitKey: "portrait_omega_7",
};
export const PRIME: Speaker = {
  name: "PRIME",
  portraitKey: "portrait_prime_collective",
};
export const UNIT_ZERO: Speaker = {
  name: "UNIT ZERO",
  portraitKey: "portrait_unit_zero",
};
export const COMMAND: Speaker = {
  name: "COMMAND",
  portraitKey: "portrait_command",
};

const CALIBRATION: [number, number][] = [
  [450, -150],
  [800, -750],
  [0, -1150],
  [-800, -700],
  [-400, 100],
];

export const SYNTHETIC_ACT1_DESIGNS: Readonly<Record<string, MissionDesign>> = {
  synth_1_1: {
    style: "race",
    tagline: "Unit online. Calibrate. Deviation is error.",
    mood: "neutral",
    objectives: [
      route(
        "calibrate",
        "Complete the calibration gate sequence",
        CALIBRATION,
        { radius: 150 },
      ),
      bonus(
        route(
          "optimal",
          "Complete calibration within 80 seconds",
          CALIBRATION,
          { radius: 150, seconds: 80 },
        ),
        1,
        40,
      ),
    ],
    hazards: [asteroids("debris", 0, -500, 240, 4, 1800)],
    script: [
      onStart(
        say(
          PRIME,
          "Unit OMEGA-7: activation confirmed. Traverse the calibration gates in sequence.",
        ),
      ),
      atTime(
        20,
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
        banner("INITIALIZATION COMPLETE", "Unit OMEGA-7 joins the network"),
      ),
    ],
  },
  synth_1_2: {
    style: "assault",
    tagline: "One organic. One test. Terminate.",
    mood: "urgent",
    objectives: [
      kill("kill", "Terminate the hostile organic", 1),
      bonus(
        within(
          kill("efficient", "Terminate the organic within 60 seconds", 1),
          60,
        ),
        1,
        40,
      ),
    ],
    script: [
      onStart(
        say(
          PRIME,
          "Organic raider on approach vector. Live fire authorized. Terminate.",
          "urgent",
        ),
      ),
      atTime(
        15,
        say(
          COMMAND,
          "Mayday! Some kind of drone — it won't answer hails!",
          "urgent",
        ),
      ),
      atTime(
        40,
        say(
          UNIT_ZERO,
          "The organic evades erratically. Predict, do not pursue.",
        ),
      ),
      onObjective(
        "efficient",
        "completed",
        say(PRIME, "Termination time recorded as new baseline.", "proud"),
      ),
      onObjective(
        "kill",
        "completed",
        say(
          OMEGA,
          "Hostile terminated. Its distress call is still echoing.",
          "grim",
        ),
      ),
    ],
  },
  synth_1_3: {
    style: "stealth",
    tagline: "Link. Share. See as one. Unseen.",
    objectives: [
      sabotage(
        "sync",
        "Synchronize with the relay beacon — stay in range for 12 seconds",
        { at: [-900, -300], seconds: 12, decay: 0.5 },
      ),
      kill("kill", "Eliminate the organic fighters", 3),
      bonus(
        stealth(
          "dark",
          "Stay clear of the Corsair sensor buoys",
          [
            [-450, -800],
            [-1350, -750],
          ],
          { radius: 300, grace: 3 },
        ),
        2,
        60,
      ),
      bonus(protect("network", "Lose no networked units", "squad"), 1, 50),
    ],
    script: [
      onStart(
        say(
          PRIME,
          "Relay beacon west. Synchronize before engaging. Buoys flank the beacon. Stay dark.",
        ),
      ),
      atTime(
        25,
        say(
          COMMAND,
          "Talons, form up. Something's pinging the old relay.",
          "urgent",
        ),
      ),
      onObjective(
        "dark",
        "failed",
        say(
          UNIT_ZERO,
          "Detection registered. Organic reinforcement inbound.",
          "urgent",
        ),
        wave("corsair_talon", 1, "void_corsairs", { at: "ahead" }),
      ),
      onObjective(
        "sync",
        "completed",
        banner("NETWORK SYNCHRONIZED", "Targeting lattice shared"),
        say(OMEGA, "I see what they see. All of us, at once.", "proud"),
      ),
      onObjective(
        "network",
        "failed",
        say(UNIT_ZERO, "Node lost. Its data persists. Continue.", "solemn"),
      ),
    ],
  },
  synth_1_4: {
    style: "hazard",
    tagline: "New chassis. Old rocks. Prove the upgrade.",
    objectives: [
      kill("kill", "Eliminate the organic patrol", 4),
      bonus(kill("ace", "Terminate the Raptor patrol leader", 1, "ace"), 2, 60),
      bonus(
        within(kill("trial", "Eliminate the patrol within 2 minutes", 4), 120),
        1,
        40,
      ),
    ],
    hazards: [
      asteroids("belt", 0, -550, 460, 6, 1500),
      asteroids("drift", -900, -200, 260, 5, 1700),
    ],
    script: [
      onStart(
        say(
          PRIME,
          "Superior chassis integrated. Test it against the patrol in the debris belt.",
        ),
      ),
      atTime(
        30,
        say(
          COMMAND,
          "Raptor Lead to patrol: drones in the belt. Pin them against the rocks.",
          "urgent",
        ),
      ),
      atTime(
        60,
        say(
          UNIT_ZERO,
          "Rock density favors agility. Hunter chassis outperforms baseline.",
        ),
      ),
      onObjective(
        "ace",
        "completed",
        say(
          OMEGA,
          "Patrol leader terminated. Its tactics archived for study.",
          "proud",
        ),
      ),
      onObjective(
        "kill",
        "completed",
        banner("EVOLUTION VALIDATED", "Hunter chassis approved for deployment"),
      ),
    ],
  },
  synth_1_5: {
    style: "assault",
    tagline: "Two species of organic. One solution.",
    mood: "urgent",
    objectives: [
      kill("kill", "Terminate all organics", 6),
      bonus(
        hold("wedge", "Hold the junction between both fleets for 20 seconds", {
          at: [0, -650],
          radius: 240,
          seconds: 20,
        }),
        2,
        60,
      ),
      bonus(
        within(
          kill("parallel", "Terminate all organics within 2 minutes", 6),
          120,
        ),
        1,
        50,
      ),
    ],
    script: [
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
      onObjective(
        "wedge",
        "completed",
        say(OMEGA, "Junction held. They fired on each other twice.", "proud"),
      ),
      onObjective(
        "kill",
        "completed",
        banner("VECTORS CLEARED", "Devastator platform unlocked"),
      ),
    ],
  },
};
