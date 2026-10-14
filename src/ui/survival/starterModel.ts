/**
 * Survival starter screen — pure helpers (no Phaser): the ship-card row
 * layout, the flagship's build pick and the ascension tooltip.
 */

import type { QuickBuildSelection } from "../../arcade/systems/QuickBuildChoice";
import { activeAscensionModifiers } from "../../data/survival/ascension";
import { termEntry } from "../../data/tooltips";
import type { TooltipContent } from "../menu/tooltipContent";

/** Widest a starter card gets (px). */
const CARD_MAX_WIDTH = 256;
/** Gap between starter cards (px) — the 8 px grid. */
const CARD_GAP = 16;
/** Side margin the row keeps (px). */
const ROW_MARGIN = 32;

/** Where one starter card sits. */
export interface StarterCardRect {
  /** Card centre x. */
  readonly x: number;
  readonly width: number;
}

/**
 * @param count - Starters on offer.
 * @param screenWidth - Screen width (px).
 * @returns One centred rect per starter, equal widths.
 */
export function starterCardRects(
  count: number,
  screenWidth: number,
): StarterCardRect[] {
  if (count <= 0) return [];
  const room = screenWidth - ROW_MARGIN * 2 - (count - 1) * CARD_GAP;
  const width = Math.min(CARD_MAX_WIDTH, room / count);
  const total = count * width + (count - 1) * CARD_GAP;
  const start = (screenWidth - total) / 2 + width / 2;
  return Array.from({ length: count }, (_, i) => ({
    x: start + i * (width + CARD_GAP),
    width,
  }));
}

/**
 * @param shipId - The flagship.
 * @param loadoutId - The quick build picked for it (null = the default one).
 * @returns The selection a run starts from.
 */
export function buildSelection(
  shipId: string,
  loadoutId: string | null,
): QuickBuildSelection {
  return { shipIds: [shipId], loadoutIds: [loadoutId] };
}

/**
 * @param level - The chosen ascension.
 * @param maxLevel - The highest unlocked ascension.
 * @returns The tooltip of the ascension readout: what is active and how to climb.
 */
export function ascensionTip(
  level: number,
  maxLevel: number,
): TooltipContent {
  const entry = termEntry("survival.ascension");
  const active = activeAscensionModifiers(level).map(
    (m) => `${m.name}: ${m.description}`,
  );
  return {
    title: `Ascension ${level} of ${maxLevel} unlocked`,
    body: entry.definition,
    howItPlays:
      active.length > 0
        ? active.join("\n")
        : "No modifiers at level 0. Win a run to unlock Ascension 1.",
    example: entry.example,
  };
}
