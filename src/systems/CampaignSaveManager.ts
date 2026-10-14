/**
 * Campaign Save Manager
 *
 * Persists one campaign playthrough per faction in localStorage
 * (`shattered_stars_campaign_<slot>`; the slot is the faction, or `coalition`
 * for the shared Coalition campaign). Loads validate and migrate any
 * older version (v1/v2/v3 → v4) without losing data; unreadable JSON is backed
 * up under `<key>_corrupt` before the slot is treated as empty. Every
 * mission completion autosaves.
 */

import type { FactionId } from "../config";
import { browserStore } from "./keyValueStore";
import {
  CAMPAIGN_SAVE_VERSION,
  type CampaignPilotState,
  type CampaignSaveData,
  type CampaignSlot,
  COALITION_SLOT,
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
 * @param slot - Save slot.
 * @returns Its localStorage key.
 */
function keyOf(slot: CampaignSlot): string {
  return SAVE_KEY_PREFIX + slot;
}

/**
 * @param slot - Save slot.
 * @param raw - The parsed save.
 * @returns The player faction: the slot, or the stored lead hero of a
 *   Coalition save (the Hegemony when missing or invalid).
 */
function factionOfSlot(slot: CampaignSlot, raw: unknown): FactionId {
  if (slot !== COALITION_SLOT) return slot;
  const stored = (raw as { factionId?: unknown } | null)?.factionId;
  return ALL_FACTIONS.find((f) => f === stored) ?? ALL_FACTIONS[0]!;
}

export const CampaignSaveManager = {
  /**
   * @param factionId - Faction.
   * @param initialPilots - Starting campaign pilots.
   * @param slot - Save slot (defaults to the faction).
   * @returns A brand-new playthrough.
   */
  createNew(
    factionId: FactionId,
    initialPilots: CampaignPilotState[] = [],
    slot: CampaignSlot = factionId,
  ): CampaignSaveData {
    return {
      version: CAMPAIGN_SAVE_VERSION,
      factionId,
      slot,
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
      browserStore().setItem(
        keyOf(toSave.slot ?? toSave.factionId),
        JSON.stringify(toSave),
      );
    } catch (e) {
      console.error("Failed to save campaign:", e);
    }
  },

  /**
   * @param slot - Faction, or `coalition`.
   * @returns Its playthrough (validated, migrated), or null when none.
   */
  load(slot: CampaignSlot): CampaignSaveData | null {
    let saved: string | null;
    try {
      saved = browserStore().getItem(keyOf(slot));
    } catch (e) {
      console.error("Failed to read campaign:", e);
      return null;
    }
    if (!saved) return null;
    try {
      const raw: unknown = JSON.parse(saved);
      return migrateCampaignSave(raw, factionOfSlot(slot, raw), slot);
    } catch (e) {
      console.error("Campaign save unreadable; backed up:", e);
      try {
        browserStore().setItem(keyOf(slot) + CORRUPT_BACKUP_SUFFIX, saved);
      } catch {
        // Storage full: the original stays in place, nothing else to do.
      }
      return null;
    }
  },

  /** @param slot - Slot whose playthrough to delete. */
  delete(slot: CampaignSlot): void {
    try {
      browserStore().removeItem(keyOf(slot));
    } catch (e) {
      console.error("Failed to delete campaign:", e);
    }
  },

  /**
   * @param slot - Slot.
   * @returns Whether a playthrough is stored.
   */
  exists(slot: CampaignSlot): boolean {
    return browserStore().getItem(keyOf(slot)) !== null;
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
      migrateCampaignSave(oldData, oldData.factionId, oldData.slot) ??
      this.createNew(oldData.factionId)
    );
  },
};
