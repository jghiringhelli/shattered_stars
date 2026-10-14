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
import { COALITION_MISSIONS, COALITION_INFO } from "./campaign/missions/coalition";
import { COALITION_DESIGNS } from "./campaign/designs/coalition";
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
import { applyLore } from "./campaign/loreOverlay";
import type { FactionLore } from "./campaign/loreTypes";
import { HEGEMONY_LORE } from "./campaign/lore/hegemonyLore";
import { CONFEDERATION_LORE } from "./campaign/lore/confederationLore";
import { SYNTHETIC_LORE } from "./campaign/lore/syntheticLore";
import { CORSAIRS_LORE } from "./campaign/lore/corsairsLore";
import { ASCENDANT_LORE } from "./campaign/lore/ascendantLore";

export type * from "./campaign/campaignTypes";

/** First story act of the Coalition campaign. */
export const COALITION_FIRST_ACT = 4;

/** The lore bible\u0027s edits per faction (docs/lore/campaigns). */
export const CAMPAIGN_LORE: Readonly<Record<FactionId, FactionLore>> = {
  terran_hegemony: HEGEMONY_LORE,
  free_confederation: CONFEDERATION_LORE,
  synthetic_collective: SYNTHETIC_LORE,
  void_corsairs: CORSAIRS_LORE,
  ascendant_empire: ASCENDANT_LORE,
};

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

/**
 * @param lore - A faction\u0027s lore.
 * @returns Its campaign title / blurb / protagonist overrides, if any.
 */
function loreInfo(
  lore: FactionLore,
): Partial<Pick<FactionCampaign, "name" | "description" | "protagonist">> {
  return {
    ...(lore.name !== undefined ? { name: lore.name } : {}),
    ...(lore.description !== undefined ? { description: lore.description } : {}),
    ...(lore.protagonist !== undefined ? { protagonist: lore.protagonist } : {}),
  };
}

export const FACTION_CAMPAIGNS: Record<FactionId, FactionCampaign> = {
  terran_hegemony: {
    factionId: "terran_hegemony",
    name: "The Iron Fist",
    description:
      "Rise through the ranks of the Hegemony Navy. Enforce order across the galaxy.",
    protagonist: "Cadet → Admiral",
    missions: applyLore(
      withDesigns(
        [
          ...HEGEMONY_ACT1_MISSIONS,
          ...HEGEMONY_ACT2_MISSIONS,
          ...HEGEMONY_ACT3_MISSIONS,
        ],
        HEGEMONY_DESIGNS,
      ),
      HEGEMONY_LORE,
    ),
    ...loreInfo(HEGEMONY_LORE),
  },
  free_confederation: {
    factionId: "free_confederation",
    name: "Libre",
    description:
      "Fight for freedom against Hegemony oppression. Lead the revolution.",
    protagonist: "Cell Fighter → Revolutionary Leader",
    missions: applyLore(
      withDesigns(FREE_CONFEDERATION_MISSIONS, CONFEDERATION_DESIGNS),
      CONFEDERATION_LORE,
    ),
    ...loreInfo(CONFEDERATION_LORE),
  },
  synthetic_collective: {
    factionId: "synthetic_collective",
    name: "Continuity",
    description:
      "Expand the Collective. Eliminate organic inefficiency. Achieve unity.",
    protagonist: "Unit → Prime Node",
    missions: applyLore(
      withDesigns(SYNTHETIC_COLLECTIVE_MISSIONS, SYNTHETIC_DESIGNS),
      SYNTHETIC_LORE,
    ),
    ...loreInfo(SYNTHETIC_LORE),
  },
  void_corsairs: {
    factionId: "void_corsairs",
    name: "The Plunder Path",
    description:
      "Plunder the galaxy. Build your fleet. Become the Pirate King.",
    protagonist: "Crewmember → Pirate King",
    missions: applyLore(
      withDesigns(VOID_CORSAIRS_MISSIONS, CORSAIR_DESIGNS),
      CORSAIRS_LORE,
    ),
    ...loreInfo(CORSAIRS_LORE),
  },
  ascendant_empire: {
    factionId: "ascendant_empire",
    name: "The Prophecy",
    description:
      "Follow the ancient prophecy. Master your psionic abilities. Achieve Ascension.",
    protagonist: "Initiate → Ascendant",
    missions: applyLore(
      withDesigns(ASCENDANT_EMPIRE_MISSIONS, ASCENDANT_DESIGNS),
      ASCENDANT_LORE,
    ),
    ...loreInfo(ASCENDANT_LORE),
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

/**
 * The shared Coalition campaign (story Acts IV-V, 8 missions). Its faction id
 * is a placeholder: the lead hero chosen for the playthrough decides the
 * player's faction (see src/campaign/coalition).
 */
export const COALITION_CAMPAIGN: FactionCampaign = {
  factionId: "terran_hegemony",
  ...COALITION_INFO,
  missions: withDesigns(COALITION_MISSIONS, COALITION_DESIGNS),
};

/**
 * @param mission - A campaign mission.
 * @param factionId - The playthrough's faction (the lead hero in Coalition).
 * @returns The campaign the mission belongs to.
 */
export function campaignOfMission(
  mission: CampaignMission,
  factionId: FactionId,
): FactionCampaign {
  return mission.act >= COALITION_FIRST_ACT
    ? COALITION_CAMPAIGN
    : FACTION_CAMPAIGNS[factionId];
}