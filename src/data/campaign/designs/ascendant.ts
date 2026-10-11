/**
 * Ascendant Empire mission designs (all acts), keyed by mission id.
 */

import type { MissionDesign } from "../campaignTypes";
import { ASCENDANT_ACT1_DESIGNS } from "./ascendantAct1";
import { ASCENDANT_ACT23_DESIGNS } from "./ascendantAct23";

export const ASCENDANT_DESIGNS: Readonly<Record<string, MissionDesign>> = {
  ...ASCENDANT_ACT1_DESIGNS,
  ...ASCENDANT_ACT23_DESIGNS,
};
