/**
 * BotDifficulty — how a battle's difficulty label maps onto the bots that
 * fly it. The in-game AI and the skill gates fly the same bots, so a label
 * picks a tier that is measured by the gates, and a reaction scale that
 * tunes it between tiers. The scales were set on the real engine (an
 * average "player" bot against each label, every mode — docs/balance/):
 * Easy ~85–100 %, Normal ~50 %, Hard ~15–30 %, Brutal ~10 % in duels and
 * classic squads.
 *
 * | label            | tier    | reaction scale | reaction / decision cadence |
 * |------------------|---------|----------------|-----------------------------|
 * | easy             | novice  | 0.7            | 350 ms / 210 ms             |
 * | normal, medium   | average | 1              | 250 ms / 150 ms             |
 * | hard             | expert  | 1.75           | 210 ms / 88 ms              |
 * | brutal, mythic   | expert  | 1              | 120 ms / 50 ms              |
 * | anything else    | average | 1              | 250 ms / 150 ms             |
 *
 * Pure: no Phaser.
 */

import type { BotProfile, BotTier } from "./BotTypes";
import { TIER_PROFILES } from "./bots/BotKit";

/**
 * Easy = a novice reacting this much faster: at 1 the average bot won 97 %
 * of Dogfights against it; at 0.7, 85 %.
 */
export const EASY_REACTION_SCALE = 0.7;

/**
 * Hard = an expert reacting this much slower: at 1 (the old Hard) the
 * average bot won only 6–13 %, a cliff after Normal's 50 %; at 1.75 it wins
 * 24 % (Dogfight), 31 % (Ace Duel), 14 % (classic squads).
 */
export const HARD_REACTION_SCALE = 1.75;

/** Brutal (and Epic "mythic") = the expert as the skill gates measure it. */
export const BRUTAL_REACTION_SCALE = 1;

/** The tier and reaction a difficulty label flies with. */
export interface BotSkill {
  readonly tier: BotTier;
  /** Multiplier on the tier's reaction delay and decision interval (< 1 = faster). */
  readonly reactionScale: number;
}

const SKILL_BY_LABEL: Readonly<Record<string, BotSkill>> = {
  easy: { tier: "novice", reactionScale: EASY_REACTION_SCALE },
  normal: { tier: "average", reactionScale: 1 },
  medium: { tier: "average", reactionScale: 1 },
  hard: { tier: "expert", reactionScale: HARD_REACTION_SCALE },
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
