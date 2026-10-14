/**
 * CatalogSectionHeader — the banner above each role section of the ship
 * catalog: role glyph, role name, ship / build counts, a one-line role
 * description and a hairline. Capitals shown only as a notice read
 * "EPIC FORMAT ONLY". Hovering it explains the role.
 */

import type Phaser from "phaser";
import { roleTermId } from "../../data/tooltips";
import { drawRoleGlyph } from "../menu/roleGlyphs";
import { addTipZone } from "../menu/tooltipTargets";
import { HOLO_ALPHA, HOLO_BORDER, HOLO_PALETTE } from "../theme/HoloTheme";
import { sectionCounts, type CatalogSection } from "./catalogSections";
import { addPickerText } from "./pickerStyle";

/** Header height (px) — the layout reserves this above a section's cards. */
export const SECTION_HEADER_H = 38;

/** Header geometry. */
const HEADER = {
  glyphSize: 14,
  glyphX: 9,
  titleX: 24,
  titleY: 2,
  blurbY: 19,
  ruleY: SECTION_HEADER_H - 3,
  noticeAlpha: 0.7,
} as const;

/** Where and how to draw a header. */
export interface SectionHeaderSpec {
  readonly section: CatalogSection;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly accent: number;
}

/**
 * Draws one section header into a container.
 *
 * @param scene - Owning scene.
 * @param container - Target container (the scrolling grid).
 * @param spec - The section, box and accent.
 * @returns Interactive zones created (the grid disables them when scrolled out).
 */
export function drawSectionHeader(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  spec: SectionHeaderSpec,
): Phaser.GameObjects.Rectangle[] {
  const { section, x, y, width, accent } = spec;
  const muted = section.epicOnly;
  const tint = muted ? HOLO_PALETTE.textMuted : accent;
  const glyph = scene.add.graphics();
  drawRoleGlyph(
    glyph,
    section.role,
    { x: x + HEADER.glyphX, y: y + HEADER.titleY + HEADER.glyphSize / 2 },
    HEADER.glyphSize,
    tint,
  );
  const title = addPickerText(
    scene,
    { x: x + HEADER.titleX, y: y + HEADER.titleY },
    section.title,
    "caption",
    muted ? HOLO_PALETTE.textSecondary : HOLO_PALETTE.textPrimary,
  );
  const counts = addPickerText(
    scene,
    { x: x + width, y: y + HEADER.titleY + 1 },
    muted
      ? `EPIC FORMAT ONLY · ${section.shipCount} ${section.shipCount === 1 ? "SHIP" : "SHIPS"}`
      : sectionCounts(section.shipCount, section.buildCount),
    "micro",
    muted ? HOLO_PALETTE.warning : HOLO_PALETTE.textSecondary,
  ).setOrigin(1, 0);
  const blurb = addPickerText(
    scene,
    { x: x + HEADER.titleX, y: y + HEADER.blurbY },
    section.blurb,
    "micro",
    HOLO_PALETTE.textMuted,
  );
  const rule = scene.add.graphics();
  rule.lineStyle(HOLO_BORDER.hairline, tint, HOLO_ALPHA.structure);
  rule.lineBetween(x, y + HEADER.ruleY, x + width, y + HEADER.ruleY);
  if (muted) [glyph, title, blurb].forEach((o) => o.setAlpha(HEADER.noticeAlpha));
  container.add([glyph, title, counts, blurb, rule]);
  const zone = addTipZone(
    scene,
    container,
    { x, y, width, height: SECTION_HEADER_H - 2 },
    muted ? "ui.epic_only" : roleTermId(section.role),
  );
  return [zone];
}
