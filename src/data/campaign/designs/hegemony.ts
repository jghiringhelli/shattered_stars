/**
 * Hegemony mission designs (all acts), keyed by mission id.
 */

import type { MissionDesign } from "../campaignTypes";
import { HEGEMONY_ACT1_DESIGNS } from "./hegemonyAct1";
import { HEGEMONY_ACT23_DESIGNS } from "./hegemonyAct23";

export const HEGEMONY_DESIGNS: Readonly<Record<string, MissionDesign>> = {
  ...HEGEMONY_ACT1_DESIGNS,
  ...HEGEMONY_ACT23_DESIGNS,
};
