/**
 * BotDifficulty — how a battle's difficulty label maps onto the bots that
 * fly it. The in-game AI and the skill gates fly the same bots, so a label
 * picks a tier that is measured by the gates, and a reaction scale that
 * tunes it between tiers. The scales were set on the real engine (an
 * average "player" bot against each label — docs/balance/), targeting Easy
 * ~80 %, Normal ~50 %, Hard ~25–30 %, Brutal ~10–15 %.
 *
 * Duels (Dogfight, Ace Duel) — {@link difficultyToTier}:
 *
 * | label            | tier    | reaction scale | reaction / decision cadence |
 * |------------------|---------|----------------|-----------------------------|
 * | easy             | average | 2.2            | 550 ms / 330 ms             |
 * | normal, medium   | average | 1              | 250 ms / 150 ms             |
 * | hard             | expert  | 1.55           | 186 ms / 78 ms              |
 * | brutal, mythic   | expert  | 0.85           | 102 ms / 43 ms              |
 * | anything else    | average | 1              | 250 ms / 150 ms             |
 *
 * One mapping cannot fit both duels, so each mode may override a label
 * (`difficultyToTier(label, mode)`): Dogfight Brutal flies the expert at
 * ×1.15, Ace Duel Hard at ×1.5.
 *
 * Squad modes (Skirmish, Scenario, Continuous, Epic escorts) crew a side
 * slot by slot — {@link squadSkillPlan}.
 *
 * Pure: no Phaser.
 */

import type { BotProfile, BotTier } from "./BotTypes";
import { TIER_PROFILES } from "./bots/BotKit";

/**
 * Easy = an average pilot reacting this much slower. Once the bots stopped
 * weaving (PilotHands stale-turn fix) any novice lost ~100 % of duels to the
 * average bot; average at ×2 won it 74 % (Dogfight) / 81 % (Ace Duel), ×3
 * 95–97 %.
 */
export const EASY_REACTION_SCALE = 2.2;

/**
 * Hard = an expert reacting this much slower: ×1.75 left the average bot
 * 34 % (Dogfight) / 39 % (Ace Duel), ×1.4 21 % / 25 %.
 */
export const HARD_REACTION_SCALE = 1.55;

/**
 * Brutal (and Epic "mythic") = an expert reacting this much faster than the
 * gates' expert: ×1 left 11 % (Dogfight) / 17 % (Ace Duel), ×0.7 14 % (Ace).
 */
export const BRUTAL_REACTION_SCALE = 0.85;

/** The tier and reaction a difficulty label flies with. */
export interface BotSkill {
  readonly tier: BotTier;
  /** Multiplier on the tier's reaction delay and decision interval (< 1 = faster). */
  readonly reactionScale: number;
}

/** Training opponents (Flight School's exam): a novice reacting a little faster. */
export const TRAINING_SKILL: BotSkill = { tier: "novice", reactionScale: 0.7 };

