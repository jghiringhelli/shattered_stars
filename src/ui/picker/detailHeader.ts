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
import { roleTermId, sizeTermId, type TermId } from "../../data/tooltips";
import { addTipZone } from "../menu/tooltipTargets";

/** Art box height at the full panel height — compact so the quick-build block fits. */
const ART_H = 88;
/** Panel height the layout is designed for; shorter panels shrink the art. */
const FULL_PANEL_H = 570;
/** The art never shrinks below this. */
const MIN_ART_H = 56;
/** Smallest art in the densest layout. */
const COMPACT_MIN_ART_H = 48;
/** Smallest art while a guide tab needs the room. */
const GUIDE_MIN_ART_H = 40;
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
  /** Show the ship's actions (the guide tabs give the room to the text). */
  readonly actions: boolean;
  readonly gap: number;
  readonly minArtH: number;
}

/** Densities from roomiest to tightest. */
export const DENSITIES: readonly Density[] = [
  {
    chipActions: false,
    lore: true,
    actions: true,
    gap: HOLO_SPACING.md,
    minArtH: MIN_ART_H,
  },
  {
    chipActions: true,
    lore: true,
    actions: true,
    gap: HOLO_SPACING.md,
    minArtH: MIN_ART_H,
  },
  {
    chipActions: true,
    lore: false,
    actions: true,
    gap: HOLO_SPACING.sm,
    minArtH: COMPACT_MIN_ART_H,
  },
  {
    chipActions: true,
    lore: false,
    actions: false,
    gap: HOLO_SPACING.sm,
    minArtH: GUIDE_MIN_ART_H,
  },
];

/** Index of the densest layout, which gives guide tabs the most room. */
export const GUIDE_DENSITY = DENSITIES.length - 1;

/**
 * First density to try for a panel size: narrow panels start densest,
 * short ones skip the described actions.
 *
 * @param width - Panel width.
 * @param height - Panel height.
 * @param guideTab - A guide tab is open (needs the densest layout).
 * @returns Index into DENSITIES.
 */
export function startDensity(
  width: number,
  height: number,
  guideTab = false,
): number {
  if (guideTab) return GUIDE_DENSITY;
  if (width < COMPACT_WIDTH) return GUIDE_DENSITY - 1;
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
  ]);
  drawBadge(scene, container, { x: centreX, y: nameY + HEADER.badgeGap }, def, accent);
  return nameY + HEADER.badgeGap + HEADER.badgeH;
}

/**
 * "HEAVY FIGHTER · MEDIUM · 53 PT" as three hoverable parts (role, size,
 * points), centred on `at.x`.
 *
 * @param scene - Owning scene.
 * @param container - Target container.
 * @param at - Centre x and top y of the badge.
 * @param def - The ship.
 * @param accent - Faction accent.
 */
function drawBadge(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  at: { readonly x: number; readonly y: number },
  def: ShipDefinition,
  accent: number,
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
  let x = at.x - total / 2;
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
