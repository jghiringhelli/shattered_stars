/**
 * Ascendant Empire designs, Act I (slots 1-5) — "The Prophecy": the
 * Dreamer's awakening. Objectives, comms beats, hazards and bonus
 * objectives. Offsets in px from the battlefield centre (player squad starts
 * at 0,+220; enemies at 0,-220).
 */

import type { MissionDesign } from "../campaignTypes";
import {
  asteroids,
  atTime,
  banner,
  bonus,
  hidden,
  hold,
  ionStorm,
  kill,
  onArea,
  onObjective,
  onStart,
  protect,
  reveal,
  route,
  say,
  stealth,
  wave,
  within,
  type Speaker,
} from "../designKit";

export const DREAMER: Speaker = {
  name: "THE DREAMER",
  portraitKey: "portrait_the_dreamer",
};
export const ARCHON: Speaker = {
  name: "ARCHON",
  portraitKey: "portrait_archon_zaelthar",
};
export const HERALD: Speaker = {
  name: "HERALD",
  portraitKey: "portrait_herald",
};
export const COMMAND: Speaker = {
  name: "COMMAND",
  portraitKey: "portrait_command",
};

const TRIAL_GATES: [number, number][] = [
  [-350, -300],
  [-700, -900],
  [-200, -1400],
  [500, -1500],
  [900, -700],
  [300, -100],
];