const SKILL_BY_LABEL: Readonly<Record<string, BotSkill>> = {
  easy: { tier: "average", reactionScale: EASY_REACTION_SCALE },
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

/** The duel modes with their own measured mapping. */
export type DuelMode = "dogfight" | "ace";

/**
 * Dogfight Brutal: the shared ×0.85 expert left the average player bot 6 %
 * of the default pairing; ×0.95–1.3 all measure 11–12 % (2026-10-12).
 */
export const DOGFIGHT_BRUTAL_REACTION_SCALE = 1.15;

/**
 * Ace Duel Hard: the shared ×1.55 expert left the average player bot 36 %
 * of the presets; ×1.25 18 %, ×1.35 20 %, ×1.45 25 %, ×1.5 29 % (2026-10-12).
 */
export const ACE_HARD_REACTION_SCALE = 1.5;

/** Per-mode overrides of {@link SKILL_BY_LABEL} (unlisted labels share it). */
const DUEL_MODE_SKILLS: Readonly<
  Record<DuelMode, Readonly<Record<string, BotSkill>>>
> = {
  dogfight: {
    brutal: { tier: "expert", reactionScale: DOGFIGHT_BRUTAL_REACTION_SCALE },
  },
  ace: {
    hard: { tier: "expert", reactionScale: ACE_HARD_REACTION_SCALE },
  },
};

/**
 * @param difficulty - A mode's difficulty label ("easy" | "normal" | "hard" |
 *   "brutal", Epic's "medium" / "mythic", or anything else).
 * @param mode - The duel mode, for its own measured mapping (omitted = the
 *   shared one: Epic raids, any other caller).
 * @returns The bot tier and reaction scale for that label.
 */
export function difficultyToTier(
  difficulty: string,
  mode?: DuelMode,
): BotSkill {
  const label = difficulty.toLowerCase();
  const own = mode ? DUEL_MODE_SKILLS[mode][label] : undefined;
  return own ?? SKILL_BY_LABEL[label] ?? DEFAULT_BOT_SKILL;
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

/** How a squad battle is fought: one squad each (classic) or reinforcement pools. */
export type SquadFormat = "classic" | "reinforced";

/** Classic-squad Hard: an expert reacting this much slower (27.5 %). */
export const CLASSIC_HARD_REACTION_SCALE = 1.2;
/** Classic-squad Brutal: an expert reacting this much faster (19 %). */
export const CLASSIC_BRUTAL_REACTION_SCALE = 0.35;
/** Reinforced / Scenario Hard: an expert reacting this much slower (27 %). */
export const REINFORCED_HARD_REACTION_SCALE = 1.75;
/** Reinforced / Scenario Brutal: an expert reacting this much faster (16 %). */
export const REINFORCED_BRUTAL_REACTION_SCALE = 0.4;

/**
 * How a difficulty label crews an AI squad: a skill per ship slot (cycled —
 * slot i flies `slots[i % slots.length]`, reinforcements continuing the
 * count) and whether its leader marks a focus target.
 */
export interface SquadSkillPlan {
  readonly slots: readonly BotSkill[];
  readonly marks: boolean;
}

const skill = (tier: BotTier, reactionScale = 1): BotSkill => ({
  tier,
  reactionScale,
});

/**
 * Squad crews per label and format, measured on the real engine (an average
 * player bot's squad with the mark v the auto-fill opponent; classic 600
 * battles, reinforced 250 per cell — difficultyCurve, docs/balance/):
 * - a squad that never marks loses ~100 % to one that does (even average
 *   pilots), so every label marks and Easy is weakened by novice wingmen
 *   behind an average leader instead;
 * - classic squads (3–4 ships) compress toward 50 % while reinforcement
 *   pools (~10 ships a side over 3 minutes) amplify the better side, so the
 *   formats need different crews: Easy 84 % / 82–85 %, Hard expert at
 *   ×1.2 / ×1.75 reaction 27.5 % / 27 %, Brutal 19 % / 16 % (expert pilots
 *   are the bots' ceiling: ×0.35–0.6 reaction all land at 17–21 %).
 */
const SQUAD_PLANS: Readonly<
  Record<SquadFormat, Readonly<Record<string, SquadSkillPlan>>>
> = {
  classic: {
    easy: {
      slots: [skill("average"), skill("novice"), skill("novice")],
      marks: true,
    },
    normal: { slots: [skill("average")], marks: true },
    hard: {
      slots: [skill("expert", CLASSIC_HARD_REACTION_SCALE)],
      marks: true,
    },
    brutal: {
      slots: [skill("expert", CLASSIC_BRUTAL_REACTION_SCALE)],
      marks: true,
    },
  },
  reinforced: {
    easy: {
      slots: [skill("average"), skill("average"), skill("novice")],
      marks: true,
    },
    normal: { slots: [skill("average")], marks: true },
    hard: {
      slots: [skill("expert", REINFORCED_HARD_REACTION_SCALE)],
      marks: true,
    },
    brutal: {
      slots: [skill("expert", REINFORCED_BRUTAL_REACTION_SCALE)],
      marks: true,
    },
  },
};

/** Label aliases (Epic's names). */
const SQUAD_LABEL_ALIASES: Readonly<Record<string, string>> = {
  medium: "normal",
  mythic: "brutal",
};

/**
 * @param difficulty - A squad mode's difficulty label (any case; Epic's
 *   "medium" / "mythic" map to normal / brutal; unknown = normal).
 * @param format - Classic squads or reinforcement pools.
 * @returns The crew plan of an AI squad at that difficulty.
 */
export function squadSkillPlan(
  difficulty: string,
  format: SquadFormat = "classic",
): SquadSkillPlan {
  const label = difficulty.toLowerCase();
  const plans = SQUAD_PLANS[format];
  return plans[SQUAD_LABEL_ALIASES[label] ?? label] ?? plans["normal"]!;
}

/**
 * @param plan - A squad's crew plan.
 * @param slot - The ship's slot (0-based enlistment order on its side).
 * @returns The skill that ship flies with.
 */
export function squadSlotSkill(plan: SquadSkillPlan, slot: number): BotSkill {
  const index =
    ((Math.floor(slot) % plan.slots.length) + plan.slots.length) %
    plan.slots.length;
  return plan.slots[index]!;
}

/**
 * @param plan - A squad's crew plan.
 * @returns The skill its squad command perceives with: its quickest pilot.
 */
export function squadLeaderSkill(plan: SquadSkillPlan): BotSkill {
  return plan.slots.reduce((best, s) =>
    botProfile(s.tier, s.reactionScale).reactionMs <
    botProfile(best.tier, best.reactionScale).reactionMs
      ? s
      : best,
  );
}
