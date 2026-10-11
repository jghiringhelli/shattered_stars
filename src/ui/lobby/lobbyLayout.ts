/**
 * lobbyLayout — layout grid and shared text/tone helpers for the multiplayer
 * lobby (room browser, room view, dialogs). Geometry targets 1280×720 and
 * follows MENU_LAYOUT (32-px margins, content from y=104).
 */

import type Phaser from "phaser";
import { MENU_LAYOUT } from "../menu/MenuScaffold";
import { holoFont } from "../theme/holoFont";
import { toCssColor } from "../theme/colorMath";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";

/** Room browser geometry. */
export const BROWSER_LAYOUT = {
  /** Centre y of the action button row. */
  actionRowY: MENU_LAYOUT.contentTop + 20,
  actionWidth: 168,
  actionHeight: 40,
  actionGap: HOLO_SPACING.md,
  /** Room table panel. */
  tableX: 96,
  tableTop: 168,
  tableBottomInset: 72,
  /** Column header strip height. */
  headerHeight: 32,
  /** Room row height and gap. */
  rowHeight: 44,
  rowGap: 6,
  /** JOIN button size. */
  joinWidth: 120,
  joinHeight: 28,
} as const;

/** Column x offsets from the table's left edge. */
export const ROOM_COLUMNS = {
  name: 24,
  host: 380,
  players: 620,
  mode: 760,
} as const;

/** Room view geometry. */
export const ROOM_LAYOUT = {
  playersWidth: 752,
  columnGap: HOLO_SPACING.lg,
  slotHeight: 72,
  slotGap: HOLO_SPACING.sm,
  /** Minimum panel height (keeps the chat usable in 2-player rooms). */
  minPanelHeight: 268,
  /** Gap between the panels and the room action row. */
  actionGap: 44,
  actionWidth: 168,
  actionHeight: 40,
  actionSpacing: 192,
} as const;

/** Status line tone. */
export type StatusTone = "neutral" | "success" | "warning" | "danger";

/** Colour per status tone. */
export const STATUS_TONE_COLORS: Readonly<Record<StatusTone, number>> = {
  neutral: HOLO_PALETTE.textSecondary,
  success: HOLO_PALETTE.success,
  warning: HOLO_PALETTE.warning,
  danger: HOLO_PALETTE.danger,
};

/** Text style options for {@link addLobbyText}. */
export interface LobbyTextStyle {
  readonly size: number;
  readonly weight?: string;
  readonly color?: number;
  readonly letterSpacing?: number;
  readonly originX?: number;
  readonly originY?: number;
}

/**
 * Add a holo-font text object.
 *
 * @param scene - Owning scene.
 * @param position - Anchor position.
 * @param content - Text.
 * @param style - Size, weight, colour, tracking and origin.
 * @returns The text object.
 */
export function addLobbyText(
  scene: Phaser.Scene,
  position: { readonly x: number; readonly y: number },
  content: string,
  style: LobbyTextStyle,
): Phaser.GameObjects.Text {
  return scene.add
    .text(position.x, position.y, content, {
      ...holoFont(style.size, style.weight ?? "400"),
      color: toCssColor(style.color ?? HOLO_PALETTE.textPrimary),
    })
    .setLetterSpacing(style.letterSpacing ?? 0)
    .setOrigin(style.originX ?? 0, style.originY ?? 0.5);
}
