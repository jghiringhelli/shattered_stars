/**
 * squadListParts — holo building blocks of SquadListPanel: list geometry,
 * team lanes (subtle frames with team-colour captions), the add-squad tile,
 * the add-team button, the remove-team link and the scrollbar.
 */

import type Phaser from "phaser";
import { TEAM_LABELS } from "../../core/squadTypes";
import { createHoverButton } from "../ButtonFactory";
import type { HoloPressButton } from "../menu/HoloPressButton";
import { drawHoloFrame, type HoloRect } from "../menu/holoChrome";
import { drawMenuIcon } from "../menu/MenuIcons";
import { HOLO_BORDER, HOLO_PALETTE, HOLO_RADIUS } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";
import { CARD_H_COLLAPSED } from "./squadCardLayout";
import { SQUAD_TYPE, addCaption, teamAccent } from "./squadBuilderStyle";

/** Geometry of the squad list column (scene coordinates). */
export const LIST_LAYOUT = {
  /** Left edge of the list column (right of the format panel). */
  x: 328,
  /** Right margin of the lanes. */
  rightMargin: 32,
  /** Top of the scroll clip (just below the header rule). */
  clipTop: 96,
  /** Space kept free at the bottom for the action bar. */
  clipBottomMargin: 84,
  /** "Format: …" label row. */
  formatLabelY: 102,
  /** First lane top. */
  rowStartY: 128,
  laneHeaderH: 32,
  lanePad: 12,
  laneGap: 12,
  cardGap: 12,
  addSquadW: 96,
  addTeamW: 148,
  addTeamH: 32,
  /** Vertical room reserved for the add-team row. */
  addTeamRowH: 48,
  /** Scrollbar geometry. */
  scrollbarW: 4,
  scrollbarInset: 12,
  scrollbarMinThumb: 24,
  /** Wheel delta → scroll pixels. */
  wheelFactor: 0.8,
} as const;

/** Lane / tile opacities. */
const LANE_ALPHA = {
  fill: 0.35,
  border: 0.35,
  tileFill: 0.45,
  tileBorder: 0.5,
  thumb: 0.6,
} as const;

/** Glyph sizes. */
const ICON = { plus: 16, close: 9, closeGap: 6, captionGap: 4 } as const;

/**
 * Draw a team lane frame with its "TEAM Tn" caption.
 *
 * @param scene - Owning scene.
 * @param rect - Lane bounds.
 * @param teamId - Team number 1–4.
 * @returns [frame, caption] objects.
 */
export function createTeamLane(
  scene: Phaser.Scene,
  rect: HoloRect,
  teamId: number,
): Phaser.GameObjects.GameObject[] {
  const accent = teamAccent(teamId);
  const g = scene.add.graphics();
  drawHoloFrame(g, rect, {
    accent,
    fillAlpha: LANE_ALPHA.fill,
    borderAlpha: LANE_ALPHA.border,
  });
  g.fillStyle(accent, 1);
  g.fillRect(
    rect.x + LIST_LAYOUT.lanePad,
    rect.y + LIST_LAYOUT.laneHeaderH / 2 - SQUAD_TYPE.caption / 2,
    HOLO_BORDER.focus,
    SQUAD_TYPE.caption,
  );
  const label = TEAM_LABELS[teamId - 1] ?? `T${teamId}`;
  const caption = addCaption(
    scene,
    rect.x + LIST_LAYOUT.lanePad * 1.5,
    rect.y + LIST_LAYOUT.laneHeaderH / 2,
    `TEAM ${label}`,
    accent,
  ).setOrigin(0, 0.5);
  return [g, caption];
}

/**
 * "Remove team" link (× glyph + caption), right-aligned at (right, centreY).
 *
 * @param scene - Owning scene.
 * @param right - Right edge.
 * @param centreY - Vertical centre.
 * @param onRemove - Fired on press.
 * @returns [glyph, caption] objects; the caption is interactive.
 */
export function createRemoveTeamLink(
  scene: Phaser.Scene,
  right: number,
  centreY: number,
  onRemove: () => void,
): Phaser.GameObjects.GameObject[] {
  const caption = addCaption(
    scene,
    right,
    centreY,
    "Remove team",
    HOLO_PALETTE.textMuted,
  )
    .setOrigin(1, 0.5)
    .setInteractive({ useHandCursor: true });
  const glyph = scene.add.graphics();
  const glyphX = right - caption.width - ICON.closeGap - ICON.close / 2;
  const paint = (color: number): void => {
    glyph.clear();
    drawMenuIcon(glyph, "close", { x: glyphX, y: centreY }, ICON.close, color);
    caption.setColor(toCssColor(color));
  };
  paint(HOLO_PALETTE.textMuted);
  caption.on("pointerover", () => paint(HOLO_PALETTE.danger));
  caption.on("pointerout", () => paint(HOLO_PALETTE.textMuted));
  caption.on("pointerdown", onRemove);
  return [glyph, caption];
}

