/**
 * Chronicle Manager — persists the global Chronicle (shared flags, crossover
 * canon, act completion, Free Order, ending) in localStorage
 * `shattered_stars_chronicle`. A missing Chronicle is seeded from the
 * faction playthroughs that already exist (v3 → v4); unreadable JSON is
 * backed up under `<key>_corrupt` before it is treated as empty.
 */

import { FACTION_CAMPAIGNS } from "../data/CampaignData";
import type { EndingId } from "../data/campaign/crossovers";
import { isEndingAllowed } from "../campaign/chronicle/endings";
import {
  emptyChronicle,
  recordVictory,
  seedChronicle,
} from "../campaign/chronicle/chronicleRules";
import { migrateChronicle } from "../campaign/chronicle/chronicleSchema";
import type {
  ChronicleData,
  ChronicleVictory,
} from "../campaign/chronicle/chronicleTypes";
import { CampaignSaveManager } from "./CampaignSaveManager";
import { browserStore } from "./keyValueStore";

/** localStorage key of the Chronicle. */
export const CHRONICLE_KEY = "shattered_stars_chronicle";
/** Suffix of the backup written when the Chronicle cannot be parsed. */
export const CHRONICLE_CORRUPT_SUFFIX = "_corrupt";

/** @returns A Chronicle built from the existing faction playthroughs. */
function seedFromSaves(): ChronicleData {
  return seedChronicle(
    CampaignSaveManager.getAllSaves().map((save) => ({
      faction: save.factionId,
      campaign: FACTION_CAMPAIGNS[save.factionId],
      completedMissions: save.completedMissions,
      storyFlags: save.storyFlags,
      lastPlayed: save.lastPlayed,
    })),
  );
}

export const ChronicleManager = {
  /** @returns The Chronicle (seeded and stored on first use). */
  load(): ChronicleData {
    let stored: string | null = null;
    try {
      stored = browserStore().getItem(CHRONICLE_KEY);
    } catch (e) {
      console.error("Failed to read the Chronicle:", e);
      return emptyChronicle();
    }
    if (stored) {
      try {
        const chronicle = migrateChronicle(JSON.parse(stored));
        if (chronicle) return chronicle;
      } catch (e) {
        console.error("Chronicle unreadable; backed up:", e);
        try {
          browserStore().setItem(CHRONICLE_KEY + CHRONICLE_CORRUPT_SUFFIX, stored);
        } catch {
          // Storage full: the original stays in place.
        }
      }
    }
    const seeded = seedFromSaves();
    this.save(seeded);
    return seeded;
  },

  /** @param chronicle - Chronicle to persist. */
  save(chronicle: ChronicleData): void {
    try {
      browserStore().setItem(CHRONICLE_KEY, JSON.stringify(chronicle));
    } catch (e) {
      console.error("Failed to save the Chronicle:", e);
    }
  },

  /**
   * @param victory - A mission win.
   * @returns The Chronicle after it (stored).
   */
  recordVictory(victory: ChronicleVictory): ChronicleData {
    const next = recordVictory(this.load(), victory);
    this.save(next);
    return next;
  },

  /**
   * @param freeOrder - Whether the cross-faction act conditions are lifted.
   * @returns The stored Chronicle.
   */
  setFreeOrder(freeOrder: boolean): ChronicleData {
    const next = { ...this.load(), freeOrder };
    this.save(next);
    return next;
  },

  /**
   * Records the ending (refused when the Chronicle does not allow it). The
   * first completed ending switches Free Order on.
   *
   * @param ending - The ending chosen.
   * @returns The stored Chronicle.
   */
  chooseEnding(ending: EndingId): ChronicleData {
    const current = this.load();
    if (!isEndingAllowed(current.flags, ending)) return current;
    const next = {
      ...current,
      ending,
      freeOrder: current.ending === null ? true : current.freeOrder,
    };
    this.save(next);
    return next;
  },

  /** Forgets the Chronicle (it is re-seeded from the saves on next load). */
  reset(): void {
    try {
      browserStore().removeItem(CHRONICLE_KEY);
    } catch (e) {
      console.error("Failed to reset the Chronicle:", e);
    }
  },
};
