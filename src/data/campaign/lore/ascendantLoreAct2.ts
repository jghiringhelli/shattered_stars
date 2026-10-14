/**
 * Ascendant lore, Act II — The Shards (Days 41–120): slots 6–10
 * (docs/lore/campaigns/ascendant.md).
 */

import {
  atTime,
  beat,
  bonus,
  failObjective,
  music,
  onDestroyed,
  onObjective,
  protect,
  salvage,
  say,
  setFlag,
  wave,
} from "../designKit";
import { ARCHON, DREAMER, HERALD } from "../designs/ascendantAct1";
import type { MissionLore } from "../loreTypes";
import { debriefLine } from "./ascendantLoreShared";

/** The shard the primary salvage leaves in the wreck's heart. */
const DEEP_SHARD = bonus(
  salvage(
    "whole",
    "Save every shard: bring the fourth home from the wreck's heart",
    {
      crates: [[-1050, -1400]],
      dropZone: [0, 450],
      required: 1,
    },
  ),
  2,
  80,
);

/** Bonus of the Heretic Purge: keep the preachers' ships alive. */
const SPARE_PREACHERS = bonus(
  protect(
    "spare",
    "Spare the preachers' ships (and burn the relay first)",
    "preachers_kept",
  ),
  2,
  80,
);

/** Slots 6–10 of the Ascendant campaign. */
export const ASCENDANT_ACT2_LORE: Readonly<Record<string, MissionLore>> = {
  asc_2_1: {
    day: 90,
    location: "Prometheus wreck field",
    crossover: "X7",
    briefing:
      "The humans broke the lock at Prometheus, and the Nexus came down in a wreck field. Every shard of it still sings. Carry three to the reliquary, and the machines' Hunters will come for what they hear.",
    addObjectives: [DEEP_SHARD],
    script: [
      onObjective(
        "whole",
        "completed",
        setFlag("x7_shards_saved", true),
        say(
          DREAMER,
          "All of them, home. Together they remember what the lock was for.",
          "solemn",
        ),
      ),
    ],
    variants: [
      {
        when: { flag: "x7_nexus_data" },
        script: [
          atTime(
            20,
            say(
              DREAMER,
              "The machines took its words. We take its voice.",
              "solemn",
            ),
          ),
        ],
      },
    ],
    debriefAppend: [
      debriefLine(
        HERALD,
        "The reliquary hums for the first time in nine centuries. The Oracles say it is welcome. The Dreamer says it is grief.",
        "solemn",
      ),
    ],
  },
  asc_2_2: {
    day: 58,
    location: "Unbound world, Confederation space",
    tagline: "A false gospel on six worlds. Silence the voice.",
    briefing:
      "A Confederation border world shelters the Unbound, Vaelith heretics who call the Prophecy a lie, and a relay that preaches it on six worlds. Silence the relay and break the pickets guarding it. Their preacher ships will run when the guns open. The Archon's orders do not mention them. That choice is yours.",
    addObjectives: [SPARE_PREACHERS],
    script: [
      atTime(
        45,
        wave("confed_pelican", 2, "free_confederation", {
          at: "behind",
          tag: "preachers",
        }),
        say(
          HERALD,
          "Preacher ships, breaking for the lane. Barely armed. The Archon will want them stopped.",
          "urgent",
        ),
      ),
      onObjective("pulpit", "completed", setFlag("relay_burned")),
      onDestroyed(
        "preachers",
        1,
        "enemy",
        failObjective("spare"),
        say(DREAMER, "They were running. They were only running.", "solemn"),
      ),
      beat(
        { on: "objective", objectiveId: "spare", status: "completed" },
        [
          setFlag("asc_heretics_spared", true),
          setFlag("key_asc_mercy", true),
          say(
            ARCHON,
            "The relay is ash and their ships are gone. I did not see them. Do you understand me, Templar?",
            "grim",
          ),
        ],
        { if: [{ flag: "relay_burned" }] },
      ),
    ],
    debriefAppend: [
      debriefLine(
        DREAMER,
        "They sing the same hymn at the same hour. I keep asking why the vision never showed me that.",
        "solemn",
      ),
    ],
  },
  asc_2_3: {
    day: 71,
    location: "A broken sun, the Reach",
    briefing:
      "A trial of fire on the rim of a broken sun. The Oracles call it a vision. The Dreamer remembers it as a place: this star was broken ten thousand years ago, and its flare front still marches. Endure it, and answer the challengers who walk in.",
    objectiveText: { trial: "Endure the flare front for 2½ minutes" },
    script: [
      atTime(
        20,
        say(
          DREAMER,
          "This is no vision, Templar. It is a memory. My people broke this sun.",
          "solemn",
        ),
      ),
      atTime(135, say(DREAMER, "We did this. To stop it.", "grim")),
    ],
    debriefAppend: [
      debriefLine(
        ARCHON,
        "The Oracles are satisfied. You stood in the fire and did not break. They will say that is what the Prophecy asks.",
        "proud",
      ),
    ],
  },
  asc_2_4: {
    day: 96,
    location: "Temple of the Ninth Vigil",
    debriefAppend: [
      debriefLine(
        HERALD,
        "Nine hundred years, and the Temple still stands. The machines withdrew. I do not think they were beaten, only called elsewhere.",
        "solemn",
      ),
    ],
  },
  asc_2_5: {
    day: 110,
    location: "Collective choir platform",
    briefing:
      "The Collective has built a choir platform in the veil, and it is singing: three falling notes, again and again, and drones answer every verse. Sever the choir if you can, and unmake the thing at the centre. Halo Wing flies with you.",
    script: [
      atTime(
        55,
        music("tension"),
        say(
          DREAMER,
          "Three notes, falling. I know that song. It is not theirs. The machines learned it from something.",
          "grim",
        ),
      ),
      atTime(
        100,
        say(
          DREAMER,
          "Prime sings what the Tide sings. We must not let that song finish.",
          "urgent",
        ),
      ),
    ],
    debriefAppend: [
      debriefLine(
        ARCHON,
        "A machine that sings. If the Oracles had heard it, they would have called it holy. Remember that.",
        "grim",
      ),
    ],
  },
};
