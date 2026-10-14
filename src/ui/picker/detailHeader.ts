/**
 * detailHeader — pieces of the ship picker's detail panel header: the
 * role · size · points badge (each part explains itself) and the empty-state
 * prompt shown before a ship is selected.
 */

import type Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import { createMenuIcon } from "../menu/MenuIcons";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { addPickerText, pickerTextStyle } from "./pickerStyle";
import { roleTermId, sizeTermId, type TermId } from "../../data/tooltips";
import { addTipZone } from "../menu/tooltipTargets";

/** Inner padding of the detail panel. */
export const DETAIL_PAD = HOLO_SPACING.lg;

/** Header layout. */
const HEADER = {
  badgeGap: 24,
  badgeH: 14,
  emptyIconSize: 28,
  emptyIconGap: 28,
} as const;

/** Panel bounds (top-left origin). */
interface PanelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * "HEAVY FIGHTER · MEDIUM · 53 PT" as three hoverable parts (role, size,
 * points), centred on `at.x` (or starting at it when left-aligned).
 *
 * @param scene - Owning scene.
 * @param container - Target container.
 * @param at - Centre x and top y of the badge.
 * @param def - The ship.
 * @param accent - Faction accent.
 * @param leftAligned - Start at `at.x` instead of centring on it.
 */
export function drawBadge(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  at: { readonly x: number; readonly y: number },
  def: ShipDefinition,
  accent: number,
  leftAligned = false,
): void {
  const parts: ReadonlyArray<{ text: string; term: TermId }> = [
    { text: def.role.replace(/_/g, " ").toUpperCase(), term: roleTermId(def.role) },
    { text: def.baseStats.size.toUpperCase(), term: sizeTermId(def.baseStats.size) },
    { text: `${def.baseStats.pointCost} PT`, term: "stat.points" },
  ];
  const texts = parts.map((part) =>
    addPickerText(scene, { x: 0, y: at.y }, part.text, "caption", accent),
  );
  const separator = `  \u00b7  `;
  const sepW = addPickerText(scene, { x: 0, y: 0 }, separator, "caption", accent);
  const gap = sepW.width;
  sepW.destroy();
  const total = texts.reduce((sum, t) => sum + t.width, 0) + gap * (parts.length - 1);
  let x = leftAligned ? at.x : at.x - total / 2;
  texts.forEach((text, i) => {
    text.setX(x);
    container.add(text);
    addTipZone(scene, container, { x, y: at.y, width: text.width, height: HEADER.badgeH }, parts[i]!.term);
    if (i < texts.length - 1) {
      container.add(
        addPickerText(scene, { x: x + text.width, y: at.y }, separator, "caption", accent),
      );
    }
    x += text.width + gap;
  });
}

/**
 * Muted crosshair + prompt shown before a ship is selected.
 *
 * @param scene - Owning scene.
 * @param container - Target container.
 * @param rect - Panel bounds.
 */
export function drawDetailEmptyState(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  rect: PanelRect,
): void {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  container.add([
    createMenuIcon(
      scene,
      "crosshair",
      { x: cx, y: cy - HEADER.emptyIconGap },
      HEADER.emptyIconSize,
      HOLO_PALETTE.textMuted,
    ),
    scene.add
      .text(
        cx,
        cy + HEADER.emptyIconGap / 2,
        "Select a ship to see its stats and payloads",
        pickerTextStyle("body", HOLO_PALETTE.textMuted, {
          wordWrap: { width: rect.width - DETAIL_PAD * 4 },
          align: "center",
        }),
      )
      .setOrigin(0.5),
  ]);
}
