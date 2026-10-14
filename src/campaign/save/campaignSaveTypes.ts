/**
 * campaignSaveTypes — the persisted campaign playthrough (one per faction,
 * localStorage `shattered_stars_campaign_<slot>`). Version 3 added the
 * SC2-style campaign state: story flags, branch choices, research, armory,
 * hero power ranks, bonus objectives and completion. Version 4 adds the save
 * slot (a faction campaign, or the shared Coalition) — cross-faction state
 * (shared flags, act completion, endings) lives in the Chronicle.
 */

import type { FactionId } from "../../config";

/** Current schema version. */
export const CAMPAIGN_SAVE_VERSION = 4;

/** Which playthrough a save belongs to: a faction campaign or the Coalition. */
export type CampaignSlot = FactionId | "coalition";

/** The Coalition campaign\u0027s slot. */
export const COALITION_SLOT = "coalition" as const;

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
  /** The player\u0027s faction (the lead hero in a Coalition save). */
  factionId: FactionId;
  // ── v4 ──
  /** Storage slot; equals factionId for a faction campaign. */
  slot: CampaignSlot;
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
