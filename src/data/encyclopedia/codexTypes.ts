/**
 * Codex types — one encyclopedia entry (ship, pilot, upgrade card or
 * faction) as the encyclopedia lists, filters and shows it. Pure data.
 */

import type { FactionId } from "../../config";

/** The encyclopedia's sections. */
export type CodexSection =
  "ships" | "pilots" | "upgrades" | "factions" | "bestiary";

/** One labelled paragraph of an entry's detail. */
export interface CodexParagraph {
  /** e.g. "ABILITY", "IN BATTLE", "FLY IT IN". */
  readonly heading: string;
  readonly text: string;
}

/** One encyclopedia entry. */
export interface CodexEntry {
  readonly section: CodexSection;
  readonly id: string;
  readonly name: string;
  /** Short right-aligned list caption (role, slot, initiative). */
  readonly tag: string;
  /** The faction it belongs to; null = usable by every faction. */
  readonly faction: FactionId | null;
  /** One line under the name in the detail panel. */
  readonly subtitle: string;
  readonly paragraphs: readonly CodexParagraph[];
  /** Lower-case text the search matches (name, tag and every paragraph). */
  readonly searchText: string;
}

/** What the list is narrowed to. */
export interface CodexFilter {
  /** Only this faction's entries (and cards every faction may use). */
  readonly faction: FactionId | null;
  /** Words that must all appear in the entry (case-insensitive). */
  readonly query: string;
}

/**
 * An entry with its search text derived from everything it shows.
 * @param entry - The entry without search text.
 * @returns The complete entry.
 */
export function withSearchText(
  entry: Omit<CodexEntry, "searchText">,
): CodexEntry {
  const words = [
    entry.name,
    entry.tag,
    entry.subtitle,
    ...entry.paragraphs.flatMap((p) => [p.heading, p.text]),
  ];
  return { ...entry, searchText: words.join(" ").toLowerCase() };
}

/**
 * "heavy_fighter" → "Heavy Fighter".
 * @param id - Snake-case id.
 * @returns Title-case label.
 */
export function titleCase(id: string): string {
  return id
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
