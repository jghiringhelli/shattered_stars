/**
 * Campaign Save Manager
 *
 * Persists one campaign playthrough per faction in localStorage
 * (`shattered_stars_campaign_<faction>`). Loads validate and migrate any
 * older version (v1/v2 → v3) without losing data; unreadable JSON is backed
 * up under `<key>_corrupt` before the slot is treated as empty. Every
 * mission completion autosaves.
 */

import type { FactionId } from "../config";
import { browserStore } from "./keyValueStore";
import {
  CAMPAIGN_SAVE_VERSION,
  type CampaignPilotState,
  type CampaignSaveData,
} from "../campaign/save/campaignSaveTypes";
import {
  freshV3Fields,
  migrateCampaignSave,
} from "../campaign/save/campaignSaveSchema";
import {
  applyMissionCompletion,
  type CompletionResult,
  type MissionCompletionRecord,
} from "../campaign/save/missionCompletion";

export type { CampaignPilotState, CampaignSaveData };

const SAVE_KEY_PREFIX = "shattered_stars_campaign_";
/** Suffix of the backup written when a save cannot be parsed. */
export const CORRUPT_BACKUP_SUFFIX = "_corrupt";

const ALL_FACTIONS: readonly FactionId[] = [
  "terran_hegemony",
  "free_confederation",
  "synthetic_collective",
  "void_corsairs",
  "ascendant_empire",
];

/**
 * @param factionId - Faction.
 * @returns Its localStorage key.
 */
function keyOf(factionId: FactionId): string {
  return SAVE_KEY_PREFIX + factionId;
}

export const CampaignSaveManager = {
  /**
   * @param factionId - Faction.
   * @param initialPilots - Starting campaign pilots.
   * @returns A brand-new playthrough.
   */
  createNew(
    factionId: FactionId,
    initialPilots: CampaignPilotState[] = [],
  ): CampaignSaveData {
    return {
      version: CAMPAIGN_SAVE_VERSION,
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
      ...freshV3Fields(factionId),
    };
  },

  /** @param data - Playthrough to persist (lastPlayed is stamped). */
  save(data: CampaignSaveData): void {
    try {
      const toSave = { ...data, lastPlayed: Date.now() };
      browserStore().setItem(keyOf(toSave.factionId), JSON.stringify(toSave));
    } catch (e) {
      console.error("Failed to save campaign:", e);
    }
  },

  /**
   * @param factionId - Faction.
   * @returns Its playthrough (validated, migrated), or null when none.
   */
  load(factionId: FactionId): CampaignSaveData | null {
    let saved: string | null;
    try {
      saved = browserStore().getItem(keyOf(factionId));
    } catch (e) {
      console.error("Failed to read campaign:", e);
      return null;
    }
    if (!saved) return null;
    try {
      return migrateCampaignSave(JSON.parse(saved), factionId);
    } catch (e) {
      console.error("Campaign save unreadable; backed up:", e);
      try {
        browserStore().setItem(keyOf(factionId) + CORRUPT_BACKUP_SUFFIX, saved);
      } catch {
        // Storage full: the original stays in place, nothing else to do.
      }
      return null;
    }
  },

  /** @param factionId - Faction whose playthrough to delete. */
  delete(factionId: FactionId): void {
    try {
      browserStore().removeItem(keyOf(factionId));
    } catch (e) {
      console.error("Failed to delete campaign:", e);
    }
  },

  /**
   * @param factionId - Faction.
   * @returns Whether a playthrough is stored.
   */
  exists(factionId: FactionId): boolean {
    return browserStore().getItem(keyOf(factionId)) !== null;
  },

  /** @returns Every stored playthrough, most recently played first. */
  getAllSaves(): CampaignSaveData[] {
    return ALL_FACTIONS.map((f) => this.load(f))
      .filter((s): s is CampaignSaveData => s !== null)
      .sort((a, b) => b.lastPlayed - a.lastPlayed);
  },

  /**
   * Folds a won mission into the playthrough and autosaves.
   *
   * @param data - Save before the mission.
   * @param record - What the mission earned.
   * @returns The new save and the bonus payout.
   */
  recordVictory(
    data: CampaignSaveData,
    record: MissionCompletionRecord,
  ): CompletionResult {
    const result = applyMissionCompletion(data, record);
    this.save(result.save);
    return result;
  },

  /**
   * Legacy completion API (no flags/bonuses); autosaves.
   *
   * @returns The updated save.
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
    pendingEvolution?: boolean,
  ): CampaignSaveData {
    return this.recordVictory(data, {
      missionId,
      xp: xpEarned,
      credits: creditsEarned,
      kills,
      shipsLost,
      unlocks: newUnlocks,
      pilots: pilotUpdates,
      pendingEvolution,
    }).save;
  },

  /**
   * Applies a pilot's evolution choice and saves.
   *
   * @param data - Save.
   * @param updatedPilots - Pilots after the choice.
   * @returns The updated save.
   */
  applyEvolutionChoice(
    data: CampaignSaveData,
    updatedPilots: CampaignPilotState[],
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
   * Migrates an older save object to the current schema.
   *
   * @param oldData - A save of any older version.
   * @returns It in the current schema.
   */
  migrate(
    oldData: Partial<CampaignSaveData> & Pick<CampaignSaveData, "factionId">,
  ): CampaignSaveData {
    return (
      migrateCampaignSave(oldData, oldData.factionId) ??
      this.createNew(oldData.factionId)
    );
  },
};
