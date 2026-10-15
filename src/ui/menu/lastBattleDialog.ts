/**
 * lastBattleDialog — the stored stats of the last finished battle, opened
 * from the main menu's DETAILS button (a DOM modal: readable, selectable).
 */

import type { LastBattleRecord } from "../../telemetry/lastBattleStore";
import { modeLabel, outcomeLabel } from "../../telemetry/lastBattleStore";
import { resultRows } from "../results/resultsModel";
import { h, modalButton, openModal } from "../dom/modalDialog";

/** Element id of the open dialog. */
export const LAST_BATTLE_DIALOG_ID = "ss-last-battle";

/**
 * @param record - The stored last battle.
 */
export function openLastBattleDetails(record: LastBattleRecord): void {
  const { summary } = record;
  openModal({
    id: LAST_BATTLE_DIALOG_ID,
    title: `${modeLabel(summary.mode)} — ${outcomeLabel(summary.outcome)}`,
    build: (body, close) => {
      const grid = h("div", { class: "ss-keys" });
      for (const row of resultRows(summary)) {
        grid.append(h("span", {}, row.label), h("span", {}, row.value));
      }
      body.append(
        h("p", { class: "ss-muted" }, new Date(record.savedAt).toLocaleString()),
        grid,
        h("div", { class: "ss-modal__actions" }, modalButton("Close", close, true)),
      );
    },
  });
}
