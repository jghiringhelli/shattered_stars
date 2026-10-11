/**
 * researchRules — unlocking and choosing Research tiers. Tiers unlock by
 * research points earned; each choice is permanent for the playthrough
 * (no respec, unlike the Armory). Pure.
 */

import {
  RESEARCH_TREE,
  type ResearchOption,
  type ResearchPick,
  type ResearchTier,
} from "../../data/campaign/research";

/** Tier id → chosen option. */
export type ResearchChoices = Readonly<Record<string, ResearchPick>>;

/** Why a choice was refused. */
export type ResearchRefusal = "unknown_tier" | "locked" | "already_chosen";

/** Result of a research choice. */
export type ResearchResult =
  | { readonly ok: true; readonly choices: ResearchChoices }
  | { readonly ok: false; readonly reason: ResearchRefusal };

/**
 * @param pointsEarned - Research points earned this playthrough.
 * @returns Tiers unlocked so far, in order.
 */
export function unlockedResearchTiers(pointsEarned: number): ResearchTier[] {
  return RESEARCH_TREE.filter((tier) => pointsEarned >= tier.requiredPoints);
}

/**
 * @param choices - Current choices.
 * @param pointsEarned - Research points earned.
 * @param tierId - Tier to resolve.
 * @param pick - Option chosen.
 * @returns New choices, or why the choice was refused.
 */
export function chooseResearch(
  choices: ResearchChoices,
  pointsEarned: number,
  tierId: string,
  pick: ResearchPick,
): ResearchResult {
  const tier = RESEARCH_TREE.find((t) => t.id === tierId);
  if (!tier) return { ok: false, reason: "unknown_tier" };
  if (choices[tierId] !== undefined)
    return { ok: false, reason: "already_chosen" };
  if (pointsEarned < tier.requiredPoints)
    return { ok: false, reason: "locked" };
  return { ok: true, choices: { ...choices, [tierId]: pick } };
}

/**
 * @param choices - Research choices.
 * @returns The options chosen, in tree order.
 */
export function chosenResearchOptions(
  choices: ResearchChoices,
): ResearchOption[] {
  return RESEARCH_TREE.flatMap((tier) => {
    const pick = choices[tier.id];
    if (pick === undefined) return [];
    return [pick === "A" ? tier.optionA : tier.optionB];
  });
}

/**
 * @param pointsEarned - Research points earned.
 * @param choices - Research choices.
 * @returns Unlocked tiers still waiting for a choice.
 */
export function pendingResearchTiers(
  pointsEarned: number,
  choices: ResearchChoices,
): ResearchTier[] {
  return unlockedResearchTiers(pointsEarned).filter(
    (t) => choices[t.id] === undefined,
  );
}
