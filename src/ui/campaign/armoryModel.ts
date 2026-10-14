/**
 * armoryModel — the Armory panel's view-model: the eight mods by slot, their
 * effects and their credit cost, each with an explaining tooltip. Pure.
 */

import {
  ARMORY_MODS,
  ARMORY_SLOTS,
  type ArmoryMod,
  type ArmorySlot,
} from "../../data/campaign/armory";
import { armoryHint } from "../../data/roleHints";
import { termEntry, type TermId } from "../../data/tooltips";
import type { TooltipContent } from "../menu/tooltipContent";
import { bonusFacts, effectTooltip } from "./bonusFacts";
import type {
  OptionCard,
  OptionPanelModel,
  OptionRow,
  Tone,
} from "./optionPanelTypes";

/** What the player owns. */
export interface ArmoryState {
  readonly credits: number;
  /** Installed mod ids with the price paid for each. */
  readonly installed: Readonly<Record<string, number>>;
}

const SLOT_TERMS: Readonly<Record<ArmorySlot, TermId>> = {
  hull: "campaign.armory_slot_hull",
  shields: "campaign.armory_slot_shields",
  weapons: "campaign.armory_slot_weapons",
  systems: "campaign.armory_slot_systems",
};

/** Credits still missing to install a mod (a swap refunds the slot's mod first). */
function missingCredits(mod: ArmoryMod, state: ArmoryState): number {
  if (state.installed[mod.id] !== undefined) return 0;
  const refund = ARMORY_MODS.filter(
    (other) => other.slot === mod.slot && other.id !== mod.id,
  ).reduce((sum, other) => sum + (state.installed[other.id] ?? 0), 0);
  return Math.max(0, mod.cost - state.credits - refund);
}

function howToBuy(mod: ArmoryMod, state: ArmoryState, missing: number): string {
  const paid = state.installed[mod.id];
  if (paid !== undefined)
    return `Installed. Click to uninstall it and get your ${paid} credits back.`;
  if (missing > 0)
    return `You need ${missing} more credits. Missions and bonus objectives pay them out.`;
  return `Click to install it for ${mod.cost} credits. It replaces the other ${mod.slot} mod and refunds it.`;
}

function overviewCard(mod: ArmoryMod, state: ArmoryState): OptionCard {
  const missing = missingCredits(mod, state);
  const installed = state.installed[mod.id] !== undefined;
  const hint = armoryHint(mod);
  return {
    key: mod.id,
    name: mod.name,
    mark: installed ? "\u2713 INSTALLED" : "",
    markTone: "good",
    dim: !installed && missing > 0,
    actionKey: mod.id,
    tip: {
      title: mod.name,
      body: mod.description,
      role: hint.role,
      bestWith: hint.bestWith,
      playstyle: hint.playstyle,
      howItPlays: howToBuy(mod, state, missing),
    },
  };
}

function effectRow(mod: ArmoryMod, state: ArmoryState): OptionRow {
  return {
    key: mod.id,
    text: `${mod.name} \u2014 ${mod.description}`,
    tone: state.installed[mod.id] !== undefined ? "good" : "normal",
    tip: effectTooltip(mod.name, mod.description, bonusFacts(mod.bonuses)),
    actionKey: mod.id,
  };
}

function costTip(mod: ArmoryMod, state: ArmoryState, missing: number): TooltipContent {
  const entry = termEntry("campaign.armory_credits");
  return {
    title: `${mod.name} \u00b7 ${mod.cost} CR`,
    body: `${howToBuy(mod, state, missing)} You have ${state.credits} credits.`,
    howItPlays: entry.definition,
    example: entry.example,
    glyph: "points",
  };
}

function costRow(mod: ArmoryMod, state: ArmoryState): OptionRow {
  const missing = missingCredits(mod, state);
  const installed = state.installed[mod.id] !== undefined;
  const status = installed
    ? "INSTALLED"
    : missing > 0
      ? `NEED ${missing} MORE`
      : "AFFORDABLE";
  const tone: Tone = installed ? "good" : missing > 0 ? "warn" : "accent";
  return {
    key: mod.id,
    text: `${mod.name} \u2014 ${mod.cost} CR \u00b7 ${status}`,
    tone,
    tip: costTip(mod, state, missing),
    actionKey: mod.id,
  };
}

/**
 * @param state - Credits and installed mods.
 * @returns The Armory panel's groups, effect rows, cost rows and totals.
 */
export function armoryModel(state: ArmoryState): OptionPanelModel {
  const paid = Object.values(state.installed).reduce((sum, p) => sum + p, 0);
  return {
    title: `ARMORY \u00b7 ${state.credits} CREDITS`,
    groups: ARMORY_SLOTS.map((slot) => ({
      caption: slot.toUpperCase(),
      captionTip: SLOT_TERMS[slot],
      cards: ARMORY_MODS.filter((mod) => mod.slot === slot).map((mod) =>
        overviewCard(mod, state),
      ),
    })),
    effects: ARMORY_MODS.map((mod) => effectRow(mod, state)),
    costs: ARMORY_MODS.map((mod) => costRow(mod, state)),
    summary: [
      {
        key: "credits",
        text: `CREDITS ${state.credits}  \u00b7  INSTALLED ${paid} CR  \u00b7  RESPEC REFUNDS ALL`,
        tone: "accent",
        tip: "campaign.armory_credits",
        actionKey: null,
      },
    ],
  };
}
