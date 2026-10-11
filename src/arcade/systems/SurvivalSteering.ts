/**
 * SurvivalSteering — who flies Survival's AI ships. Every wave enemy and
 * every escort is a BotPilot (the same bots the skill gates measure, flying
 * through the player's controls); this module picks its tier.
 *
 * Survival has no difficulty selector — the wave is the difficulty. In the
 * roguelite run the "wave" fed here is the battle node's *effective wave*
 * (CombatNodePlan: sector 1 → 1–4, sector 2 → 5–8, sector 3 → 9–12, +3 at
 * ascension 3), so sector 1 flies novices, sector 2 average pilots and
 * sector 3 experts:
 *
 * | ship            | waves 1–3 | waves 4–8 | wave 9+ |
 * |-----------------|-----------|-----------|---------|
 * | regular         | novice    | average   | expert  |
 * | elite           | average   | expert    | expert  |
 * | sector boss     | expert    | expert    | expert  |
 * | escort (player) | average   | average   | average |
 *
 * Elites fly one tier above the wave's regulars (capped at expert; an Ace
 * affix adds one more); every sector boss is an expert.
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
