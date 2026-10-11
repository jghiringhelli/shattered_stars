/**
 * campaignSaveTypes — the persisted campaign playthrough (one per faction,
 * localStorage `shattered_stars_campaign_<faction>`). Version 3 adds the
 * SC2-style campaign state: story flags, branch choices, research, armory,
 * hero power ranks, bonus objectives and completion.
 */

import type { FactionId } from "../../config";

/** Current schema version. */
export const CAMPAIGN_SAVE_VERSION = 3;

/** A campaign pilot's persistent state. */
export interface CampaignPilotState {
  pilotId: string;
  currentShipId: string;
  pilotSkill: number; // 1-6, derived from xp
  xp: number;
  unlockedAbilityIds: string[];
  equippedAbilityIds: string[];
  statBonuses: {
    hull: number;
    shields: number;
    attack: number;
    agility: number;
  };
  evolutionChoiceIds: string[];
}

/** Installed armory mods and the price paid for each. */
export interface SavedArmory {
  installed: Record<string, number>;
}

/** One faction playthrough. */
export interface CampaignSaveData {
  version: number;
  factionId: FactionId;
  /** Legacy cursor: missions completed + 1. */
  currentMission: number;
  completedMissions: string[];
  totalXp: number;
  credits: number;
  totalKills: number;
  shipsLost: number;
  unlockedShips: string[];
  lastPlayed: number;
  campaignPilots: CampaignPilotState[];
  pendingEvolution: boolean;
  // ── v3 ──
  /** Story flags set by missions (consequences across scenarios). */
  storyFlags: Record<string, boolean>;
  /** Branch slot ("slot_<missionNumber>") → mission id chosen. */
  branchChoices: Record<string, string>;
  /** Research points earned this playthrough (cumulative). */
  researchPoints: number;
  /** Research tier id → option picked. */
  research: Record<string, "A" | "B">;
  armory: SavedArmory;
  /** Hero power id → rank (0 = locked). */
  heroPowerRanks: Record<string, number>;
  /** "missionId:objectiveId" of bonus objectives already rewarded. */
  bonusObjectivesCompleted: string[];
  /** The final mission has been won. */
  campaignComplete: boolean;
}
