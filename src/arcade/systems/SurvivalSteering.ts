/**
 * SurvivalSteering — who flies Survival's AI ships. Every wave enemy and
 * every escort is a BotPilot (the same bots the skill gates measure, flying
 * through the player's controls); this module picks its tier.
 *
 * Survival has no difficulty selector — the wave is the difficulty. In the
 * roguelite run the "wave" fed here is the battle node's *effective wave*
 * (CombatNodePlan: sector 1 → 1–4, sector 2 → 5–8, sector 3 → 9–12, +3 at
 * ascension 3), so sector 1 flies novices, sector 2 average pilots and
 * sector 3 average pilots turning expert from its fifth row:
 *
 * | ship            | waves 1–3 | waves 4–10 | wave 11+ |
 * |-----------------|-----------|------------|----------|
 * | regular / elite | novice    | average    | expert   |
 * | sector boss     | average in sector 1, expert after      |
 * | escort (player) | average   | average    | average  |
 *
 * Elites fly the wave's tier (their edge is +50 % hull, +1 die and an
 * affix; an Ace affix adds one tier); a roguelite sector boss flies its
 * sector's boss tier (survivalBossTier); endless milestone bosses are
 * experts. Elites one tier up and experts from wave 9 made sector-2/3
 * elites and sector-3 combat nodes walls for an average pilot (ADR-0004).
 *
 * Pure: no Phaser.
 */

import type { BotTier } from "../ai/BotTypes";
import type { WaveTier } from "./SurvivalLoadouts";

/** Last wave whose regulars fly as novices. */
export const NOVICE_LAST_WAVE = 3;

/** Last wave whose regulars fly as average pilots (experts after it). */
export const AVERAGE_LAST_WAVE = 10;

/** Tier of every milestone boss of the endless waves. */
export const SURVIVAL_BOSS_TIER: BotTier = "expert";

/**
 * Tier of each roguelite sector boss (sector 1 average, experts after).
 * An expert sector-1 boss beat an average-tier 2-ship wing ~75 % of the
 * time (ADR-0004 sweep).
 */
export const SURVIVAL_SECTOR_BOSS_TIERS: readonly BotTier[] = [
  "average",
  "expert",
  "expert",
];

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
 * @returns The tier its BotPilot flies at (elites fly the wave's tier).
 */
export function survivalEnemyTier(wave: number, rank: WaveTier): BotTier {
  if (rank === "boss") return SURVIVAL_BOSS_TIER;
  return survivalWaveTier(wave);
}

/**
 * @param sector - The roguelite sector (1-based).
 * @returns The tier its boss flies at (later sectors keep the last tier).
 */
export function survivalBossTier(sector: number): BotTier {
  const tiers = SURVIVAL_SECTOR_BOSS_TIERS;
  return tiers[Math.min(Math.max(1, sector), tiers.length) - 1]!;
}
