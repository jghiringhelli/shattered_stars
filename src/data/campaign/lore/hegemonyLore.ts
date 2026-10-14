/**
 * Lore overlay for the Hegemony campaign, "The Iron Fist"
 * (docs/lore/campaigns/hegemony.md): assembled from the three act files.
 */

import type { FactionLore } from "../loreTypes";
import { HEGEMONY_ACT1_LORE } from "./hegemonyLoreAct1";
import { HEGEMONY_ACT2_LORE } from "./hegemonyLoreAct2";
import { HEGEMONY_ACT3_LORE_A } from "./hegemonyLoreAct3";
import { HEGEMONY_ACT3_LORE_B } from "./hegemonyLoreAct3Finale";

export const HEGEMONY_LORE: FactionLore = {
  name: "The Iron Fist",
  description:
    "An honest officer flying a dishonest war, until he finds out whose war it is. Command Iron Fist from the Tycho trials to the last gate at Brannoc.",
  protagonist: "Cdr. Marcus Chen, Iron Actual",
  missions: {
    ...HEGEMONY_ACT1_LORE,
    ...HEGEMONY_ACT2_LORE,
    ...HEGEMONY_ACT3_LORE_A,
    ...HEGEMONY_ACT3_LORE_B,
  },
  epilogue: {
    swaps: [
      [
        "Vance's network is ash. The Hegemony stands — cleaner than before.",
        "Vance is in a cell. The Hegemony stands, cleaner than before. And the gates are dark.",
      ],
      [
        "Phoenix testified before the Senate.",
        "Phoenix testified before the Directorate.",
      ],
    ],
  },
};