/**
 * EpicAiFlight — who flies the Boss Raid's AI ships. Every AI ship is a
 * skill-gate bot (BotPilot) flying the player's controls: boss escorts at
 * the tier the raid difficulty maps to, the player's wingmen as average
 * pilots.
 *
 * Pure: no Phaser.
 */

import { difficultyToTier, type BotSkill } from "../ai/BotDifficulty";

/** Boss Raid difficulty tiers. */
export type EpicDifficulty = "easy" | "medium" | "hard" | "mythic";

/** Which side an AI ship flies for in a raid. */
export type EpicAiSide = "escort" | "wingman";

/** The player's wingmen fly as average pilots at every difficulty. */
export const WINGMAN_SKILL: BotSkill = { tier: "average", reactionScale: 1 };

/**
 * The bot that flies a raid AI ship: escorts at the raid difficulty's tier
 * (easy novice, medium average, hard expert, mythic expert with Brutal
 * reaction), wingmen always average.
 *
 * @param side - Escort (boss side) or wingman (player side).
 * @param difficulty - Raid difficulty.
 * @returns Tier and reaction scale.
 */
export function raidBotSkill(
  side: EpicAiSide,
  difficulty: EpicDifficulty,
): BotSkill {
  return side === "wingman" ? WINGMAN_SKILL : difficultyToTier(difficulty);
}
