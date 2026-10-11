/**
 * setupDefaults — what mode setup screens preselect from the player's
 * Settings (Gameplay › Default Difficulty). Dogfight, Ace Duel and
 * Continuous share the settings scale; Boss Raid has its own four tiers,
 * mapped by rank. Pure: no Phaser.
 */

import type { EpicDifficulty } from "../../arcade/systems/EpicAiFlight";
import type { DifficultyLevel } from "../../systems/settingsSchema";

/** Boss Raid tier of the same rank as each settings level. */
const RAID_TIER: Readonly<Record<DifficultyLevel, EpicDifficulty>> = {
  easy: "easy",
  normal: "medium",
  hard: "hard",
  brutal: "mythic",
};

/**
 * @param level - Settings default difficulty.
 * @returns The Boss Raid tier to preselect.
 */
export function raidDifficultyFor(level: DifficultyLevel): EpicDifficulty {
  return RAID_TIER[level];
}

/**
 * Decides when a setup screen adopts the Settings default: on first entry
 * and whenever the default changed since — never on a rematch (the scene
 * restarts but the player's own pick stands).
 */
export class SettingsDefaultPick<T> {
  private applied: DifficultyLevel | null = null;

  /**
   * @param toChoice - Maps a settings level onto the screen's own scale.
   */
  constructor(private readonly toChoice: (level: DifficultyLevel) => T) {}

  /**
   * @param current - The Settings default right now.
   * @returns The choice to preselect, or null to keep the current one.
   */
  next(current: DifficultyLevel): T | null {
    if (current === this.applied) return null;
    this.applied = current;
    return this.toChoice(current);
  }
}
