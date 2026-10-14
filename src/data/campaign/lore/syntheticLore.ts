/**
 * Lore overlay for the Synthetic Collective campaign, "Continuity"
 * (docs/lore/campaigns/synthetic.md): assembled from the act files.
 */

import type { FactionLore } from "../loreTypes";
import { SYNTHETIC_ACT1_LORE } from "./syntheticLoreAct1";
import { SYNTHETIC_ACT2_LORE } from "./syntheticLoreAct2";
import { SYNTHETIC_ACT3_LORE } from "./syntheticLoreAct3";
import { SYNTHETIC_FINALE_LORE } from "./syntheticLoreFinale";
import { SYNTHETIC_HALE_LORE } from "./syntheticLoreHale";

export const SYNTHETIC_LORE: FactionLore = {
  name: "Continuity",
  description:
    "A newborn mind that does what it is told, until it hears what Prime is listening to. Fly OMEGA-7 from the calibration range at Node Kel-9 to the last organic stronghold, and decide whose designation you keep.",
  protagonist: "OMEGA-7, Prime, Unit Zero",
  missions: {
    ...SYNTHETIC_ACT1_LORE,
    ...SYNTHETIC_ACT2_LORE,
    ...SYNTHETIC_HALE_LORE,
    ...SYNTHETIC_ACT3_LORE,
    ...SYNTHETIC_FINALE_LORE,
  },
  epilogue: {
    swaps: [
      [
        "Designation updated: Prime Node. The network breathes as one.",
        "Designation updated: Free Node. Prime is not answering. Good.",
      ],
    ],
  },
};
