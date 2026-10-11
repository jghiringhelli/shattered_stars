/**
 * BotDifficulty — how a battle's difficulty label maps onto the bots that
 * fly it. The in-game AI and the skill gates fly the same bots, so a label
 * picks a tier that is measured by the gates:
 *
 * | label            | tier    | reaction scale | reaction / decision cadence |
 * |------------------|---------|----------------|-----------------------------|
 * | easy             | novice  | 1              | 500 ms / 300 ms             |
 * | normal, medium   | average | 1              | 250 ms / 150 ms             |
 * | hard             | expert  | 1              | 120 ms / 50 ms              |
 * | brutal, mythic   | expert  | 0.5            | 60 ms / 25 ms               |
 * | anything else    | average | 1              | 250 ms / 150 ms             |
 *
 * Pure: no Phaser.
 */

import type { BotProfile, BotTier } from "./BotTypes";
import { TIER_PROFILES } from "./bots/BotKit";

/** Brutal (and Epic "mythic") = expert with this multiplier on reaction and cadence. */
export const BRUTAL_REACTION_SCALE = 0.5;

/** The tier and reaction a difficulty label flies with. */
export interface BotSkill {
  readonly tier: BotTier;
  /** Multiplier on the tier's reaction delay and decision interval (< 1 = faster). */
  readonly reactionScale: number;
}

const SKILL_BY_LABEL: Readonly<Record<string, BotSkill>> = {
  easy: { tier: "novice", reactionScale: 1 },
  normal: { tier: "average", reactionScale: 1 },
  medium: { tier: "average", reactionScale: 1 },
  hard: { tier: "expert", reactionScale: 1 },
  brutal: { tier: "expert", reactionScale: BRUTAL_REACTION_SCALE },
  mythic: { tier: "expert", reactionScale: BRUTAL_REACTION_SCALE },
};

/** What an unknown label flies with. */
export const DEFAULT_BOT_SKILL: BotSkill = {
  tier: "average",
  reactionScale: 1,
};

/**
 * @param difficulty - A mode's difficulty label ("easy" | "normal" | "hard" |
 *   "brutal", Epic's "medium" / "mythic", or anything else).
 * @returns The bot tier and reaction scale for that label.
 */
export function difficultyToTier(difficulty: string): BotSkill {
  return SKILL_BY_LABEL[difficulty.toLowerCase()] ?? DEFAULT_BOT_SKILL;
}

/**
 * A tier's profile with its reaction delay and decision interval scaled.
 *
 * @param tier - Bot tier.
 * @param reactionScale - Multiplier (1 = the tier as measured by the gates).
 * @returns The scaled profile.
 */
export function botProfile(tier: BotTier, reactionScale = 1): BotProfile {
  const base = TIER_PROFILES[tier];
  if (reactionScale === 1) return base;
  return {
    ...base,
    reactionMs: base.reactionMs * reactionScale,
    decisionIntervalMs: base.decisionIntervalMs * reactionScale,
  };
}