/**
 * Dashed-feel "add squad" tile (plus glyph + caption) at top-left (x, y).
 *
 * @param scene - Owning scene.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param onAdd - Fired on press.
 * @returns The tile container.
 */
export function createAddSquadTile(
  scene: Phaser.Scene,
  x: number,
  y: number,
  onAdd: () => void,
): Phaser.GameObjects.Container {
  const width = LIST_LAYOUT.addSquadW;
  const height = CARD_H_COLLAPSED;
  const tile = scene.add.container(x, y);
  const g = scene.add.graphics();
  const caption = addCaption(
    scene,
    width / 2,
    height / 2 + ICON.plus / 2 + ICON.captionGap,
    "Add squad",
  ).setOrigin(0.5, 0);
  const paint = (hover: boolean): void => {
    const color = hover ? HOLO_PALETTE.accent : HOLO_PALETTE.textMuted;
    g.clear();
    drawHoloFrame(
      g,
      { x: 0, y: 0, width, height },
      {
        accent: hover ? HOLO_PALETTE.accent : HOLO_PALETTE.border,
        fill: hover ? HOLO_PALETTE.panelFillRaised : HOLO_PALETTE.panelFill,
        fillAlpha: LANE_ALPHA.tileFill,
        borderAlpha: hover ? 1 : LANE_ALPHA.tileBorder,
        radius: HOLO_RADIUS.md,
      },
    );
    drawMenuIcon(
      g,
      "plus",
      { x: width / 2, y: height / 2 - ICON.plus / 2 },
      ICON.plus,
      color,
    );
    caption.setColor(toCssColor(color));
  };
  paint(false);
  const hit = scene.add
    .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
    .setInteractive({ useHandCursor: true });
  hit.on("pointerover", () => paint(true));
  hit.on("pointerout", () => paint(false));
  hit.on("pointerdown", onAdd);
  tile.add([g, caption, hit]);
  return tile;
}

/**
 * Secondary "Add Team" button with a plus glyph, top-left at (x, y).
 *
 * @param scene - Owning scene.
 * @param x - Left edge.
 * @param y - Top edge.
 * @param onAdd - Fired on press.
 * @returns The button.
 */
export function createAddTeamButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  onAdd: () => void,
): HoloPressButton {
  const { addTeamW, addTeamH } = LIST_LAYOUT;
  return createHoverButton(
    scene,
    x + addTeamW / 2,
    y + addTeamH / 2,
    {
      width: addTeamW,
      height: addTeamH,
      color: HOLO_PALETTE.panelFill,
      variant: "secondary",
      label: "Add Team",
      font: `600 ${SQUAD_TYPE.label}px`,
      icon: "plus",
    },
    onAdd,
  );
}

/** Scroll state needed to draw the scrollbar. */
export interface ScrollbarSpec {
  readonly trackX: number;
  readonly top: number;
  readonly visibleH: number;
  readonly contentH: number;
  readonly scrollY: number;
  readonly maxScroll: number;
}

/**
 * Draw a thin track + accent thumb into `g` (cleared first).
 *
 * @param g - Target graphics (screen-fixed, outside the scroll container).
 * @param spec - Track position and scroll state.
 */
export function drawListScrollbar(
  g: Phaser.GameObjects.Graphics,
  spec: ScrollbarSpec,
): void {
  const { scrollbarW, scrollbarMinThumb } = LIST_LAYOUT;
  const thumbH = Math.max(
    scrollbarMinThumb,
    spec.visibleH * (spec.visibleH / spec.contentH),
  );
  const thumbY =
    spec.top + (spec.scrollY / spec.maxScroll) * (spec.visibleH - thumbH);
  const radius = scrollbarW / 2;
  g.clear();
  g.fillStyle(HOLO_PALETTE.track, HOLO_PALETTE.trackAlpha);
  g.fillRoundedRect(spec.trackX, spec.top, scrollbarW, spec.visibleH, radius);
  g.fillStyle(HOLO_PALETTE.accent, LANE_ALPHA.thumb);
  g.fillRoundedRect(spec.trackX, thumbY, scrollbarW, thumbH, radius);
}
