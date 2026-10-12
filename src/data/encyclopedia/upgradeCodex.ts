/**
 * Upgrade codex — every upgrade card as an encyclopedia entry, grouped by
 * slot: price, card text, real-time reading, role hint, requirements and
 * the quick builds that fly it. Pure.
 */

import type {
  UpgradeDefinition,
  UpgradeSlotType,
} from "../../core/upgradeTypes";
import { UPGRADE_DEFINITIONS } from "../../systems/UpgradeSystem";
import { summarizeUpgrade } from "../quickBuildDetails";
import { upgradeHint } from "../roleHints";
import { buildsFlyingCard } from "../quickBuildIndex";
import {
  titleCase,
  withSearchText,
  type CodexEntry,
  type CodexParagraph,
} from "./codexTypes";

/** Slot order of the upgrade list (weapons, systems, people, pilot). */
const SLOT_ORDER: readonly UpgradeSlotType[] = [
  "cannon",
  "turret",
  "missile",
  "torpedo",
  "bomb",
  "modification",
  "configuration",
  "title",
  "sensor",
  "tech",
  "crew",
  "gunner",
  "astromech",
  "talent",
  "force_power",
  "illicit",
];

/** Builds listed in an entry before "and N more". */
const MAX_LISTED_BUILDS = 4;

/**
 * @param list - A value or a list of values.
 * @returns The values joined, title-cased.
 */
function labels(list: string | readonly string[] | undefined): string {
  if (!list) return "";
  return (Array.isArray(list) ? list : [list as string])
    .map(titleCase)
    .join(" / ");
}

/**
 * @param card - An upgrade card.
 * @returns Its requirements as one line ("" when anyone may slot it).
 */
function requirements(card: UpgradeDefinition): string {
  return [
    labels(card.requiredFaction),
    labels(card.requiredShipSize),
    labels(card.requiredShipRole),
  ]
    .filter((part) => part.length > 0)
    .join(" · ");
}

/**
 * @param card - An upgrade card.
 * @returns The quick builds flying it, as one line.
 */
function buildsLine(card: UpgradeDefinition): string {
  const builds = buildsFlyingCard(card.id);
  const named = builds.slice(0, MAX_LISTED_BUILDS).map((build) => build.name);
  const more = builds.length - named.length;
  return more > 0 ? `${named.join(", ")} and ${more} more` : named.join(", ");
}

/**
 * @param card - An upgrade card.
 * @returns Its codex entry.
 */
function upgradeEntry(card: UpgradeDefinition): CodexEntry {
  const hint = upgradeHint(card);
  const required = requirements(card);
  const paragraphs: CodexParagraph[] = [
    { heading: "CARD", text: card.description },
    { heading: "IN BATTLE", text: summarizeUpgrade(card) },
    { heading: "ROLE", text: hint.role },
    { heading: "BEST WITH", text: hint.bestWith },
    ...(required ? [{ heading: "REQUIRES", text: required }] : []),
    { heading: "FLY IT IN", text: buildsLine(card) || "No quick build yet." },
  ];
  return withSearchText({
    section: "upgrades",
    id: card.id,
    name: card.name,
    tag: titleCase(card.slotType).toUpperCase(),
    faction: card.requiredFaction ?? null,
    subtitle: `${titleCase(card.slotType)} · ${card.pointCost} pts`,
    paragraphs,
  });
}

/**
 * Every upgrade card, grouped by slot then by name.
 * @returns The upgrade entries.
 */
export function upgradeCodexEntries(): CodexEntry[] {
  const rank = (card: UpgradeDefinition): number => {
    const index = SLOT_ORDER.indexOf(card.slotType);
    return index === -1 ? SLOT_ORDER.length : index;
  };
  return Object.values(UPGRADE_DEFINITIONS)
    .slice()
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .map(upgradeEntry);
}
