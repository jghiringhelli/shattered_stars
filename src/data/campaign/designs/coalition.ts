/**
 * Coalition designs (Acts IV-V), keyed by mission id: the five Act IV and
 * three Act V files assembled. Explicit hub prerequisites live in each design.
 */

import type { MissionDesign } from "../campaignTypes";
import { COALITION_ACT4A_DESIGNS } from "./coalitionAct4a";
import { COALITION_ACT4B_DESIGNS } from "./coalitionAct4b";
import { COALITION_ACT4C_DESIGNS } from "./coalitionAct4c";
import { COALITION_ACT4D_DESIGNS } from "./coalitionAct4d";
import { COALITION_ACT5A_DESIGNS } from "./coalitionAct5a";
import { COALITION_ACT5B_DESIGNS } from "./coalitionAct5b";
import { COALITION_ACT5C_DESIGNS } from "./coalitionAct5c";

export const COALITION_DESIGNS: Readonly<Record<string, MissionDesign>> = {
  ...COALITION_ACT4A_DESIGNS,
  ...COALITION_ACT4B_DESIGNS,
  ...COALITION_ACT4C_DESIGNS,
  ...COALITION_ACT4D_DESIGNS,
  ...COALITION_ACT5A_DESIGNS,
  ...COALITION_ACT5B_DESIGNS,
  ...COALITION_ACT5C_DESIGNS,
};
