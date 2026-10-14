/**
 * Encyclopedia codex — the sections the encyclopedia browses (ships,
 * pilots, upgrade cards, factions), their entries (built once, read from the
 * catalogues) and the faction / text filter. Pure.
 */

import { getAllEncyclopediaEntries } from "../ShipEncyclopedia";
import { SHIP_DEFINITIONS } from "../ShipDefinitions";
import {
  titleCase,
  withSearchText,
  type CodexEntry,
  type CodexFilter,
  type CodexSection,
} from "./codexTypes";
import { creatureCodexEntries } from "./creatureCodex";
import { factionCodexEntries } from "./factionCodex";
import { pilotCodexEntries } from "./pilotCodex";
import { upgradeCodexEntries } from "./upgradeCodex";

export type {
  CodexEntry,
  CodexFilter,
  CodexParagraph,
  CodexSection,
} from "./codexTypes";
export { FACTION_PROFILES } from "./factionCodex";

/** A section tab. */
export interface CodexSectionSpec {
  readonly id: CodexSection;
  readonly label: string;
}

/** The sections, in tab order. */
export const CODEX_SECTIONS: readonly CodexSectionSpec[] = [
  { id: "ships", label: "SHIPS" },
  { id: "pilots", label: "PILOTS" },
  { id: "upgrades", label: "UPGRADES" },
  { id: "factions", label: "FACTIONS" },
  { id: "bestiary", label: "BESTIARY" },
];

/**
 * Ships as list entries (the ship detail panel shows the rest: art, lore,
 * stats); their search text covers name, role and lore.
 * @returns One entry per encyclopedia ship.
 */
function shipCodexEntries(): CodexEntry[] {
  return getAllEncyclopediaEntries().map((entry) => {
    const ship = SHIP_DEFINITIONS[entry.shipId];
    return withSearchText({
      section: "ships",
      id: entry.shipId,
      name: ship?.name ?? entry.shipId,
      tag: titleCase(ship?.role ?? "").toUpperCase(),
      faction: ship?.faction ?? null,
      subtitle: entry.lore,
      paragraphs: [],
    });
  });
}

const BUILDERS: Readonly<Record<CodexSection, () => CodexEntry[]>> = {
  ships: shipCodexEntries,
  pilots: pilotCodexEntries,
  upgrades: upgradeCodexEntries,
  factions: factionCodexEntries,
  bestiary: creatureCodexEntries,
};

/** Entries per section, built on first use (the catalogues are static). */
const cache = new Map<CodexSection, readonly CodexEntry[]>();

/**
 * @param section - A codex section.
 * @returns Its entries, in display order.
 */
export function codexEntries(section: CodexSection): readonly CodexEntry[] {
  const cached = cache.get(section);
  if (cached) return cached;
  const built = BUILDERS[section]();
  cache.set(section, built);
  return built;
}

/**
 * Narrow entries to a faction (keeping cards every faction may use) and to
 * the entries whose text holds every word of the query.
 *
 * @param entries - The section's entries.
 * @param filter - Faction and search text.
 * @returns The matching entries, in order.
 */
export function filterCodex(
  entries: readonly CodexEntry[],
  filter: CodexFilter,
): CodexEntry[] {
  const words = filter.query.toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(
    (entry) =>
      (filter.faction === null ||
        entry.faction === null ||
        entry.faction === filter.faction) &&
      words.every((word) => entry.searchText.includes(word)),
  );
}
