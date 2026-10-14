/**
 * Ascendant lore, finale: slot 15, Ascension — the Breach
 * (docs/lore/campaigns/ascendant.md). The Machine Prophet becomes the
 * Hollowed Prophet Ilsandre, and Archon Zaelthar sides with the Dreamer.
 */

import { atTime, banner, hit, onObjective, say } from "../designKit";
import { ASCENDANT_ACT23_DESIGNS } from "../designs/ascendantAct23";
import { ARCHON, DREAMER, HERALD } from "../designs/ascendantAct1";
import type { MissionLore } from "../loreTypes";
import { debriefLine, ILSANDRE, withoutObjective } from "./ascendantLoreShared";

const ILSANDRE_HIT = hit("prophet", "Silence the false Prophet Ilsandre", {
  shipId: "ascendant_prophet",
  at: [0, -1100],
  boss: true,
  hullScale: 2.5,
});

/** Slot 15 of the Ascendant campaign. */
export const ASCENDANT_FINALE_LORE: Readonly<Record<string, MissionLore>> = {
  asc_3_5: {
    day: 200,
    location: "Nexus Approach, the Vigil fleet",
    crossover: "X15",
    tagline: "The Prophet lies. The Dreamer does not.",
    briefing:
      "The Prophet Ilsandre has gathered the Vigil fleet at the Nexus Approach and proclaims the Ascension: open the Reach and let the Tide judge the loud. Every fleet in the sector has been drawn to the light. Archon Zaelthar has chosen to fly with the Dreamer. Silence the false Prophet.",
    replaceObjectives: [
      ILSANDRE_HIT,
      ...withoutObjective(
        ASCENDANT_ACT23_DESIGNS.asc_3_5?.objectives,
        "prophet",
      ),
    ],
    addEnemies: [
      { shipId: "ascendant_wrath", count: 2, faction: "ascendant_empire" },
    ],
    victoryFlags: { x15_breach_witnessed_ascendant: true },
    textSwaps: [
      [
        "Destroy the Machine Prophet within 3 minutes",
        "Silence Ilsandre within 3 minutes",
      ],
      [
        "Every faction in the galaxy stands between you and destiny. Ascend.",
        "Ilsandre has opened the Reach to the Tide. Every fleet here was drawn by his light. I read the Prophecy all my life, Templar. The Dreamer reads it truer. Fly.",
      ],
      [
        "The light rises behind us. There is only forward.",
        "The dark rises ahead of us. There is only forward.",
      ],
      [
        "[intercepted] Protect the Prophet! All units!",
        "[intercepted] Protect the Prophet! All Vigil units, close on the Templar!",
      ],
      ["The prophecy is fulfilled", "The false Prophet is silenced"],
    ],
    script: [
      atTime(
        20,
        say(
          ILSANDRE,
          "Hear the Vigil! The Ascension is come. Open the Reach, and let the Tide judge the loud.",
          "proud",
        ),
      ),
      onObjective(
        "prophet",
        "completed",
        banner("THE BREACH", "The front breaks through anyway"),
        say(
          ARCHON,
          "I served a liar for forty years. Whatever comes through that front, I will meet it at her side.",
          "grim",
        ),
      ),
    ],
    debriefAppend: [
      debriefLine(
        HERALD,
        "The Prophet is silent, and the Tide is in the Reach. Zaelthar has put his seal on the Dreamer's word. Hers is the only voice left.",
        "solemn",
      ),
      debriefLine(
        DREAMER,
        "I know what the Ascension costs. A mind sealed into the lock. I remember who paid it, Templar. I will not ask you to.",
        "solemn",
      ),
    ],
  },
};
