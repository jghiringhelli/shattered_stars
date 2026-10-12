/**
 * EpicAiFlight — who flies the Boss Raid's AI ships. Every AI ship is a
 * skill-gate bot (BotPilot) flying the player's controls: boss escorts at
 * the tier the raid difficulty maps to, the player's wingmen as average
 * pilots.
 *
 * Pure: no Phaser.
 */

import {
  squadSkillPlan,
  squadSlotSkill,
  type BotSkill,
} from "../ai/BotDifficulty";

/** Boss Raid difficulty tiers. */
export type EpicDifficulty = "easy" | "medium" | "hard" | "mythic";

/** Which side an AI ship flies for in a raid. */
export type EpicAiSide = "escort" | "wingman";

/** The player's wingmen fly as average pilots at every difficulty. */
export const WINGMAN_SKILL: BotSkill = { tier: "average", reactionScale: 1 };

/**
 * The bot that flies a raid AI ship: escorts crewed slot by slot from the
 * raid difficulty's squad plan (BotDifficulty.squadSkillPlan, classic:
 * easy = an average leader with novice wingmen, medium average, hard /
 * mythic experts), wingmen always average.
 *
 * @param side - Escort (boss side) or wingman (player side).
 * @param difficulty - Raid difficulty.
 * @param slot - The escort's crew slot (0-based spawn order); default 0.
 * @returns Tier and reaction scale.
 */
export function raidBotSkill(
  side: EpicAiSide,
  difficulty: EpicDifficulty,
  slot = 0,
): BotSkill {
  return side === "wingman"
    ? WINGMAN_SKILL
    : squadSlotSkill(squadSkillPlan(difficulty, "classic"), slot);
}