export const ASCENDANT_ACT1_DESIGNS: Readonly<Record<string, MissionDesign>> = {
  asc_1_1: {
    style: "race",
    tagline: "The path was flown before you were born. Fly it again.",
    mood: "solemn",
    objectives: [
      route("trial", "Fly the psionic navigation trial", TRIAL_GATES, {
        radius: 150,
      }),
      bonus(
        route("swift", "Complete the trial in 75 seconds", TRIAL_GATES, {
          radius: 150,
          seconds: 75,
        }),
        1,
        40,
      ),
    ],
    hazards: [
      ionStorm("veil", -500, -1150, 240, 3),
      asteroids("shards", 750, -1100, 220, 4, 1800),
    ],
    script: [
      onStart(
        say(
          ARCHON,
          "The Oracles have seen you fly this path. Now prove the seeing was true.",
        ),
      ),
      atTime(
        15,
        say(HERALD, "Do not trust the instruments. Follow the light-markers."),
      ),
      atTime(
        40,
        say(ARCHON, "The veil drinks shields. Pass through it. Do not flinch."),
      ),
      onArea(
        -500,
        -1150,
        240,
        say(DREAMER, "...I see the next gate before I reach it.", "solemn"),
      ),
      onObjective(
        "swift",
        "completed",
        say(HERALD, "Faster than the vision. The Oracles take note.", "proud"),
      ),
      onObjective(
        "trial",
        "completed",
        banner("TRIAL COMPLETE", "The Dreamer awakens"),
      ),
    ],
  },
  asc_1_2: {
    style: "assault",
    tagline: "You saw it die. Now make it so.",
    mood: "grim",
    objectives: [
      kill("kill", "Destroy the foreseen machine", 1),
      bonus(
        within(
          kill("swift", "Strike within 45 seconds — as the vision showed", 1),
          45,
        ),
        1,
        40,
      ),
    ],
    script: [
      onStart(
        say(
          ARCHON,
          "One machine. You dreamed its death last night. Fulfil the dream.",
        ),
      ),
      atTime(
        15,
        say(HERALD, "It is mapping the shrine-lanes. Let it map nothing more."),
      ),
      atTime(35, say(DREAMER, "It turns left. I know it turns left.", "grim")),
      onObjective(
        "kill",
        "completed",
        say(ARCHON, "As foreseen. The first prophecy holds.", "proud"),
      ),
    ],
  },
  asc_1_3: {
    style: "stealth",
    tagline: "Two minds. One silence. The watchers see nothing.",
    mood: "grim",
    objectives: [
      kill("kill", "Destroy the machine pickets", 3),
      hidden(
        route("withdraw", "Withdraw along the linked path", [[1300, 1000]], {
          extraction: true,
        }),
      ),
      bonus(
        stealth(
          "unseen",
          "Stay clear of the watcher pylons",
          [
            [-700, -450],
            [700, -450],
          ],
          { radius: 320 },
        ),
        2,
        60,
      ),
      bonus(
        protect("link", "Keep the mind link whole — lose no one", "squad"),
        1,
        50,
      ),
    ],
    script: [
      onStart(
        say(
          HERALD,
          "Two watcher pylons sweep this lane. The link lets you see what they see.",
        ),
      ),
      atTime(
        20,
        say(DREAMER, "I can hear your thoughts, Templar. They are very quiet."),
      ),
      atTime(45, say(ARCHON, "Come up the centre. Strike as one mind.")),
      onObjective(
        "unseen",
        "failed",
        say(
          COMMAND,
          "[intercepted] PYLON ALERT. SWARM RESPONSE AUTHORISED.",
          "urgent",
        ),
        wave("synth_drone", 2, "synthetic_collective", { at: "ahead" }),
      ),
      onObjective(
        "kill",
        "completed",
        reveal("withdraw"),
        say(
          ARCHON,
          "It is done. Withdraw before the Collective remembers you.",
        ),
      ),
      onObjective(
        "link",
        "failed",
        say(HERALD, "A voice has gone silent in the link.", "solemn"),
      ),
    ],
  },
  asc_1_4: {
    style: "training",
    tagline: "Greater hulls answer only greater minds.",
    objectives: [
      kill("kill", "Prove your worth — destroy the machines", 4),
      bonus(kill("ace", "Destroy the Hunter ace", 1, "ace"), 2, 60),
      bonus(
        hold("ring", "Hold the Oracle's proving ring for 20 seconds", {
          at: [0, -600],
          radius: 240,
          seconds: 20,
        }),
        1,
        40,
      ),
    ],
    script: [
      onStart(
        say(
          ARCHON,
          "New hulls wait for you. Show the Oracles which mind deserves them.",
        ),
      ),
      atTime(
        25,
        say(
          HERALD,
          "A Hunter stalks the proving ring. Among machines, it has a name.",
        ),
      ),
      atTime(
        60,
        wave("synth_drone", 2, "synthetic_collective", { at: "flank" }),
        say(
          COMMAND,
          "[intercepted] Reinforce the Hunter. Flank the psionic.",
          "urgent",
        ),
      ),
      onObjective(
        "ace",
        "completed",
        say(ARCHON, "The named one is unmade. You are worthy.", "proud"),
      ),
      onObjective(
        "ring",
        "completed",
        say(
          HERALD,
          "The Oracle saw you stand in the ring. The Oracle-class is yours.",
        ),
      ),
    ],
  },
  asc_1_5: {
    style: "assault",
    tagline: "Every timeline meets here. You have seen this moment.",
    mood: "urgent",
    objectives: [
      hold("nexus", "Hold the convergence point for 30 seconds", {
        at: [0, -350],
        radius: 280,
        seconds: 30,
      }),
      kill("kill", "Eliminate all threats", 6),
      bonus(protect("whole", "No losses in your squad", "squad"), 2, 80),
      bonus(
        within(kill("swift", "Eliminate 6 threats within 2 minutes", 6), 120),
        1,
        50,
      ),
    ],
    script: [
      onStart(
        say(
          ARCHON,
          "Machines and raiders, both drawn to the same point. Stand on it. Hold.",
        ),
      ),
      atTime(
        25,
        say(
          DREAMER,
          "I have dreamed this. The raiders come from the left.",
          "urgent",
        ),
      ),
      atTime(
        50,
        wave("corsair_talon", 2, "void_corsairs", { at: "flank" }),
        say(
          COMMAND,
          "[intercepted] Corsairs! Who invited the Corsairs?",
          "urgent",
        ),
      ),
      atTime(
        90,
        wave("synth_drone", 2, "synthetic_collective", { at: "behind" }),
        say(HERALD, "Machines behind you. The timelines tighten.", "urgent"),
      ),
      onObjective(
        "nexus",
        "completed",
        say(
          ARCHON,
          "The convergence is ours. Every future bends toward us now.",
          "proud",
        ),
      ),
      onObjective(
        "kill",
        "completed",
        banner("CONVERGENCE", "One future remains"),
      ),
    ],
  },
};
