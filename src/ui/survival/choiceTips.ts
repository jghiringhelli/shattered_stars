/**
 * Survival choice overlay — the tooltips of every card element (pure, no
 * Phaser). A card explains itself on hover; its tags, price and note each
 * get their own definition + example from the tooltip catalog.
 */

import {
  termEntry,
  type TermId,
} from "../../data/tooltips";
import {
  ARCHETYPE_SETS,
  type Relic,
  type SynergyTag,
} from "../../data/survival/relics";
import type { Power } from "../../data/survival/powers";
import type { ShopItemKind } from "../../systems/survival/ShopService";
import {
  contentFromTerm,
  type HintContent,
  type TooltipContent,
} from "../menu/tooltipContent";

/** A small tag chip on a card, with its own tooltip. */
export interface ChoiceChip {
  readonly label: string;
  readonly tip: TooltipContent;
}

/**
 * @param text - A phrase.
 * @returns The phrase ending in a full stop (tooltips show the first sentence).
 */
export function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/**
 * @param id - A catalog term.
 * @param title - Card-specific title.
 * @param body - Card-specific definition (the term's explanation follows).
 * @returns The term's content with the card's own title and body.
 */
export function cardTip(
  id: TermId,
  title: string,
  body: string,
): TooltipContent {
  return { ...contentFromTerm(id), title, body: sentence(body) };
}

/**
 * @param tag - A synergy tag.
 * @returns The tag as the player reads it (the Snap Turn keeps its in-game name).
 */
export function tagLabel(tag: SynergyTag): string {
  return tag === "k-turn" ? "snap-turn" : tag;
}

/**
 * @param tags - A relic's synergy tags.
 * @returns One chip per tag, each explained with a definition and an example.
 */
export function tagChips(tags: readonly SynergyTag[]): ChoiceChip[] {
  return tags.map((tag) => ({
    label: tagLabel(tag),
    tip: contentFromTerm(`survival.tag.${tag}`),
  }));
}

/**
 * @param relic - A relic on offer.
 * @param hint - Its role + best-with hint.
 * @returns The card tooltip: effect, rarity, role, best with, and the set bonus.
 */
export function relicTip(relic: Relic, hint: HintContent): TooltipContent {
  const set = termEntry(`survival.set.${relic.archetype}`);
  const rarity = termEntry(`survival.rarity.${relic.rarity}`);
  return {
    ...hint,
    title: relic.name,
    body: `${sentence(relic.description)} ${rarity.title.replace("Rarity: ", "")} relic.`,
    howItPlays: ARCHETYPE_SETS[relic.archetype].description,
    example: set.example,
  };
}

/**
 * @param relic - A relic.
 * @returns The tooltip of the set-progress note ("Hunter 2/3").
 */
export function relicNoteTip(relic: Relic): TooltipContent {
  return contentFromTerm(`survival.set.${relic.archetype}`);
}

/**
 * @param power - A drafted power.
 * @returns The card tooltip: effect, its tier and its branch.
 */
export function powerTip(power: Power): TooltipContent {
  const tier = termEntry(`survival.tier.${power.tier}`);
  const branch = termEntry(`survival.branch.${power.branch}`);
  return {
    title: power.name,
    body: sentence(power.description),
    howItPlays: `${tier.definition} ${branch.definition}`,
    example: branch.example,
  };
}

/**
 * @param power - A drafted power.
 * @returns The tooltip of the note: the branch of an atom, else the tier.
 */
export function powerNoteTip(power: Power): TooltipContent {
  return contentFromTerm(
    power.tier === "atom"
      ? `survival.branch.${power.branch}`
      : `survival.tier.${power.tier}`,
  );
}

const SHOP_KIND_TERM: Readonly<Record<ShopItemKind, TermId>> = {
  repair: "survival.shop_repair",
  relic: "survival.shop_relic",
  escort: "survival.shop_escort",
  upgrade: "survival.shop_upgrade",
  reroll: "survival.reroll",
};

/**
 * @param kind - What a shop item is.
 * @param title - The item's name.
 * @param body - The item's description.
 * @returns The item's tooltip.
 */
export function shopItemTip(
  kind: ShopItemKind,
  title: string,
  body: string,
): TooltipContent {
  return cardTip(SHOP_KIND_TERM[kind], title, body);
}
