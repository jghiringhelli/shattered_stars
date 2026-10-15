/**
 * bonusFacts — armory mods and research options as plain facts ("+20%
 * hull"), each tied to the tooltip term that explains it, and the tooltip
 * that lists them with their definitions and examples. Pure: no Phaser.
 */

import type { CampaignShipBonuses } from "../../campaign/armory/bonusTypes";
import { termEntry, type TermId } from "../../data/tooltips";
import type { TooltipContent } from "../menu/tooltipContent";

/** One effect of a mod. */
export interface BonusFact {
  readonly label: string;
  readonly term: TermId;
}

const PERCENT = 100;

/** @returns "+20%" style text of a multiplier above 1. */
function gain(multiplier: number): string {
  return `+${Math.round((multiplier - 1) * PERCENT)}%`;
}

/** @returns "15%" — how far a multiplier below 1 cuts. */
function cut(multiplier: number): string {
  return `${Math.round((1 - multiplier) * PERCENT)}%`;
}

type FactBuilder = (value: number) => BonusFact;

/** Builders in display order. */
const FACTS: ReadonlyArray<readonly [keyof CampaignShipBonuses, FactBuilder]> = [
  ["hullMultiplier", (v) => ({ label: `${gain(v)} hull`, term: "campaign.bonus_hull" })],
  ["shieldMultiplier", (v) => ({ label: `${gain(v)} shields`, term: "campaign.bonus_shields" })],
  ["shieldRegenPerSecond", (v) => ({ label: `+${v} shield HP/s`, term: "campaign.bonus_regen" })],
  ["attackBonus", (v) => ({ label: `+${v} damage per hit`, term: "campaign.bonus_attack" })],
  ["agilityBonus", (v) => ({ label: `+${v} evasion`, term: "campaign.bonus_agility" })],
  ["secondaryReloadMultiplier", (v) => ({ label: `${cut(v)} faster ordnance and turrets`, term: "campaign.bonus_secondary_reload" })],
  ["maneuverRechargeMultiplier", (v) => ({ label: `${cut(v)} faster maneuver recharge`, term: "campaign.bonus_maneuver_recharge" })],
  ["damageTakenMultiplier", (v) => ({ label: `-${cut(v)} damage taken`, term: "campaign.bonus_damage_taken" })],
  ["powerCooldownMultiplier", (v) => ({ label: `-${cut(v)} power recharge`, term: "campaign.bonus_power_cooldown" })],
  ["creditMultiplier", (v) => ({ label: `${gain(v)} credits`, term: "campaign.bonus_credits" })],
  ["researchPerBonus", (v) => ({ label: `+${v} research per bonus objective`, term: "campaign.bonus_research" })],
  ["escortAttackBonus", (v) => ({ label: `+${v} wingman damage`, term: "campaign.bonus_wingmen" })],
];

/**
 * @param bonuses - Bonuses of an armory mod or research option.
 * @returns One fact per bonus, in a fixed order.
 */
export function bonusFacts(
  bonuses: Partial<CampaignShipBonuses>,
): readonly BonusFact[] {
  return FACTS.flatMap(([key, build]) => {
    const value = bonuses[key];
    return value === undefined ? [] : [build(value)];
  });
}

/**
 * Tooltip of a mod's effect: its text, what each bonus means and an example.
 *
 * @param name - Mod or option name.
 * @param description - Its one-line effect.
 * @param facts - Its bonus facts.
 * @returns Tooltip content.
 */
export function effectTooltip(
  name: string,
  description: string,
  facts: readonly BonusFact[],
): TooltipContent {
  const entries = facts.map((fact) => termEntry(fact.term));
  return {
    title: name,
    body: description,
    howItPlays: entries
      .map((entry) => `${entry.title}: ${entry.definition}`)
      .join(" "),
    example: entries.map((entry) => entry.example).join(" "),
  };
}
