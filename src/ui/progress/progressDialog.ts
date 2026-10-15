/**
 * The profile / progress panel (HTML modal): pilot name, level and XP, how
 * much of the roster is unlocked, the battle record, and RESET PROGRESS
 * behind a confirmation. Opened from the main menu footer and Settings.
 */

import { SHIP_DEFINITIONS } from "../../data/ShipDefinitions";
import { PlayerProfileManager } from "../../systems/PlayerProfile";
import {
  h,
  modalButton,
  openModal,
  type ModalHandle,
} from "../dom/modalDialog";
import { progressRows } from "./progressModel";

/** DOM id of the dialog (e2e uses it). */
export const PROGRESS_DIALOG_ID = "ss-progress-dialog";

const SHIPS = Object.values(SHIP_DEFINITIONS);

function rowsGrid(): HTMLElement {
  const grid = h("div", { class: "ss-keys" });
  for (const row of progressRows(PlayerProfileManager.getActive(), SHIPS))
    grid.append(h("span", {}, row.label), h("span", {}, row.value));
  return grid;
}

/**
 * Open the panel.
 *
 * @returns The open dialog.
 */
export function openProgressDialog(): ModalHandle {
  return openModal({
    id: PROGRESS_DIALOG_ID,
    title: "PILOT PROGRESS",
    build: (body, close) => renderPanel(body, close),
  });
}

/** Draw the panel into `body`. */
function renderPanel(body: HTMLElement, close: () => void): void {
  body.replaceChildren(
    h(
      "p",
      { class: "ss-muted" },
      "XP comes from every mode and unlocks ships and factions in the Squad Builder.",
    ),
    rowsGrid(),
    h(
      "div",
      { class: "ss-modal__actions" },
      modalButton("RESET PROGRESS", () => renderConfirm(body, close)),
      modalButton("CLOSE", close, true),
    ),
  );
}

/** Draw the reset confirmation into `body`. */
function renderConfirm(body: HTMLElement, close: () => void): void {
  body.replaceChildren(
    h(
      "p",
      { role: "alert" },
      "Reset all XP, unlocks and battle stats of this pilot? This cannot be undone.",
    ),
    h(
      "div",
      { class: "ss-modal__actions" },
      modalButton("KEEP PROGRESS", () => renderPanel(body, close), true),
      modalButton("YES, RESET", () => {
        PlayerProfileManager.resetProgress(PlayerProfileManager.getActive().id);
        renderPanel(body, close);
      }),
    ),
  );
}
