/**
 * Ascendant lore, Act I — The Waking (Days 0–40): slots 1–5
 * (docs/lore/campaigns/ascendant.md).
 */

import { atTime, banner, music, onObjective, say, setFlag } from "../designKit";
import { ARCHON, DREAMER, HERALD } from "../designs/ascendantAct1";
import type { MissionLore } from "../loreTypes";
import { debriefLine } from "./ascendantLoreShared";

/** Slots 1–5 of the Ascendant campaign. */
export const ASCENDANT_ACT1_LORE: Readonly<Record<string, MissionLore>> = {
  asc_1_1: {
    day: 0,
    location: "Trial lane, Ninth Vigil",
    mood: "solemn",
    briefing:
      "The Ninth Vigil flies its trial the way it has for nine centuries: six gates along light-markers laid down in an earlier age, through a veil of ion cloud and a field of rocks. Archon Zaelthar has chosen you, Templar Kaeth, to fly it. Halfway through, every relay in the Reach clicks once, and a voice in your head is not yours.",
    textSwaps: [
      [
        "Faster than the vision. The Oracles take note.",
        "Faster than the vision. She flies it as if she wrote it.",
      ],
    ],
    script: [
      atTime(
        30,
        music("tension"),
        banner("THE BROADCAST", "Every relay in the Reach clicks once"),
        say(HERALD, "A sleeper has woken. The Oracles... take note.", "solemn"),
      ),
    ],
    debriefAppend: [
      debriefLine(
        DREAMER,
        "You can hear me. Good. Do not tell the Oracles yet, Templar. Let me see what they have made of my words.",
        "solemn",
      ),
    ],
  },
  asc_1_2: {
    day: 6,
    location: "Shrine-lanes",
    debriefAppend: [
      debriefLine(
        ARCHON,
        "One machine, mapping our shrines for someone who is not us. The Oracles will want to know who.",
        "grim",
      ),
    ],
  },
  asc_1_3: {
    day: 13,
    location: "Pylon lane",
    debriefAppend: [
      debriefLine(
        HERALD,
        "The chorus held. Two minds, one silence. The Oracles were watching the link as closely as the pylons.",
      ),
    ],
  },
  asc_1_4: {
    day: 24,
    location: "Proving ring",
    briefing:
      "The Oracle-class waits for whoever earns it, and the Archons have set the proving ring to test that. A Collective Hunter has found the ring first. Among the machines it has a name, Unit Zero, and it has already died once and learned from it. Break its chassis.",
    objectiveText: { ace: "Destroy the Hunter ace, Unit Zero" },
    textSwaps: [
      [
        "Among machines, it has a name.",
        "Among machines, it has a name: Unit Zero.",
      ],
      [
        "The named one is unmade. You are worthy.",
        "The chassis is unmade. You are worthy.",
      ],
    ],
    script: [
      onObjective(
        "ace",
        "completed",
        setFlag("x_zero_rechassised", true),
        say(
          DREAMER,
          "The hull is broken. The mind that wore it is not. It left through the link, into another body.",
          "grim",
        ),
      ),
    ],
    debriefAppend: [
      debriefLine(
        HERALD,
        "The Oracle saw you stand in the ring. A machine that remembers being destroyed is not a machine. Be careful.",
        "solemn",
      ),
    ],
  },
  asc_1_5: {
    day: 34,
    location: "Cinder Gate",
    crossover: "X3",
    briefing:
      "Cinder Gate, where the Hegemony trades with the Ascendant, and today something there is singing. Machines and raiders are both drawn to the same point, and the Dreamer has seen this moment. Hold the convergence and keep your squad alive.",
    script: [
      atTime(
        70,
        say(
          DREAMER,
          "A human mind is singing back from the raiders. Young. Furious. She calls herself Kira.",
          "solemn",
        ),
      ),
    ],
    variants: [
      {
        when: { flag: "x3_shard_taken" },
        script: [
          atTime(
            100,
            say(
              DREAMER,
              "A raider took a shard of the lock. The Oracles will call it theft. I call it fate.",
              "solemn",
            ),
          ),
        ],
      },
    ],
    debriefAppend: [
      debriefLine(
        ARCHON,
        "Every future bends toward us. The Oracles will say so at the Temple. I would like to believe it.",
        "proud",
      ),
    ],
  },
};
