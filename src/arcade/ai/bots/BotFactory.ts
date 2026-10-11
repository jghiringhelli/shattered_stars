/**
 * BotFactory — a fresh pilot of a tier (bots keep per-ship memory, so every
 * ship gets its own instance).
 *
 * Pure: no Phaser.
 */

import type { BotProfile, BotTier, PilotBot } from "../BotTypes";
import { AverageBot } from "./AverageBot";
import { TIER_PROFILES } from "./BotKit";
import { ExpertBot } from "./ExpertBot";
import { NoviceBot } from "./NoviceBot";

/**
 * @param tier - Skill tier.
 * @param profile - Reaction, cadence and noise (the tier's own by default).
 * @returns A new bot of that tier.
 */
export function createBot(
  tier: BotTier,
  profile: BotProfile = TIER_PROFILES[tier],
): PilotBot {
  if (tier === "novice") return new NoviceBot(profile);
  if (tier === "average") return new AverageBot(profile);
  return new ExpertBot(profile);
}
