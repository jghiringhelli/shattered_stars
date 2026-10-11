/**
 * settingsTabContext — what a Settings tab builder gets from the scene, the
 * tab list, and the row grid every tab lays its rows out on.
 */

import type Phaser from "phaser";
import type { KeyChord } from "../../input/KeyBindings";
import type { GameSettings } from "../../systems/SettingsStorage";
import type { HoloRect } from "../menu/holoChrome";
import type { FocusTarget } from "../menu/MenuFocus";
import type { MenuIconName } from "../menu/MenuIcons";
import type { SettingsRowConfig } from "./settingsRows";

/** Settings tabs. */
export type SettingsTabId =
  "audio" | "controls" | "gamepad" | "accessibility" | "gameplay" | "advanced";

/** Tab bar entries in order (number keys 1–6 jump to them). */
export const SETTINGS_TABS: ReadonlyArray<{
  readonly id: SettingsTabId;
  readonly label: string;
  readonly icon: MenuIconName;
}> = [
  { id: "audio", label: "Audio", icon: "speaker" },
  { id: "controls", label: "Controls", icon: "keyboard" },
  { id: "gamepad", label: "Gamepad", icon: "gamepad" },
  { id: "accessibility", label: "Accessibility", icon: "eye" },
  { id: "gameplay", label: "Gameplay", icon: "crosshair" },
  { id: "advanced", label: "Advanced", icon: "gear" },
];

/** Message tone for {@link SettingsTabContext.notify}. */
export type NoticeTone = "info" | "warning";

/** Services a tab builder uses. */
export interface SettingsTabContext {
  readonly scene: Phaser.Scene;
  /** Content area (inside the panel). */
  readonly area: HoloRect;
  /** @returns The current settings document. */
  settings(): GameSettings;
  /** Persist + apply a new document. */
  update(next: GameSettings): void;
  /** Re-render the current tab (after a reset / profile switch). */
  rebuild(): void;
  /** Register a keyboard-focusable control, in reading order. */
  addFocus(target: FocusTarget): void;
  /** Wait for the next key chord (ESC cancels → callback not called). */
  captureKey(onChord: (chord: KeyChord) => void, onDone: () => void): void;
  /**
   * Wait for the next gamepad button (ESC or B cancels → callback not
   * called).
   */
  captureButton(onButton: (button: number) => void, onDone: () => void): void;
  /** Show a one-line notice under the panel. */
  notify(message: string, tone?: NoticeTone): void;
}

/** Row grid options. */
export interface RowGrid {
  readonly columns: number;
  readonly rowHeight: number;
  readonly gap: number;
  /** Extra offset from the area top (px). */
  readonly top?: number;
  /** Width of the grid (default: the whole area). */
  readonly width?: number;
}

/** Horizontal gap between grid columns. */
const COLUMN_GAP = 24;

/**
 * Placement of a row in a column grid inside the content area.
 *
 * @param area - Content area.
 * @param grid - Columns, row height, gap.
 * @param cell - Column and row index plus the row label.
 * @returns Row config (top-left, width, height, label).
 */
export function gridRow(
  area: HoloRect,
  grid: RowGrid,
  cell: {
    readonly column: number;
    readonly row: number;
    readonly label: string;
  },
): SettingsRowConfig {
  const width = grid.width ?? area.width;
  const columnWidth = (width - COLUMN_GAP * (grid.columns - 1)) / grid.columns;
  return {
    x: area.x + cell.column * (columnWidth + COLUMN_GAP),
    y: area.y + (grid.top ?? 0) + cell.row * (grid.rowHeight + grid.gap),
    width: columnWidth,
    height: grid.rowHeight,
    label: cell.label,
  };
}
