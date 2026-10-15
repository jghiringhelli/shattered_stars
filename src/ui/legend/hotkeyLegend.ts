/**
 * hotkeyLegend — the hotkey legend overlay (`?` / F1, or CONTROLS in the
 * pause menu): a DOM modal listing the keys, buttons and gestures of the
 * current mode, read from the live bindings. DOM, not Phaser, so it stays
 * crisp at any camera zoom and screen size.
 */

import { h, modalButton, openModal } from "../dom/modalDialog";
import {
  legendSections,
  type LegendContext,
  type LegendSection,
} from "./hotkeyLegendModel";

/** Element id of the open legend (e2e / tests look it up). */
export const HOTKEY_LEGEND_ID = "ss-hotkey-legend";

/** Options of {@link openHotkeyLegend}. */
export interface HotkeyLegendOptions {
  readonly context: LegendContext;
  /** Runs once after the legend closed. */
  readonly onClose?: () => void;
}

/**
 * @param section - A legend section.
 * @returns Heading plus a key/label grid for it.
 */
function renderSection(section: LegendSection): HTMLElement[] {
  const grid = h("div", { class: "ss-legend" });
  grid.append(
    h("span", { class: "ss-legend__head" }, ""),
    h("span", { class: "ss-legend__head" }, "KEYBOARD"),
    h("span", { class: "ss-legend__head" }, "GAMEPAD"),
  );
  for (const row of section.rows) {
    grid.append(
      h("span", {}, row.label),
      h("span", {}, row.keyboard),
      h("span", {}, row.gamepad),
    );
  }
  return [h("h3", {}, section.title), grid];
}

/**
 * Open the legend over the game.
 *
 * @param options - Mode context and close hook.
 */
export function openHotkeyLegend(options: HotkeyLegendOptions): void {
  openModal({
    id: HOTKEY_LEGEND_ID,
    title: "Hotkeys",
    wide: true,
    ...(options.onClose ? { onClose: options.onClose } : {}),
    build: (body, close) => {
      body.append(
        h("p", { class: "ss-muted" }, "Live bindings — rebind them in Settings › Controls"),
        ...legendSections(options.context).flatMap(renderSection),
        h(
          "div",
          { class: "ss-modal__actions" },
          modalButton("Close", close, true),
        ),
      );
    },
  });
}
