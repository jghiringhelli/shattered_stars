/**
 * Free Confederation mission designs (all acts), keyed by mission id.
 */

import type { MissionDesign } from "../campaignTypes";
import { CONFEDERATION_ACT1_DESIGNS } from "./confederationAct1";
import { CONFEDERATION_ACT23_DESIGNS } from "./confederationAct23";

export const CONFEDERATION_DESIGNS: Readonly<Record<string, MissionDesign>> = {
  ...CONFEDERATION_ACT1_DESIGNS,
  ...CONFEDERATION_ACT23_DESIGNS,
};
