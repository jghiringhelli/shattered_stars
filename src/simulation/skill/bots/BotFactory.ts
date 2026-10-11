/**
 * BotFactory — a fresh pilot of a tier (bots keep per-ship memory, so every
 * ship gets its own instance).
 *
 * Pure: no Phaser.
 */

import type { PilotBot, SkillTier } from "../SkillTypes";
import { AverageBot } from "./AverageBot";
import { ExpertBot } from "./ExpertBot";
import { NoviceBot } from "./NoviceBot";

/**
 * @param tier - Skill tier.
 * @returns A new bot of that tier with the tier's default profile.
 */
export function createBot(tier: SkillTier): PilotBot {
  if (tier === "novice") return new NoviceBot();
  if (tier === "average") return new AverageBot();
  return new ExpertBot();
}
