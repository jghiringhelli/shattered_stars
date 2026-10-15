/**
 * Coalition design, Act IV finale (Day 251): the Breach of Sol. Survive at
 * the Sol Mouth while the Pruning Herald hunts the squad; the first Resonance
 * prototype is a bonus that decides whether the Mouth is saved (the flag
 * `coal_sol_mouth_saved`) or collapsed. Victory sets `coal_sol_held`.
 */

import type { MissionDesign } from "../campaignTypes";
import {
  asteroids,
  atTime,
  banner,
  bonus,
  hazardOn,
  hit,
  hold,
  ionStorm,
  onObjective,
  onStart,
  setFlag,
  say,
  survive,
  wave,
} from "../designKit";
import {
  AT,
  CHEN,
  COALITION,
  HERALD,
  OMEGA,
  SANTOS,
  STRIKER,
  TIDE_FACTION,
  VASQUEZ,
  WHISPER,
  heroSays,
  ironFist,
  kiraRaiders,
  omegaCluster,
  santosCell,
  templarGuard,
} from "./coalitionShared";

export const COALITION_ACT4C_DESIGNS: Readonly<Record<string, MissionDesign>> =
  {
    coal_4_5: {
      style: "boss",
      tagline: "The Tide reaches the Sol Mouth. Hold it, or close it.",
      mood: "urgent",
      prerequisites: [2, 3, 4],
      allies: [
        ironFist(2),
        santosCell(2),
        omegaCluster(2),
        kiraRaiders(2),
        templarGuard(2),
      ],
      objectives: [
        survive("survive", "Hold the Sol Mouth for 3 minutes", 180),
        hit("herald", "Destroy the Pruning Herald", {
          shipId: "pruning_herald",
          at: [0, -1000],
          boss: true,
        }),
        bonus(
          hold("proto", "Keep the Resonance prototype in tune for 20 seconds", {
            at: [-800, -500],
            radius: 300,
            seconds: 20,
          }),
          3,
          150,
        ),
      ],
      victoryFlags: { coal_sol_held: true },
      hazards: [
        asteroids("debris", -900, -300, 350, 5),
        ionStorm("mouth_weather", 0, -700, 500, 5, true),
      ],
      variants: [
        {
          when: { flag: "x13_door_opened" },
          briefing:
            "The Tide reaches the Sol Mouth, and the door Prime's Catalyst opened is still ajar behind it, so more is coming through than the Mouth should pass. The Coalition fleet holds with the first Resonance prototype in its cradle. Survive, kill the Herald, and keep the prototype in tune.",
          script: [
            atTime(
              15,
              wave("tidecell", 4, TIDE_FACTION, { at: "behind", tag: "tide" }),
              say(
                WHISPER,
                "More cells on our six. The door from the Catalyst is still open.",
                "urgent",
              ),
            ),
          ],
        },
        {
          when: { flag: "x13_catalyst_destroyed" },
          script: [
            onStart(
              say(
                VASQUEZ,
                "The Catalyst is wreckage, so the door stayed shut. The Mouth's wall is thinner than it should be, but it is a wall.",
                "proud",
              ),
            ),
          ],
        },
        {
          when: { flag: "x7_shards_saved" },
          script: [
            atTime(
              25,
              say(
                HERALD,
                "The shards saved at Prometheus hum in the prototype's cradle. They remember the Nexus.",
                "solemn",
              ),
            ),
          ],
        },
        {
          when: { flag: "coal_prime_cut" },
          script: [
            atTime(
              35,
              say(
                OMEGA,
                "Prime is out of the lattice, and the Tide has no relay voice to borrow. It is singing alone.",
                "solemn",
              ),
            ),
          ],
        },
      ],
      script: [
        onStart(
          say(
            COALITION,
            "The Tide is at the Sol Mouth, and Earth is hours behind it. Hold the Mouth until it collapses or the Herald falls.",
          ),
        ),
        heroSays(
          "terran_hegemony",
          AT(8),
          CHEN,
          "I flew my trials in this sky. Nothing gets past the Mouth.",
          "proud",
        ),
        heroSays(
          "free_confederation",
          AT(14),
          SANTOS,
          "Every cell in the Rim is watching this feed. Don't give them a reason to look away.",
        ),
        atTime(
          20,
          say(
            VASQUEZ,
            "The Resonance prototype is cradled in the debris ring. Hold it in tune for twenty seconds and it should push the Tide's song back.",
          ),
        ),
        atTime(
          30,
          wave("tidecell", 4, TIDE_FACTION, { at: "ahead", tag: "tide" }),
        ),
        atTime(
          60,
          hazardOn("mouth_weather"),
          banner("THE MOUTH", "Deep weather rolls through the lane mouth"),
        ),
        atTime(
          75,
          wave("hulk_gnawer", 2, TIDE_FACTION, { at: "flank", tag: "tide" }),
          say(
            STRIKER,
            "Gnawers, off the wrecks. Keep clear of the debris.",
            "urgent",
          ),
        ),
        atTime(
          130,
          wave("tidecell", 4, TIDE_FACTION, { at: "flank", tag: "tide" }),
        ),
        atTime(
          160,
          wave("tidecell", 3, TIDE_FACTION, { at: "behind", tag: "tide" }),
          say(
            WHISPER,
            "The Herald is pruning the squad's comms. Stay tight.",
            "urgent",
          ),
        ),
        onObjective(
          "proto",
          "completed",
          setFlag("coal_sol_mouth_saved", true),
          say(
            VASQUEZ,
            "The prototype holds. The Tide's song is flinching, and we are not.",
            "proud",
          ),
        ),
        onObjective(
          "herald",
          "completed",
          say(
            HERALD,
            "The Herald falls. Its lens eye stays open, still looking at something far behind us.",
            "solemn",
          ),
        ),
      ],
    },
  };
