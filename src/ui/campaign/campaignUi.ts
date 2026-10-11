/**
 * campaignUi — small shared building blocks for the campaign / debrief
 * screens: holo-typed text, caption chips and faction emblems.
 */

import type Phaser from "phaser";
import type { FactionId } from "../../config";
import { holoFont } from "../theme/holoFont";
import { toCssColor } from "../theme/colorMath";
import { HOLO_BORDER, HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { drawHoloFrame } from "../menu/holoChrome";
import { drawMenuIcon, type MenuIconName } from "../menu/MenuIcons";

/** Typographic spec for {@link addHoloText}. */
export interface HoloTextSpec {
  readonly size: number;
  readonly weight?: string;
  readonly color?: number;
  readonly letterSpacing?: number;
  readonly wrapWidth?: number;
  readonly lineSpacing?: number;
  readonly align?: "left" | "center" | "right";
}

/** Type roles used across the campaign screens. */
export const CAMPAIGN_TEXT = {
  heading: { size: 18, weight: "600", letterSpacing: 0.5 },
  panelHeading: { size: 16, weight: "600", letterSpacing: 2 },
  body: { size: 14, weight: "400", color: HOLO_PALETTE.textSecondary },
  caption: {
    size: 11,
    weight: "600",
    letterSpacing: 1.5,
    color: HOLO_PALETTE.textSecondary,
  },
  numeric: { size: 16, weight: "600" },
} as const satisfies Record<string, HoloTextSpec>;

/**
 * Add a text object in the holo typeface (origin top-left).
 *
 * @param scene - Owning scene.
 * @param x - X position.
 * @param y - Y position.
 * @param content - Text content.
 * @param spec - Size, weight, colour and layout options.
 * @returns The created text.
 */
export function addHoloText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  spec: HoloTextSpec,
): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, content, {
    ...holoFont(spec.size, spec.weight ?? "400"),
    color: toCssColor(spec.color ?? HOLO_PALETTE.textPrimary),
    align: spec.align ?? "left",
    ...(spec.wrapWidth !== undefined && {
      wordWrap: { width: spec.wrapWidth },
    }),
    ...(spec.lineSpacing !== undefined && { lineSpacing: spec.lineSpacing }),
  });
  if (spec.letterSpacing !== undefined) {
    text.setLetterSpacing(spec.letterSpacing);
  }
  return text;
}

/** Caption chip geometry. */
const CHIP = {
  height: 20,
  padX: 8,
  fillAlpha: 0.12,
  borderAlpha: 0.7,
} as const;

/** Horizontal anchor of a chip relative to its position. */
export type ChipAnchor = "left" | "center" | "right";

/**
 * Small uppercase status chip (tinted outline + caption text), vertically
 * centred on y.
 *
 * @param scene - Owning scene.
 * @param x - Anchor x.
 * @param y - Centre y.
 * @param label - Chip text (rendered uppercase).
 * @param color - Tint for border and text.
 * @param anchor - Which edge sits on x. Default "right".
 * @returns A container holding the chip.
 */
export function addCaptionChip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  color: number,
  anchor: ChipAnchor = "right",
): Phaser.GameObjects.Container {
  const text = addHoloText(scene, 0, 0, label.toUpperCase(), {
    ...CAMPAIGN_TEXT.caption,
    color,
  }).setOrigin(0.5);
  const width = Math.ceil(text.width) + CHIP.padX * 2;
  const offset =
    anchor === "right" ? -width / 2 : anchor === "left" ? width / 2 : 0;
  text.setX(offset);
  const frame = scene.add.graphics();
  drawHoloFrame(
    frame,
    { x: offset - width / 2, y: -CHIP.height / 2, width, height: CHIP.height },
    {
      accent: color,
      fill: color,
      fillAlpha: CHIP.fillAlpha,
      borderAlpha: CHIP.borderAlpha,
      radius: HOLO_RADIUS.sm,
    },
  );
  return scene.add.container(x, y, [frame, text]);
}

/** Glyph shown inside each faction's emblem ring. */
export const FACTION_EMBLEMS: Readonly<Record<FactionId, MenuIconName>> = {
  terran_hegemony: "shield",
  free_confederation: "flag",
  synthetic_collective: "network",
  void_corsairs: "crosshair",
  ascendant_empire: "crown",
};

/** Emblem ring styling. */
const EMBLEM = { fillAlpha: 0.14, iconScale: 0.5 } as const;

/**
 * Draw a faction emblem: tinted ring with the faction glyph inside.
 *
 * @param g - Target graphics.
 * @param factionId - Faction whose glyph is drawn.
 * @param center - Emblem centre.
 * @param radius - Ring radius.
 * @param accent - Ring / glyph colour.
 */
export function drawFactionEmblem(
  g: Phaser.GameObjects.Graphics,
  factionId: FactionId,
  center: { readonly x: number; readonly y: number },
  radius: number,
  accent: number,
): void {
  g.fillStyle(accent, EMBLEM.fillAlpha);
  g.fillCircle(center.x, center.y, radius);
  g.lineStyle(HOLO_BORDER.regular, accent, 1);
  g.strokeCircle(center.x, center.y, radius);
  drawMenuIcon(
    g,
    FACTION_EMBLEMS[factionId],
    center,
    radius * 2 * EMBLEM.iconScale,
    accent,
  );
}
