/**
 * researchModel — the Research panel's view-model: the four tiers with their
 * two permanent options, the effect of each option and what each tier
 * needs, each with an explaining tooltip. Pure.
 */

import {
  RESEARCH_TREE,
  type ResearchOption,
  type ResearchPick,
  type ResearchTier,
} from "../../data/campaign/research";
import { termEntry, type TermId } from "../../data/tooltips";
import { bonusFacts, effectTooltip } from "./bonusFacts";
import type {
  OptionCard,
  OptionGroup,
  OptionPanelModel,
  OptionRow,
  Tone,
} from "./optionPanelTypes";

/** What the player has earned and chosen. */
export interface ResearchState {
  readonly points: number;
  readonly choices: Readonly<Record<string, ResearchPick>>;
  /** Option awaiting its confirming click ("tierId:A"). */
  readonly pending: string | null;
}

const TIER_TERMS: Readonly<Record<string, TermId>> = {
  hull_doctrine: "campaign.tier_hull_doctrine",
  command_doctrine: "campaign.tier_command_doctrine",
  logistics: "campaign.tier_logistics",
  weapons_doctrine: "campaign.tier_weapons_doctrine",
};

const PICKS = ["A", "B"] as const;

function optionOf(tier: ResearchTier, pick: ResearchPick): ResearchOption {
  return pick === "A" ? tier.optionA : tier.optionB;
}

function isLocked(tier: ResearchTier, state: ResearchState): boolean {
  return state.points < tier.requiredPoints;
}

function stateSentence(
  tier: ResearchTier,
  pick: ResearchPick,
  state: ResearchState,
): string {
  const chosen = state.choices[tier.id];
  if (chosen === pick)
    return "You chose this option: it is active for the rest of the campaign.";
  if (chosen !== undefined)
    return "Closed: you took the other option of this tier.";
  if (isLocked(tier, state))
    return `Locked: earn ${tier.requiredPoints} research points (you have ${state.points}).`;
  if (state.pending === `${tier.id}:${pick}`)
    return "Click again to make it permanent.";
  return "Click once to mark it and again to confirm. The choice is permanent.";
}

function optionTip(
  tier: ResearchTier,
  pick: ResearchPick,
  state: ResearchState,
): OptionCard["tip"] {
  const option = optionOf(tier, pick);
  const base = effectTooltip(option.name, option.description, bonusFacts(option.bonuses));
  return {
    ...base,
    howItPlays: `${stateSentence(tier, pick, state)} ${base.howItPlays ?? ""}`.trim(),
  };
}

function cardMark(
  tier: ResearchTier,
  pick: ResearchPick,
  state: ResearchState,
): { mark: string; tone: Tone } {
  if (state.choices[tier.id] === pick)
    return { mark: "\u2713 CHOSEN", tone: "good" };
  if (state.pending === `${tier.id}:${pick}`)
    return { mark: "CLICK AGAIN TO CONFIRM (PERMANENT)", tone: "warn" };
  return { mark: "", tone: "muted" };
}

function card(
  tier: ResearchTier,
  pick: ResearchPick,
  state: ResearchState,
): OptionCard {
  const chosen = state.choices[tier.id];
  const open = !isLocked(tier, state) && chosen === undefined;
  const { mark, tone } = cardMark(tier, pick, state);
  return {
    key: `${tier.id}:${pick}`,
    name: optionOf(tier, pick).name,
    mark,
    markTone: tone,
    dim: !open && chosen !== pick,
    actionKey: open ? `${tier.id}:${pick}` : null,
    tip: optionTip(tier, pick, state),
  };
}

function groupOf(tier: ResearchTier, state: ResearchState): OptionGroup {
  const name = tier.name.toUpperCase();
  const caption = isLocked(tier, state)
    ? `${name} \u00b7 LOCKED (${tier.requiredPoints} POINTS)`
    : state.choices[tier.id] !== undefined
      ? `${name} \u00b7 DECIDED`
      : name;
  return {
    caption,
    captionTip: TIER_TERMS[tier.id] ?? "campaign.research_points",
    cards: PICKS.map((pick) => card(tier, pick, state)),
  };
}

function effectRows(state: ResearchState): OptionRow[] {
  return RESEARCH_TREE.flatMap((tier) =>
    PICKS.map((pick) => {
      const option = optionOf(tier, pick);
      const chosen = state.choices[tier.id];
      const open = !isLocked(tier, state) && chosen === undefined;
      return {
        key: `${tier.id}:${pick}`,
        text: `${option.name} \u2014 ${option.description}`,
        tone: chosen === pick ? "good" : open ? "normal" : "muted",
        tip: optionTip(tier, pick, state),
        actionKey: open ? `${tier.id}:${pick}` : null,
      } satisfies OptionRow;
    }),
  );
}

function costRow(tier: ResearchTier, state: ResearchState): OptionRow {
  const chosen = state.choices[tier.id];
  const missing = tier.requiredPoints - state.points;
  const status = chosen
    ? `DECIDED: ${optionOf(tier, chosen).name.toUpperCase()}`
    : missing > 0
      ? `NEED ${missing} MORE`
      : "OPEN";
  const entry = termEntry("campaign.research_points");
  return {
    key: tier.id,
    text: `${tier.name} \u2014 ${tier.requiredPoints} points \u00b7 ${status}`,
    tone: chosen ? "good" : missing > 0 ? "warn" : "accent",
    tip: {
      title: `${tier.name} \u00b7 ${tier.requiredPoints} points`,
      body: `This tier opens once you have earned ${tier.requiredPoints} research points in total. You have ${state.points}.`,
      howItPlays: entry.definition,
      example: entry.example,
      glyph: "star",
    },
    actionKey: null,
  };
}

/**
 * @param state - Points earned, choices made, pending confirmation.
 * @returns The Research panel's groups, effect rows, cost rows and totals.
 */
export function researchModel(state: ResearchState): OptionPanelModel {
  return {
    title: `RESEARCH \u00b7 ${state.points} POINTS EARNED`,
    groups: RESEARCH_TREE.map((tier) => groupOf(tier, state)),
    effects: effectRows(state),
    costs: RESEARCH_TREE.map((tier) => costRow(tier, state)),
    summary: [
      {
        key: "points",
        text: `POINTS EARNED ${state.points}  \u00b7  CHOICES ARE PERMANENT`,
        tone: "accent",
        tip: "campaign.research_points",
        actionKey: null,
      },
    ],
  };
}
