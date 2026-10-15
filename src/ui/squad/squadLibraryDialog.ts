/**
 * squadLibraryDialog — the SQUADS dialog of the Squad Builder (a DOM modal,
 * so the code box has a real text field and clipboard): save the current
 * squad under a name, COPY its SHARE CODE, PASTE a friend's code, and
 * LOAD / DELETE saved squads. Everything goes through squadShare (validated).
 */

import { getShipDefinition } from "../../data/ShipDefinitions";
import {
  MAX_SQUAD_NAME,
  decodeSquadCode,
  deleteSavedSquad,
  encodeSquadCode,
  listSavedSquads,
  saveSquad,
  type SharedSquad,
} from "../../systems/setup/squadShare";
import { h, modalButton, openModal } from "../dom/modalDialog";

/** Element id of the open dialog (e2e looks it up). */
export const SQUAD_LIBRARY_DIALOG_ID = "ss-squad-library";

/** Options of {@link openSquadLibrary}. */
export interface SquadLibraryOptions {
  /** The squad being built (null before one is picked: save / copy are off). */
  readonly current: SharedSquad | null;
  /** The player picked a saved or pasted squad. */
  readonly onLoad: (squad: SharedSquad) => void;
}

/** @returns A one-line description such as "Viper, Raven +1". */
function describeSquad(squad: SharedSquad): string {
  const names = squad.ships
    .slice(0, 2)
    .map((id) => getShipDefinition(id)?.name ?? id);
  const rest = squad.ships.length - names.length;
  return rest > 0 ? `${names.join(", ")} +${rest}` : names.join(", ");
}

/**
 * Open the squads dialog.
 *
 * @param options - Current squad and the load callback.
 */
export function openSquadLibrary(options: SquadLibraryOptions): void {
  openModal({
    id: SQUAD_LIBRARY_DIALOG_ID,
    title: "Squads",
    build: (body, close) => {
      const status = h("div", { class: "ss-modal__status", role: "status" });
      const say = (text: string): void => {
        status.textContent = text;
      };
      const listHost = h("div");
      const renderList = (): void => {
        listHost.replaceChildren(...savedRows(options, close, renderList, say));
      };
      body.append(
        h("h3", {}, "Share this squad"),
        ...shareBlock(options.current, say, renderList),
        h("h3", {}, "Paste a code"),
        ...pasteBlock(options, close, say),
        h("h3", {}, "Saved squads"),
        listHost,
        status,
        h("div", { class: "ss-modal__actions" }, modalButton("Close", close, true)),
      );
      renderList();
    },
  });
}

function shareBlock(
  current: SharedSquad | null,
  say: (text: string) => void,
  refresh: () => void,
): HTMLElement[] {
  if (!current) return [h("p", { class: "ss-muted" }, "Build a squad first to save or share it.")];
  const code = h("textarea", { readonly: "readonly", "aria-label": "Share code", id: "ss-squad-code" }) as HTMLTextAreaElement;
  code.value = encodeSquadCode(current);
  const name = h("input", {
    type: "text",
    id: "ss-squad-name",
    maxlength: String(MAX_SQUAD_NAME),
    placeholder: "Squad name",
    "aria-label": "Squad name",
  }) as HTMLInputElement;
  const actions = h(
    "div",
    { class: "ss-modal__actions" },
    modalButton("Copy code", () => {
      code.select();
      void navigator.clipboard?.writeText(code.value).catch(() => undefined);
      say("Code copied.");
    }),
    modalButton("Save squad", () => {
      const result = saveSquad(name.value, current);
      if ("error" in result) return say(result.error);
      say(`Saved “${name.value.trim()}”.`);
      name.value = "";
      refresh();
    }),
  );
  return [code, h("label", { for: "ss-squad-name" }, "Name"), name, actions];
}

function pasteBlock(
  options: SquadLibraryOptions,
  close: () => void,
  say: (text: string) => void,
): HTMLElement[] {
  const input = h("textarea", {
    id: "ss-squad-paste",
    "aria-label": "Paste a share code",
    placeholder: "SS1:…",
  }) as HTMLTextAreaElement;
  const load = modalButton("Import", () => {
    const decoded = decodeSquadCode(input.value);
    if ("error" in decoded) return say(decoded.error);
    options.onLoad(decoded.squad);
    close();
  });
  return [input, h("div", { class: "ss-modal__actions" }, load)];
}

function savedRows(
  options: SquadLibraryOptions,
  close: () => void,
  refresh: () => void,
  say: (text: string) => void,
): HTMLElement[] {
  const saved = listSavedSquads();
  if (saved.length === 0) return [h("p", { class: "ss-muted" }, "No saved squads yet.")];
  return saved.map((entry) =>
    h(
      "div",
      { class: "ss-modal__actions", "data-saved": entry.name },
      h("span", {}, `${entry.name} — ${describeSquad(entry.squad)}`),
      modalButton("Load", () => {
        options.onLoad(entry.squad);
        close();
      }),
      modalButton("Delete", () => {
        deleteSavedSquad(entry.id);
        say(`Deleted “${entry.name}”.`);
        refresh();
      }),
    ),
  );
}
