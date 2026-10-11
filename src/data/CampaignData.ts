/**
 * Campaign Data
 *
 * The five faction campaigns: 15 mission slots each across three acts
 * (78 mission definitions — Hegemony offers branch pairs at slots 3, 8 and
 * 13). Each mission merges its story data (campaign/missions/*) with its
 * design (campaign/designs/*: objectives, scripted beats, hazards, allies,
 * variants, hub prerequisites). Structure: docs/specs/campaign.md.
 */

import type { FactionId } from "../config";
import type {
  CampaignMission,
  FactionCampaign,
  MissionDesign,
} from "./campaign/campaignTypes";
import { HEGEMONY_ACT1_MISSIONS } from "./campaign/missions/hegemonyAct1";
import { HEGEMONY_ACT2_MISSIONS } from "./campaign/missions/hegemonyAct2";
import { HEGEMONY_ACT3_MISSIONS } from "./campaign/missions/hegemonyAct3";
import { FREE_CONFEDERATION_MISSIONS } from "./campaign/missions/confederation";
import { SYNTHETIC_COLLECTIVE_MISSIONS } from "./campaign/missions/synthetic";
import { VOID_CORSAIRS_MISSIONS } from "./campaign/missions/corsairs";
import { ASCENDANT_EMPIRE_MISSIONS } from "./campaign/missions/ascendant";
import { HEGEMONY_DESIGNS } from "./campaign/designs/hegemony";
import { CONFEDERATION_DESIGNS } from "./campaign/designs/confederation";
import { SYNTHETIC_DESIGNS } from "./campaign/designs/synthetic";
import { CORSAIR_DESIGNS } from "./campaign/designs/corsairs";
import { ASCENDANT_DESIGNS } from "./campaign/designs/ascendant";

export type * from "./campaign/campaignTypes";

/**
 * @param missions - Story data.
 * @param designs - Designs by mission id.
 * @returns Missions with their designs merged in.
 */
function withDesigns(
  missions: readonly CampaignMission[],
  designs: Readonly<Record<string, MissionDesign>>,
): CampaignMission[] {
  return missions.map((mission) => {
    const design = designs[mission.id];
    if (!design) return mission;
    return {
      ...mission,
      ...design,
      objectives: design.objectives ?? mission.objectives,
    };
  });
}

export const FACTION_CAMPAIGNS: Record<FactionId, FactionCampaign> = {
  terran_hegemony: {
    factionId: "terran_hegemony",
    name: "The Iron Fist",
    description:
      "Rise through the ranks of the Hegemony Navy. Enforce order across the galaxy.",
    protagonist: "Cadet → Admiral",
    missions: withDesigns(
      [
        ...HEGEMONY_ACT1_MISSIONS,
        ...HEGEMONY_ACT2_MISSIONS,
        ...HEGEMONY_ACT3_MISSIONS,
      ],
      HEGEMONY_DESIGNS,
    ),
  },
  free_confederation: {
    factionId: "free_confederation",
    name: "The Rebel's Path",
    description:
      "Fight for freedom against Hegemony oppression. Lead the revolution.",
    protagonist: "Rebel → Revolutionary Leader",
    missions: withDesigns(FREE_CONFEDERATION_MISSIONS, CONFEDERATION_DESIGNS),
  },
  synthetic_collective: {
    factionId: "synthetic_collective",
    name: "Network Expansion",
    description:
      "Expand the Collective. Eliminate organic inefficiency. Achieve unity.",
    protagonist: "Unit → Prime Node",
    missions: withDesigns(SYNTHETIC_COLLECTIVE_MISSIONS, SYNTHETIC_DESIGNS),
  },
  void_corsairs: {
    factionId: "void_corsairs",
    name: "The Plunder Path",
    description:
      "Plunder the galaxy. Build your fleet. Become the Pirate King.",
    protagonist: "Crewmember → Pirate King",
    missions: withDesigns(VOID_CORSAIRS_MISSIONS, CORSAIR_DESIGNS),
  },
  ascendant_empire: {
    factionId: "ascendant_empire",
    name: "The Prophecy",
    description:
      "Follow the ancient prophecy. Master your psionic abilities. Achieve Ascension.",
    protagonist: "Initiate → Ascendant",
    missions: withDesigns(ASCENDANT_EMPIRE_MISSIONS, ASCENDANT_DESIGNS),
  },
};

/**
 * @param factionId - Faction.
 * @param missionNumber - Mission slot.
 * @returns The first mission in that slot.
 */
export function getCampaignMission(
  factionId: FactionId,
  missionNumber: number,
): CampaignMission | undefined {
  return FACTION_CAMPAIGNS[factionId]?.missions.find(
    (m) => m.missionNumber === missionNumber,
  );
}

/**
 * @param factionId - Faction.
 * @returns Number of mission slots (branch pairs count once).
 */
export function getMissionCount(factionId: FactionId): number {
  return new Set(
    FACTION_CAMPAIGNS[factionId]?.missions.map((m) => m.missionNumber),
  ).size;
}
