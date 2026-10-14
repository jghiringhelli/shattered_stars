/**
 * Coalition campaign missions (story Acts IV-V, 8 missions): assembled from
 * the act files. Designs: ../designs/coalition.ts. The launcher replaces the
 * placeholder squad list with the lead hero's faction roster.
 */

import type { CampaignMission } from "../campaignTypes";
import { COALITION_ACT4A_MISSIONS } from "./coalitionAct4a";
import { COALITION_ACT4B_MISSIONS } from "./coalitionAct4b";
import { COALITION_ACT5_MISSIONS } from "./coalitionAct5";

export const COALITION_MISSIONS: CampaignMission[] = [
  ...COALITION_ACT4A_MISSIONS,
  ...COALITION_ACT4B_MISSIONS,
  ...COALITION_ACT5_MISSIONS,
];

/** Hub card text of the Coalition campaign. */
export const COALITION_INFO = {
  name: "The Coalition",
  description:
    "Five powers, one fleet: hold the line against the Void Tide, then decide what answers the Warden.",
  protagonist: "Your chosen hero, leading the Coalition squad",
} as const;
