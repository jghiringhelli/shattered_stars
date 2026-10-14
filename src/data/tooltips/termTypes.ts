/**
 * termTypes — the shape of one tooltip term (a named game concept the UI can
 * explain on hover) and the locale plumbing. Pure data, no Phaser.
 */

/** Languages the catalog can be translated into (English is the source). */
export type Locale = "en" | "es";

/** Glyph a tooltip shows beside its title (drawn by ui/menu/tooltipGlyphs). */
export type TermGlyph =
  | "dial_green"
  | "dial_white"
  | "dial_red"
  | "stress"
  | "shield"
  | "hull"
  | "attack"
  | "agility"
  | "points"
  | "star"
  | "role_light_fighter"
  | "role_heavy_fighter"
  | "role_interceptor"
  | "role_bomber"
  | "role_gunship"
  | "role_support"
  | "role_capital";

/** One explained term: what it is, an example and how it plays. */
export interface TermEntry {
  readonly title: string;
  /** Plain-language definition (one or two sentences). */
  readonly definition: string;
  /** A concrete example from this game. */
  readonly example: string;
  /** How it changes the way you fly or build (optional). */
  readonly howItPlays?: string;
  readonly glyph?: TermGlyph;
}

/** The text of a term in one locale (everything the player reads). */
export type TermText = Pick<
  TermEntry,
  "title" | "definition" | "example" | "howItPlays"
>;

/**
 * Builds a term entry.
 *
 * @param title - Display name.
 * @param definition - Plain-language definition.
 * @param example - Concrete example.
 * @param howItPlays - How it plays (optional).
 * @param glyph - Title glyph (optional).
 * @returns The entry.
 */
export function term(
  title: string,
  definition: string,
  example: string,
  howItPlays?: string,
  glyph?: TermGlyph,
): TermEntry {
  return {
    title,
    definition,
    example,
    ...(howItPlays !== undefined ? { howItPlays } : {}),
    ...(glyph !== undefined ? { glyph } : {}),
  };
}
