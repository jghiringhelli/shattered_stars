/**
 * coalitionLaunch — what the shared Coalition campaign needs beyond a faction
 * campaign: the lead hero choice (whose ships and powers the player flies),
 * the Coalition save (veteran hero powers, the lead's credits and research
 * carried over) and the mission adapted to the lead. Pure.
 */

import type { FactionId } from "../../config";
import { FACTION_CAMPAIGNS } from "../../data/CampaignData";
import type { CampaignMission } from "../../data/campaign/campaignTypes";
import { heroPowerRanksFor } from "../powers/heroPowerState";
import {
  COALITION_SLOT,
  type CampaignSaveData,
} from "../save/campaignSaveTypes";

/** Missions a faction campaign has: the lead flies as a veteran of them all. */
const VETERAN_MISSIONS = 15;

/** The factions whose hero can lead the Coalition. */
export const COALITION_LEADS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

/** A lead hero as the picker shows it. */
export interface LeadHero {
  readonly name: string;
  readonly powers: string;
}

/** The five leads: hero and hero powers (docs/specs/campaign.md §5). */
export const LEAD_HEROES: Readonly<Record<FactionId, LeadHero>> = {
  terran_hegemony: {
    name: "Admiral Chen",
    powers: "Orbital Strike · Shield Overcharge",
  },
  free_confederation: {
    name: "Commander Santos",
    powers: "Rally the Fleet · Field Repairs",
  },
  synthetic_collective: {
    name: "OMEGA-7",
    powers: "Drone Swarm · EMP Burst",
  },
  void_corsairs: {
    name: "Captain Kira",
    powers: "Cloak Dash · Scatter Mines",
  },
  ascendant_empire: {
    name: "The Dreamer and Kaeth",
    powers: "Time-Slow Focus · Psionic Lance",
  },
};

/**
 * @param lead - The lead hero's faction.
 * @returns Mission-local flags naming the lead (`lead_<faction>`).
 */
export function leadFlags(lead: FactionId): Record<string, boolean> {
  return { [`lead_${lead}`]: true };
}

/**
 * @param lead - The lead hero's faction.
 * @param base - A fresh save of the lead faction (see CampaignSaveManager).
 * @param leadSave - The lead faction's own playthrough, if any.
 * @returns A new Coalition save: slot `coalition`, hero powers at veteran
 *   ranks, and the lead's credits, research and armory carried over.
 */
export function createCoalitionSave(
  lead: FactionId,
  base: CampaignSaveData,
  leadSave: CampaignSaveData | null,
): CampaignSaveData {
  return {
    ...base,
    factionId: lead,
    slot: COALITION_SLOT,
    heroPowerRanks: heroPowerRanksFor(lead, VETERAN_MISSIONS),
    credits: leadSave?.credits ?? 0,
    researchPoints: leadSave?.researchPoints ?? 0,
    research: { ...(leadSave?.research ?? {}) },
    armory: { installed: { ...(leadSave?.armory.installed ?? {}) } },
    unlockedShips: [...(leadSave?.unlockedShips ?? [])],
  };
}

/**
 * @param mission - A Coalition mission (placeholder squad).
 * @param lead - The lead hero's faction.
 * @returns The mission with the lead faction's finale roster as the squad.
 */
export function missionForLead(
  mission: CampaignMission,
  lead: FactionId,
): CampaignMission {
  const roster = FACTION_CAMPAIGNS[lead].missions.reduce((best, m) =>
    m.missionNumber >= best.missionNumber ? m : best,
  ).playerShips;
  return { ...mission, playerShips: [...roster] };
}
