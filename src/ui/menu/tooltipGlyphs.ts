/**
 * tooltipGlyphs — the small glyph a tooltip shows beside its title: a
 * coloured dial swatch, a stat icon or a role silhouette. Procedural.
 */

import type Phaser from "phaser";
import type { ShipRole } from "../../core/types";
import type { TermGlyph } from "../../data/tooltips";
import { HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { drawMenuIcon, type MenuIconName } from "./MenuIcons";
import { drawRoleGlyph } from "./roleGlyphs";

/** Glyph box in a tooltip title row (px). */
export const TOOLTIP_GLYPH_SIZE = 16;

const DIAL_COLORS = {
  dial_green: HOLO_PALETTE.success,
  dial_white: HOLO_PALETTE.textPrimary,
  dial_red: HOLO_PALETTE.danger,
} as const;

const ICONS: Partial<Record<TermGlyph, MenuIconName>> = {
  shield: "shield",
  hull: "fleet",
  attack: "crosshair",
  agility: "refresh",
  points: "flag",
  star: "star",
  stress: "close",
};

/**
 * Draws a term glyph.
 *
 * @param g - Target graphics.
 * @param glyph - Which glyph.
 * @param centre - Glyph centre.
 * @param size - Glyph box size.
 */
export function drawTermGlyph(
  g: Phaser.GameObjects.Graphics,
  glyph: TermGlyph,
  centre: { readonly x: number; readonly y: number },
  size: number,
): void {
  if (glyph === "dial_green" || glyph === "dial_white" || glyph === "dial_red") {
    g.fillStyle(DIAL_COLORS[glyph], 1);
    g.fillRoundedRect(
      centre.x - size / 2,
      centre.y - size / 2,
      size,
      size,
      HOLO_RADIUS.sm,
    );
    return;
  }
  if (glyph.startsWith("role_")) {
    const role = glyph.slice("role_".length) as ShipRole;
    drawRoleGlyph(g, role, centre, size, HOLO_PALETTE.accent);
    return;
  }
  const icon = ICONS[glyph];
  if (icon) drawMenuIcon(g, icon, centre, size, HOLO_PALETTE.accent);
}
