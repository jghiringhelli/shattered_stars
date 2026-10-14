/**
 * CatalogSectionHeader — the banner above each role section of the ship
 * catalog: role glyph, role name, ship / build counts, a fold chevron and a
 * hairline (the role description is in its tooltip). Capitals shown only as a notice read
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
export const SECTION_HEADER_H = 26;

/** Header geometry. */
const HEADER = {
  glyphSize: 14,
  glyphX: 9,
  titleX: 24,
  titleY: 2,
  ruleY: SECTION_HEADER_H - 3,
  noticeAlpha: 0.7,
  /** Fold chevron: size and distance from the right edge (px). */
  chevronSize: 5,
  chevronInset: 6,
  countsGap: 16,
} as const;

/** Where and how to draw a header. */
export interface SectionHeaderSpec {
  readonly section: CatalogSection;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly accent: number;
  /** Press handler that folds / unfolds the section (none for the epic-only notice). */
  readonly onToggle?: () => void;
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
    { x: x + width - (spec.onToggle ? HEADER.countsGap : 0), y: y + HEADER.titleY + 1 },
    muted
      ? `EPIC FORMAT ONLY · ${section.shipCount} ${section.shipCount === 1 ? "SHIP" : "SHIPS"}`
      : sectionCounts(section.shipCount, section.buildCount),
    "micro",
    muted ? HOLO_PALETTE.warning : HOLO_PALETTE.textSecondary,
  ).setOrigin(1, 0);
  const rule = scene.add.graphics();
  rule.lineStyle(HOLO_BORDER.hairline, tint, HOLO_ALPHA.structure);
  rule.lineBetween(x, y + HEADER.ruleY, x + width, y + HEADER.ruleY);
  if (muted) [glyph, title].forEach((o) => o.setAlpha(HEADER.noticeAlpha));
  container.add([glyph, title, counts, rule]);
  if (spec.onToggle) container.add(drawChevron(scene, spec, y + HEADER.titleY + 8));
  const zone = addTipZone(
    scene,
    container,
    { x, y, width, height: SECTION_HEADER_H - 2 },
    muted ? "ui.epic_only" : roleTermId(section.role),
    spec.onToggle,
  );
  return [zone];
}

/**
 * Fold chevron: points down when the section is open, right when folded.
 *
 * @param scene - Owning scene.
 * @param spec - Header spec.
 * @param centreY - Vertical centre of the chevron.
 * @returns The graphics object.
 */
function drawChevron(
  scene: Phaser.Scene,
  spec: SectionHeaderSpec,
  centreY: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const s = HEADER.chevronSize;
  const cx = spec.x + spec.width - HEADER.chevronInset;
  g.fillStyle(HOLO_PALETTE.textSecondary, 1);
  if (spec.section.collapsed) g.fillTriangle(cx - s / 2, centreY - s, cx - s / 2, centreY + s, cx + s, centreY);
  else g.fillTriangle(cx - s, centreY - s / 2, cx + s, centreY - s / 2, cx, centreY + s);
  return g;
}
