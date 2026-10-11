/**
 * Void Corsairs mission designs (all acts), keyed by mission id.
 */

import type { MissionDesign } from "../campaignTypes";
import { CORSAIR_ACT1_DESIGNS } from "./corsairsAct1";
import { CORSAIR_ACT23_DESIGNS } from "./corsairsAct23";

export const CORSAIR_DESIGNS: Readonly<Record<string, MissionDesign>> = {
  ...CORSAIR_ACT1_DESIGNS,
  ...CORSAIR_ACT23_DESIGNS,
};
