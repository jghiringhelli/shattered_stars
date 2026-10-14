/**
 * buildTooltips — tooltip content for the parts of a quick build the picker
 * shows: slot chips, upgrade cards and the pilot's ability. Pure
 * (catalogue data + the tooltip catalog); no Phaser.
 */

import {
  explainQuickBuild,
  pilotAbilityHint,
  quickBuildHint,
  upgradeHint,
} from "../../data/roleHints";
import type { ShipLoadout } from "../../data/ShipLoadouts";
import type {
  AbilitySummary,
  FilledSlot,
  UpgradeSummary,
} from "../../data/quickBuildDetails";
import { slotDisplayName } from "../../data/encyclopedia/codexTypes";
import { slotTermId, termEntry } from "../../data/tooltips";
import { UPGRADE_DEFINITIONS } from "../../systems/UpgradeSystem";
import type { TooltipContent } from "../menu/tooltipContent";

/**
 * @param slot - One slot of the build's slot bar.
 * @returns What hovering its chip says: the slot type, what is in it and an example.
 */
export function slotChipTooltip(slot: FilledSlot): TooltipContent {
  const entry = termEntry(slotTermId(slot.type));
  const contents = slot.upgradeName ? `holds ${slot.upgradeName}` : "is empty";
  const origin = slot.fromPilot ? " Added by the pilot." : "";
  return {
    title: `${slotDisplayName(slot.type)} slot ${contents}`,
    body: `${entry.definition}${origin}`,
    example: entry.example,
    ...(entry.howItPlays ? { howItPlays: entry.howItPlays } : {}),
  };
}

/**
 * @param upgrade - An upgrade of the build.
 * @returns Its slot, real-time reading, role hint and the slot's example.
 */
export function upgradeTooltip(upgrade: UpgradeSummary): TooltipContent {
  const card = UPGRADE_DEFINITIONS[upgrade.id];
  const slot = termEntry(slotTermId(upgrade.slotType));
  const hint = card ? upgradeHint(card) : undefined;
  return {
    title: `${upgrade.name} (${slotDisplayName(upgrade.slotType)})`,
    body: upgrade.summary || "A passive bonus that is always on.",
    example: slot.example,
    ...(hint
      ? { role: hint.role, bestWith: hint.bestWith, playstyle: hint.playstyle }
      : {}),
  };
}

/**
 * @param ability - The pilot's ability.
 * @returns Card text, real-time reading and role hint.
 */
export function abilityTooltip(ability: AbilitySummary): TooltipContent {
  const hint = pilotAbilityHint(ability.id);
  const reading = ability.summary || "No real-time effect";
  return {
    title: `Pilot ability — ${ability.name}`,
    body: ability.cardText ? `${ability.cardText}\nIn battle: ${reading}.` : `In battle: ${reading}.`,
    role: hint.role,
    bestWith: hint.bestWith,
    playstyle: hint.playstyle,
  };
}

/**
 * @param loadout - A quick build.
 * @returns What hovering its payload toggle says: name and price, when to
 *   pick it, its role line, who it pairs with and a play-style example.
 */
export function buildToggleTooltip(loadout: ShipLoadout): TooltipContent {
  const hint = quickBuildHint(loadout);
  return {
    title: `${loadout.name} — ${loadout.pointCost} pts`,
    body: explainQuickBuild(loadout).whenToPick,
    role: hint.role,
    bestWith: hint.bestWith,
    playstyle: hint.playstyle,
  };
}