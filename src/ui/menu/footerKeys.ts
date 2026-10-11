/**
 * footerKeys — the one footer-hint format for menu screens (as Settings,
 * Credits and the main menu write it): "KEY  ACTION" pairs with the action
 * upper-cased, separated by a wide gap. Pure.
 */

/** Gap between a key and its action. */
const KEY_ACTION_GAP = "  ";
/** Gap between two pairs. */
export const FOOTER_PAIR_GAP = "      ";

/**
 * @param pairs - [key glyph, action] pairs, in reading order.
 * @returns e.g. "↑ ↓  BROWSE      ESC  BACK".
 */
export function footerKeys(
  pairs: ReadonlyArray<readonly [string, string]>,
): string {
  return pairs
    .map(([key, action]) => `${key}${KEY_ACTION_GAP}${action.toUpperCase()}`)
    .join(FOOTER_PAIR_GAP);
}
