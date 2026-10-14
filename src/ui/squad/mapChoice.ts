/**
 * mapChoice — the Skirmish "Map" option: Random or one of the map themes.
 * The choice persists in the game registry and goes into the battle config
 * as `mapTheme` (online battles ignore it). Pure: no Phaser.
 */

import {
  MAP_THEMES,
  MAP_THEME_IDS,
  RANDOM_MAP_THEME,
  findMapTheme,
} from "../../rendering/spaceMap/mapThemes";

/** Registry key of the player's map choice. */
export const MAP_CHOICE_KEY = "mapThemeChoice";

/** Every choice, Random first. */
export const MAP_CHOICES: readonly string[] = [RANDOM_MAP_THEME, ...MAP_THEME_IDS];

/**
 * @param value - Anything read from storage.
 * @returns True when it is a known choice.
 */
export function isMapChoice(value: unknown): value is string {
  return typeof value === "string" && MAP_CHOICES.includes(value);
}

/**
 * @param current - The current choice (unknown reads as Random).
 * @returns The next choice in the cycle.
 */
export function nextMapChoice(current: string): string {
  const index = Math.max(0, MAP_CHOICES.indexOf(current));
  return MAP_CHOICES[(index + 1) % MAP_CHOICES.length]!;
}

/**
 * @param choice - A choice.
 * @returns "RANDOM" or the theme's name in capitals.
 */
export function mapChoiceLabel(choice: string): string {
  return findMapTheme(choice)?.name.toUpperCase() ?? "RANDOM";
}

/**
 * @param choice - A choice.
 * @returns The theme's one-line tagline, or a Random explanation.
 */
export function mapChoiceTagline(choice: string): string {
  return (
    findMapTheme(choice)?.tagline ??
    `A different sky each battle — one of ${MAP_THEMES.length} maps`
  );
}
