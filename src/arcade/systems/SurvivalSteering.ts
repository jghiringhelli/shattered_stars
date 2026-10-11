/**
 * SurvivalSteering — who flies Survival's AI ships. Every wave enemy and
 * every escort is a BotPilot (the same bots the skill gates measure, flying
 * through the player's controls); this module picks its tier.
 *
 * Survival has no difficulty selector — the wave is the difficulty:
 *
 * | ship            | waves 1–3 | waves 4–8 | wave 9+ |
 * |-----------------|-----------|-----------|---------|
 * | regular         | novice    | average   | expert  |
 * | elite           | average   | expert    | expert  |
 * | milestone boss  | expert    | expert    | expert  |
 * | escort (player) | average   | average   | average |
 *
 * Elites fly one tier above the wave's regulars (capped at expert); every
 * milestone boss (wave 5, 10, …) is an expert from the first one on.
 *
 * Pure: no Phaser.
 */

import type { BotTier } from "../ai/BotTypes";
import type { WaveTier } from "./SurvivalLoadouts";

/** Last wave whose regulars fly as novices. */
export const NOVICE_LAST_WAVE = 3;

/** Last wave whose regulars fly as average pilots (experts after it). */
export const AVERAGE_LAST_WAVE = 8;

/** Tier of every milestone boss. */
export const SURVIVAL_BOSS_TIER: BotTier = "expert";

/** Tier of the player's escorts (weak basic bodies, competent wingmen). */
export const SURVIVAL_ESCORT_TIER: BotTier = "average";

/** Tiers from weakest to strongest. */
const TIER_LADDER: readonly BotTier[] = ["novice", "average", "expert"];

/**
 * @param wave - Wave number (1-based).
 * @returns The tier the wave's regular ships fly at.
 */
export function survivalWaveTier(wave: number): BotTier {
  if (wave <= NOVICE_LAST_WAVE) return "novice";
  if (wave <= AVERAGE_LAST_WAVE) return "average";
  return "expert";
}

/**
 * @param tier - A bot tier.
 * @returns The next tier up (expert stays expert).
 */
export function tierAbove(tier: BotTier): BotTier {
  const index = TIER_LADDER.indexOf(tier);
  return TIER_LADDER[Math.min(index + 1, TIER_LADDER.length - 1)]!;
}

/**
 * @param wave - Wave number (1-based).
 * @param rank - The wave ship's rank (regular, elite, boss).
 * @returns The tier its BotPilot flies at.
 */
export function survivalEnemyTier(wave: number, rank: WaveTier): BotTier {
  if (rank === "boss") return SURVIVAL_BOSS_TIER;
  const regular = survivalWaveTier(wave);
  return rank === "elite" ? tierAbove(regular) : regular;
}
