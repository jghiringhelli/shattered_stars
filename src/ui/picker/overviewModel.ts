/**
 * overviewModel — the facts the overview tab shows for a ship: a short
 * description, the four key numbers with the build's bonuses, the speed
 * range and the faction's aura tag. Pure: no Phaser.
 */

import type { ShipDefinition } from "../../core/types";
import type { FactionId } from "../../config";
import { FACTION_IDENTITIES } from "../../data/factionIdentity";
import type { LoadoutBonuses } from "./types";

/** Longest description the overview shows (characters). */
export const OVERVIEW_DESCRIPTION_MAX = 170;

/** A key number and how the build changes it. */
export interface KeyNumber {
  readonly key: "attack" | "agility" | "hull" | "shields";
  readonly label: string;
  readonly value: number;
  readonly bonus: number;
}

/** The faction's aura as a tag: its name and what it does. */
export interface AuraTag {
  readonly name: string;
  readonly text: string;
}

/** Everything the overview shows beyond art and name. */
export interface OverviewModel {
  readonly description: string;
  readonly keyNumbers: readonly KeyNumber[];
  readonly speedText: string;
  readonly aura: AuraTag;
}

/**
 * @param text - A description.
 * @param max - Longest allowed result.
 * @returns The text cut at a sentence end within `max`, or with an ellipsis.
 */
export function shortDescription(
  text: string,
  max: number = OVERVIEW_DESCRIPTION_MAX,
): string {
  if (text.length <= max) return text;
  const window = text.slice(0, max);
  const end = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
  );
  if (end > 0) return window.slice(0, end + 1);
  return `${window.slice(0, max - 1)}\u2026`;
}

/**
 * @param faction - A faction.
 * @returns Its aura (from the faction identity levers).
 */
export function factionAuraTag(faction: FactionId): AuraTag {
  const identity = FACTION_IDENTITIES[faction];
  const lever = identity.levers.find((l) => /aura/i.test(l));
  if (!lever) return { name: identity.specialty, text: identity.specialty };
  const [name, ...rest] = lever.split(/ aura:\s*/i);
  return { name: name!, text: rest.join(": ") || lever };
}

/**
 * @param def - The ship.
 * @param bonuses - Bonuses from the selected build.
 * @returns The overview's facts.
 */
export function overviewModel(
  def: ShipDefinition,
  bonuses: LoadoutBonuses,
): OverviewModel {
  const stats = def.baseStats;
  const number = (
    key: KeyNumber["key"],
    label: string,
    bonus: number,
  ): KeyNumber => ({ key, label, value: stats[key] + bonus, bonus });
  return {
    description: shortDescription(def.description),
    keyNumbers: [
      number("attack", "ATTACK", bonuses.atk),
      number("agility", "AGILITY", bonuses.agi),
      number("hull", "HULL", bonuses.hull),
      number("shields", "SHIELDS", bonuses.shld),
    ],
    speedText: `${stats.speed.min}\u2013${stats.speed.max}`,
    aura: factionAuraTag(def.faction),
  };
}
