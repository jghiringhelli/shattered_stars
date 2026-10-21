/**
 * coalitionLeadModel — what the Coalition hub's lead control shows: the five
 * faction heroes, who leads now, and what a swap changes (the two powers on
 * the bar). Pure: no Phaser.
 */

import type { FactionId } from "../../config";
import { COALITION_LEADS } from "../../campaign/coalition/coalitionLaunch";
import { FACTION_HEROES } from "../../data/campaign/heroPowers";
import { POWER_KEYS } from "./heroCardModel";

/** Heading of the lead control. */
export const LEAD_CONTROL_TITLE = "COALITION LEAD";

/** Tooltip of one lead option. */
export interface LeadTooltip {
  readonly title: string;
  readonly body: string;
}

/** One hero of the lead control. */
export interface LeadOption {
  readonly faction: FactionId;
  readonly heroName: string;
  readonly portraitKey: string;
  /** Names of the two powers this hero puts on the bar (V, B). */
  readonly powerNames: readonly string[];
  /** Whether this hero leads now. */
  readonly current: boolean;
  readonly tooltip: LeadTooltip;
}

/**
 * @param powerNames - The hero's power names.
 * @returns "[V] Cloak Dash  [B] Scatter Mines".
 */
function barLine(powerNames: readonly string[]): string {
  return powerNames
    .map((name, slot) => `[${POWER_KEYS[slot]}] ${name}`)
    .join("  ");
}

/**
 * @param faction - A lead hero's faction.
 * @param current - Whether the hero leads now.
 * @returns The option's tooltip.
 */
function tooltipFor(faction: FactionId, current: boolean): LeadTooltip {
  const hero = FACTION_HEROES[faction];
  const bar = barLine(hero.powers.map((power) => power.name));
  const title = `${hero.name} — ${hero.title}`;
  if (current) {
    return {
      title,
      body: `${hero.name} leads the Coalition now. On the bar: ${bar}. The other heroes fly as allied squads.`,
    };
  }
  return {
    title,
    body: `Lead the next mission as ${hero.name}: their ships fly with you and the bar becomes ${bar}. Credits, research and the armory stay.`,
  };
}

/**
 * @param lead - Faction of the hero that leads now.
 * @returns The five heroes in roster order, the current lead marked.
 */
export function coalitionLeadOptions(lead: FactionId): LeadOption[] {
  return COALITION_LEADS.map((faction) => {
    const hero = FACTION_HEROES[faction];
    const current = faction === lead;
    return {
      faction,
      heroName: hero.name,
      portraitKey: hero.portraitKey,
      powerNames: hero.powers.map((power) => power.name),
      current,
      tooltip: tooltipFor(faction, current),
    };
  });
}
