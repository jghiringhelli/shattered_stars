/**
 * detailHeader — the top of the ship picker's detail panel (contained art,
 * ship name, role/size/points badge), its empty-state prompt, and the
 * density policy that decides how tightly the panel packs its sections.
 */

import type Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import { createMenuIcon } from "../menu/MenuIcons";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { addContainedImage } from "./catalogHelpers";
import { shipArtAsset } from "../../assets/assetManifest";
import { swapWhenLoaded } from "../../assets/textureLoading";
import { addPickerText, pickerTextStyle } from "./pickerStyle";

/** Art box height at the full panel height — compact so the quick-build block fits. */
const ART_H = 88;
/** Panel height the layout is designed for; shorter panels shrink the art. */
const FULL_PANEL_H = 570;
/** The art never shrinks below this. */
const MIN_ART_H = 56;
/** Smallest art in the densest layout. */
const COMPACT_MIN_ART_H = 48;
/** Panels narrower than this start at the densest layout. */
const COMPACT_WIDTH = 600;

/** Inner padding of the detail panel. */
export const DETAIL_PAD = HOLO_SPACING.lg;

/** Header layout. */
const HEADER = {
  nameGap: HOLO_SPACING.sm,
  badgeGap: 24,
  badgeH: 14,
  emptyIconSize: 28,
  emptyIconGap: 28,
} as const;

/** How tightly the panel packs its sections. */
export interface Density {
  /** Actions as a chip row instead of described two-column entries. */
  readonly chipActions: boolean;
  /** Show the lore excerpt. */
  readonly lore: boolean;
  readonly gap: number;
  readonly minArtH: number;
}

/** Densities from roomiest to tightest. */
export const DENSITIES: readonly Density[] = [
  { chipActions: false, lore: true, gap: HOLO_SPACING.md, minArtH: MIN_ART_H },
  { chipActions: true, lore: true, gap: HOLO_SPACING.md, minArtH: MIN_ART_H },
  {
    chipActions: true,
    lore: false,
    gap: HOLO_SPACING.sm,
    minArtH: COMPACT_MIN_ART_H,
  },
];

/**
 * First density to try for a panel size: narrow panels start densest,
 * short ones skip the described actions.
 *
 * @param width - Panel width.
 * @param height - Panel height.
 * @returns Index into DENSITIES.
 */
export function startDensity(width: number, height: number): number {
  if (width < COMPACT_WIDTH) return DENSITIES.length - 1;
  return height < FULL_PANEL_H ? 1 : 0;
}

/**
 * Art height for a panel height at a density.
 *
 * @param panelHeight - Panel height.
 * @param density - Layout density.
 * @returns Art box height.
 */
export function artHeight(panelHeight: number, density: Density): number {
  const shrink = Math.max(0, FULL_PANEL_H - panelHeight);
  return Math.max(density.minArtH, ART_H - shrink);
}

/** Panel bounds (top-left origin). */
interface PanelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Art, name and badge, centred.
 *
 * @param scene - Owning scene.
 * @param container - Target container.
 * @param args - Ship, panel bounds, art height and faction accent.
 * @returns y just below the badge.
 */
export function drawDetailHeader(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  args: {
    readonly def: ShipDefinition;
    readonly rect: PanelRect;
    readonly artH: number;
    readonly accent: number;
  },
): number {
  const { def, rect, artH, accent } = args;
  const centreX = rect.x + rect.width / 2;
  const top = rect.y + DETAIL_PAD;
  const artKey = `ship_art_${def.id}`;
  const imgKey =
    [artKey, def.spriteKey].find((key) => scene.textures.exists(key)) ??
    `ship_${def.faction}_${def.baseStats.size}`;
  const nameY = top + artH + HEADER.nameGap;
  const badge = `${def.role.replace(/_/g, " ").toUpperCase()}  \u00b7  ${def.baseStats.size.toUpperCase()}  \u00b7  ${def.baseStats.pointCost} PT`;
  const artBox = { maxWidth: rect.width - DETAIL_PAD * 2, maxHeight: artH };
  const art = addContainedImage(
    scene,
    imgKey,
    centreX,
    top + artH / 2,
    artBox.maxWidth,
    artBox.maxHeight,
  );
  swapWhenLoaded(scene, art, shipArtAsset(def), artBox);
  container.add([
    art,
    addPickerText(
      scene,
      { x: centreX, y: nameY },
      def.name,
      "title",
      HOLO_PALETTE.textPrimary,
    ).setOrigin(0.5, 0),
    addPickerText(
      scene,
      { x: centreX, y: nameY + HEADER.badgeGap },
      badge,
      "caption",
      accent,
    ).setOrigin(0.5, 0),
  ]);
  return nameY + HEADER.badgeGap + HEADER.badgeH;
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
