/**
 * Lore overlay for the Corsair campaign, "The Plunder Path"
 * (docs/lore/campaigns/corsairs.md): assembled from the three act files.
 */

import type { FactionLore } from "../loreTypes";
import { CORSAIRS_ACT1_LORE } from "./corsairsLoreAct1";
import { CORSAIRS_ACT2_LORE } from "./corsairsLoreAct2";
import { CORSAIRS_ACT3_LORE } from "./corsairsLoreAct3";

export const CORSAIRS_LORE: FactionLore = {
  name: "The Plunder Path",
  description:
    "A deckhand with nightmares becomes the king of the lanes. Fly with Kira, the Admiral and Bloodfang from the Rookery's ashes to the Moot's throne, and learn what is worth more than the score.",
  protagonist: "Captain Zara Kira, Blackblade",
  missions: {
    ...CORSAIRS_ACT1_LORE,
    ...CORSAIRS_ACT2_LORE,
    ...CORSAIRS_ACT3_LORE,
  },
  epilogue: {
    add: [
      {
        speaker: "THE ADMIRAL",
        portraitKey: "portrait_the_admiral",
        text: "Keep the crown. I'm keeping the codes. Trust me.",
        when: { flag: "cors_gate_codes" },
      },
    ],
  },
};
