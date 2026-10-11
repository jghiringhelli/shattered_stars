/**
 * Synthetic Collective mission designs (all acts), keyed by mission id.
 */

import type { MissionDesign } from "../campaignTypes";
import { SYNTHETIC_ACT1_DESIGNS } from "./syntheticAct1";
import { SYNTHETIC_ACT23_DESIGNS } from "./syntheticAct23";

export const SYNTHETIC_DESIGNS: Readonly<Record<string, MissionDesign>> = {
  ...SYNTHETIC_ACT1_DESIGNS,
  ...SYNTHETIC_ACT23_DESIGNS,
};
