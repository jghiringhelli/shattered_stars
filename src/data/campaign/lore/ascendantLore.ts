/**
 * Lore overlay for the Ascendant campaign, "The Prophecy"
 * (docs/lore/campaigns/ascendant.md): assembled from the act files.
 */

import type { FactionLore } from "../loreTypes";
import { ASCENDANT_ACT1_LORE } from "./ascendantLoreAct1";
import { ASCENDANT_ACT2_LORE } from "./ascendantLoreAct2";
import { ASCENDANT_ACT3_LORE } from "./ascendantLoreAct3";
import { ASCENDANT_FINALE_LORE } from "./ascendantLoreFinale";

export const ASCENDANT_LORE: FactionLore = {
  name: "The Prophecy",
  description:
    "The faithful learn their scripture is a scar, and the Ascension they prayed for is a sacrifice. Fly as the Templar Kaeth, carrying the Dreamer, beside Archon Zaelthar and the Herald.",
  protagonist: "The Templar Kaeth, carrying the Dreamer",
  missions: {
    ...ASCENDANT_ACT1_LORE,
    ...ASCENDANT_ACT2_LORE,
    ...ASCENDANT_ACT3_LORE,
    ...ASCENDANT_FINALE_LORE,
  },
  epilogue: {
    swaps: [
      [
        "The vision is fulfilled. I see every star at once.",
        "The vision is fulfilled. Not as they preached it. As it was.",
      ],
    ],
  },
};
