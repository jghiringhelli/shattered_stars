/**
 * Lore overlay for the Confederation campaign, "Libre"
 * (docs/lore/campaigns/confederation.md): assembled from the three act files.
 */

import type { FactionLore } from "../loreTypes";
import { CONFEDERATION_ACT1_LORE } from "./confederationLoreAct1";
import { CONFEDERATION_ACT2_LORE } from "./confederationLoreAct2";
import { CONFEDERATION_ACT3_LORE } from "./confederationLoreAct3";

export const CONFEDERATION_LORE: FactionLore = {
  name: "Libre",
  description:
    "A deserter learns what freedom costs, liberates Halden, and answers the enemy's ceasefire. Lead the cells from the Nest to the last gate.",
  protagonist: "Cdr. Aria Santos (Libre One), Phoenix One, Doc Vasquez",
  missions: {
    ...CONFEDERATION_ACT1_LORE,
    ...CONFEDERATION_ACT2_LORE,
    ...CONFEDERATION_ACT3_LORE,
  },
  epilogue: {
    add: [
      {
        speaker: "DOC VASQUEZ",
        portraitKey: "portrait_doc_vasquez",
        text: "Every family we pulled out of the Nest has a home on Halden now. Strand runs the hospital.",
        when: { flag: "conf_nest_evacuated" },
      },
      {
        speaker: "SANTOS",
        portraitKey: "portrait_commander_santos",
        text: "Chen kept his word. So will we.",
        when: { flag: "x14_ceasefire_called" },
      },
    ],
  },
};
