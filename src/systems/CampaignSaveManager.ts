/**
 * Campaign Save Manager
 *
 * Handles saving and loading campaign progress to localStorage.
 * Versioned save schema for future compatibility.
 */

import type { FactionId } from '../config';

export interface CampaignPilotState {
  pilotId: string;
  currentShipId: string;
  pilotSkill: number;          // 1-6, derived from xp
  xp: number;
  unlockedAbilityIds: string[];
  equippedAbilityIds: string[];
  statBonuses: { hull: number; shields: number; attack: number; agility: number };
  evolutionChoiceIds: string[];
}

export interface CampaignSaveData {
  version: number;
  factionId: FactionId;
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
}

const SAVE_VERSION = 2;
const SAVE_KEY_PREFIX = 'shattered_stars_campaign_';

export const CampaignSaveManager = {
  /**
   * Create new campaign save data
   */
  createNew(factionId: FactionId, initialPilots: CampaignPilotState[] = []): CampaignSaveData {
    return {
      version: SAVE_VERSION,
      factionId,
      currentMission: 1,
      completedMissions: [],
      totalXp: 0,
      credits: 0,
      totalKills: 0,
      shipsLost: 0,
      unlockedShips: [],
      lastPlayed: Date.now(),
      campaignPilots: initialPilots,
      pendingEvolution: false,
    };
  },

  /**
   * Save campaign progress
   */
  save(data: CampaignSaveData): void {
    try {
      const toSave = { ...data, lastPlayed: Date.now() };
      const key = SAVE_KEY_PREFIX + toSave.factionId;
      localStorage.setItem(key, JSON.stringify(toSave));
    } catch (e) {
      console.error('Failed to save campaign:', e);
    }
  },

  /**
   * Load campaign progress
   */
  load(factionId: FactionId): CampaignSaveData | null {
    try {
      const key = SAVE_KEY_PREFIX + factionId;
      const saved = localStorage.getItem(key);
      if (!saved) return null;

      const data = JSON.parse(saved) as CampaignSaveData;

      // Version migration if needed
      if (data.version < SAVE_VERSION) {
        return this.migrate(data);
      }

      return data;
    } catch (e) {
      console.error('Failed to load campaign:', e);
      return null;
    }
  },

  /**
   * Delete campaign save
   */
  delete(factionId: FactionId): void {
    try {
      const key = SAVE_KEY_PREFIX + factionId;
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Failed to delete campaign:', e);
    }
  },

  /**
   * Check if campaign exists
   */
  exists(factionId: FactionId): boolean {
    const key = SAVE_KEY_PREFIX + factionId;
    return localStorage.getItem(key) !== null;
  },

  /**
   * Get all campaign saves
   */
  getAllSaves(): CampaignSaveData[] {
    const saves: CampaignSaveData[] = [];
    const factions: FactionId[] = ['terran_hegemony', 'free_confederation', 'synthetic_collective', 'void_corsairs', 'ascendant_empire'];

    for (const factionId of factions) {
      const save = this.load(factionId);
      if (save) {
        saves.push(save);
      }
    }

    return saves.sort((a, b) => b.lastPlayed - a.lastPlayed);
  },

  /**
   * Update campaign after mission completion
   */
  completeMission(
    data: CampaignSaveData,
    missionId: string,
    xpEarned: number,
    creditsEarned: number,
    kills: number,
    shipsLost: number,
    newUnlocks: string[],
    pilotUpdates?: CampaignPilotState[],
    pendingEvolution?: boolean
  ): CampaignSaveData {
    const updated = { ...data };

    if (!updated.completedMissions.includes(missionId)) {
      updated.completedMissions.push(missionId);
      updated.currentMission++;
    }

    updated.totalXp += xpEarned;
    updated.credits += creditsEarned;
    updated.totalKills += kills;
    updated.shipsLost += shipsLost;

    for (const unlock of newUnlocks) {
      if (!updated.unlockedShips.includes(unlock)) {
        updated.unlockedShips.push(unlock);
      }
    }

    if (pilotUpdates !== undefined) {
      updated.campaignPilots = pilotUpdates;
    }

    if (pendingEvolution !== undefined) {
      updated.pendingEvolution = pendingEvolution;
    }

    this.save(updated);
    return updated;
  },

  /**
   * Apply a pilot's evolution choice and save
   */
  applyEvolutionChoice(
    data: CampaignSaveData,
    updatedPilots: CampaignPilotState[]
  ): CampaignSaveData {
    const updated = {
      ...data,
      campaignPilots: updatedPilots,
      pendingEvolution: false,
    };
    this.save(updated);
    return updated;
  },

  /**
   * Migrate old save to new version
   */
  migrate(oldData: CampaignSaveData): CampaignSaveData {
    // v1 → v2: add pilot state fields
    if (oldData.version < 2) {
      return {
        ...oldData,
        version: SAVE_VERSION,
        campaignPilots: [],
        pendingEvolution: false,
      };
    }
    return { ...oldData, version: SAVE_VERSION };
  },
};
