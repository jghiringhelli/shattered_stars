/**
 * Survival roguelite — view models for the choice overlay (pure, no
 * Phaser). Every card shows its rule text plus a right-hand note: price,
 * lock reason, synergy hint or archetype.
 */

import type { Power } from "../../data/survival/powers";
import type { HangarOption } from "../../data/survival/hangar";
import type { Mutation } from "../../data/survival/mutations";
import type { Relic } from "../../data/survival/relics";
import { ARCHETYPE_SETS, ARCHETYPE_SET_SIZE } from "../../data/survival/relics";
import {
  archetypeCounts,
  synergyMatches,
} from "../../data/survival/relicCatalog";
import type { SurvivalEvent } from "../../data/survival/eventTypes";
import { META_UNLOCKS } from "../../data/survival/metaUnlocks";
import { SKIP_DRAFT_SALVAGE } from "../../data/survival/economy";
import { choiceAvailability } from "../../systems/survival/EventResolver";
import type { ShopItem } from "../../systems/survival/ShopService";
import type { DockOption } from "../../systems/survival/RepairDock";
import type { MetaProfile } from "../../systems/survival/MetaProgression";
import type { RunState } from "../../systems/survival/RunTypes";
import type { ChoiceCard } from "./SurvivalChoicePanel";

/** Salvage glyph used in notes. */
export const SALVAGE_GLYPH = "⚙";

/**
 * @param powers - The drafted powers.
 * @param rerolls - Reroll charges left.
 * @returns Power cards, then "Reroll" (disabled without charges), then "Skip".
 */
export function powerCards(
  powers: readonly Power[],
  rerolls: number,
): ChoiceCard[] {
  return [
    ...powers.map((p) => ({
      icon: p.icon,
      name: p.name,
      description: p.description,
      note: p.tier === "atom" ? p.branch : p.tier,
    })),
    {
      icon: "🎲",
      name: "Reroll draft",
      description: "Spend a reroll charge to redraw these powers",
      note: `${rerolls} left`,
      disabled: rerolls <= 0,
    },
    {
      icon: "⏭",
      name: "Skip",
      description: `Take ${SKIP_DRAFT_SALVAGE} salvage instead`,
      note: `+${SKIP_DRAFT_SALVAGE} ${SALVAGE_GLYPH}`,
    },
  ];
}

/**
 * @param relic - A relic on offer.
 * @param owned - Relics the run owns.
 * @returns Its card: rule text + tags, and the synergy / set note.
 */
export function relicCard(relic: Relic, owned: readonly string[]): ChoiceCard {
  const matches = synergyMatches(relic, owned);
  const count = archetypeCounts(owned)[relic.archetype] + 1;
  const set = ARCHETYPE_SETS[relic.archetype];
  const setNote = `${set.name} ${Math.min(count, ARCHETYPE_SET_SIZE)}/${ARCHETYPE_SET_SIZE}`;
  return {
    icon: relic.icon,
    name: `${relic.name} (${relic.rarity})`,
    description: `${relic.description}  [${relic.tags.join("] [")}]`,
    note: matches > 0 ? `${setNote} · synergy ×${matches}` : setNote,
  };
}

/**
 * @param relics - Relics on offer.
 * @param run - The run.
 * @returns Relic cards, then "Reroll" (disabled without charges).
 */
export function relicCards(
  relics: readonly Relic[],
  run: RunState,
): ChoiceCard[] {
  return [
    ...relics.map((r) => relicCard(r, run.relics)),
    {
      icon: "🎲",
      name: "Reroll relics",
      description: "Spend a reroll charge to redraw",
      note: `${run.rerolls} left`,
      disabled: run.rerolls <= 0,
    },
  ];
}

/**
 * @param options - Hangar options.
 * @returns Their cards.
 */
export function hangarCards(options: readonly HangarOption[]): ChoiceCard[] {
  return options.map((o) => ({
    icon: o.icon,
    name: o.name,
    description: o.description,
  }));
}

/**
 * @param mutations - The slot's mutually exclusive mutations.
 * @returns Their cards (the behaviour change is the description).
 */
export function mutationCards(mutations: readonly Mutation[]): ChoiceCard[] {
  return mutations.map((m) => ({
    icon: m.icon,
    name: m.name,
    description: m.description,
    note: `${m.slot} mutation`,
  }));
}

/**
 * @param event - The event.
 * @param run - The run (judges costs and blue options).
 * @returns One card per choice, locked ones disabled with the reason.
 */
export function eventCards(event: SurvivalEvent, run: RunState): ChoiceCard[] {
  return event.choices.map((choice) => {
    const availability = choiceAvailability(run, choice);
    const note =
      availability.reason ??
      (choice.cost
        ? `-${choice.cost} ${SALVAGE_GLYPH}`
        : choice.gamble
          ? `${Math.round(choice.gamble.chance * 100)}%`
          : "");
    return {
      icon: choice.requires?.faction ? "🔷" : choice.gamble ? "🎲" : "▸",
      name: choice.label,
      description: choice.description,
      disabled: !availability.enabled,
      ...(note ? { note } : {}),
    };
  });
}

/**
 * @param stock - The shop's shelf.
 * @returns Item cards, then "Leave shop".
 */
export function shopCards(stock: readonly ShopItem[]): ChoiceCard[] {
  return [
    ...stock.map((item) => ({
      icon: item.icon,
      name: item.name,
      description: item.description,
      note: item.reason ?? `${item.price} ${SALVAGE_GLYPH}`,
      disabled: !item.available,
    })),
    {
      icon: "🚪",
      name: "Leave shop",
      description: "Undock and return to the map",
    },
  ];
}

/**
 * @param options - Repair-dock options.
 * @returns Their cards.
 */
export function dockCards(options: readonly DockOption[]): ChoiceCard[] {
  return options.map((o) => ({
    icon: o.icon,
    name: o.name,
    description: o.description,
    disabled: !o.enabled,
    ...(o.enabled ? {} : { note: "Max level" }),
  }));
}

/**
 * @param meta - The meta profile.
 * @returns One card per unlock (owned / locked / price), then "Close".
 */
export function metaUnlockCards(meta: MetaProfile): ChoiceCard[] {
  return [
    ...META_UNLOCKS.map((u) => {
      const owned = meta.unlocked.includes(u.id);
      const blocked =
        u.requires !== undefined && !meta.unlocked.includes(u.requires);
      const note = owned ? "Owned" : blocked ? "Locked" : `${u.cost} ★`;
      return {
        icon: u.icon,
        name: u.name,
        description: u.description,
        note,
        disabled: owned || blocked || meta.charts < u.cost,
      };
    }),
    {
      icon: "✖",
      name: "Close",
      description: `Star Charts: ${meta.charts} ★ (earned every run, win or lose)`,
    },
  ];
}
