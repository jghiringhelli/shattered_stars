/**
 * squadCardLayout — geometry of a SquadCard, shared by the card itself and
 * by SquadListPanel (lane heights). Pure constants + a height query.
 */

import type { SquadEntry } from "../../core/squadTypes";

/** Card width in pixels. */
export const CARD_W = 260;
/** Height of the card above the ship list (header, chips, actions). */
export const CARD_H_COLLAPSED = 100;
/** Height of one ship row. */
export const SHIP_ROW_H = 40;
/** Ship rows shown before collapsing into "+N more". */
export const MAX_SHOWN_SHIPS = 3;

/** Vertical layout inside a card (top-left origin). */
export const CARD_LAYOUT = {
  /** Inner horizontal padding. */
  pad: 12,
  /** Header strip height (faction name + summary). */
  headerH: 40,
  /** Faction name / points baseline row. */
  titleY: 6,
  /** Ship summary row inside the header strip. */
  summaryY: 24,
  /** Close (remove) hit box size, top-right. */
  closeBox: 28,
  /** Close glyph size. */
  closeIcon: 10,
  /** Team chip row top. */
  chipRowY: 48,
  chipW: 28,
  chipH: 18,
  chipGap: 4,
  /** Action button row top. */
  actionRowY: 72,
  actionW: 74,
  actionH: 24,
  actionGap: 7,
  /** Divider between controls and ship list. */
  dividerY: CARD_H_COLLAPSED + 4,
  /** Gap between divider and the first ship row / below the last one. */
  listPad: 8,
  /** Extra line for "+N more ships". */
  moreLineH: 16,
} as const;

/** Ship-row geometry (relative to the row top). */
export const SHIP_ROW_LAYOUT = {
  spriteX: 26,
  spriteY: 19,
  spriteRadius: 14,
  spriteSize: 22,
  textX: 48,
  nameY: 1,
  statsY: 15,
  descY: 27,
  /** Character budgets keeping text inside the card. */
  nameChars: 26,
  descChars: 36,
  summaryChars: 38,
} as const;

/**
 * Full rendered height of a card for a squad (controls + ship list).
 *
 * @param squad - Squad shown by the card.
 * @returns Height in pixels.
 */
export function squadCardHeight(squad: Pick<SquadEntry, "ships">): number {
  const count = squad.ships.length;
  const shown = Math.min(Math.max(count, 1), MAX_SHOWN_SHIPS);
  const more = count > MAX_SHOWN_SHIPS ? CARD_LAYOUT.moreLineH : 0;
  return (
    CARD_LAYOUT.dividerY +
    CARD_LAYOUT.listPad +
    shown * SHIP_ROW_H +
    more +
    CARD_LAYOUT.listPad
  );
}
