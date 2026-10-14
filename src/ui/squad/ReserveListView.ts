/**
 * ReserveListView — the reserve editor's two columns: the ordered reserve
 * (numbered rows; click one to select it, then ▲ / ▼ / ✕ in the gutter act on
 * the selected row; paging when long) and the "add a ship" picker cycling
 * through the faction's quick builds (◀ / ▶, + ADD). Rebuilt on every change;
 * reports edits through callbacks.
 */

import Phaser from "phaser";
import {
  MAX_RESERVE_ENTRIES,
  toDeployOption,
  type DeployOption,
  type ReserveEntry,
} from "../../arcade/reinforcements";
import { createHoverButton } from "../ButtonFactory";
import type { HoloPressButton } from "../menu/HoloPressButton";
import { addSelectable } from "../menu/FlatControls";
import { attachTermTooltip } from "../menu/HintTooltip";
import { addTipZone } from "../menu/tooltipTargets";
import { createHoloText } from "../hud/holoPrimitives";
import type { TermId } from "../../data/tooltips";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import { selectionAfterMove, selectionAfterRemove } from "./reserveExplain";

/** Rows shown per page. */
export const RESERVE_ROWS_PER_PAGE = 9;

const LIST = { left: -350, top: -120, pitch: 28, width: 300, rowH: 24 } as const;
const BUTTON = { width: 32, height: 28, font: 12 } as const;
/** The ▲ ▼ ✕ stack in the gutter right of the list. */
const TOOLBAR = { x: -20, pitch: 36 } as const;
const PICK = { x: 200, top: -120, width: 240, arrowGap: 135 } as const;
const PAGE_Y = LIST.top + RESERVE_ROWS_PER_PAGE * LIST.pitch + 6;
/** Text size of every label in the list (px) — nothing under 12 px. */
const TEXT_PX = 12;

/** What the view edits. */
export interface ReserveListHandlers {
  readonly onMove: (index: number, delta: -1 | 1) => void;
  readonly onRemove: (index: number) => void;
  readonly onAdd: (entry: ReserveEntry) => void;
}

export class ReserveListView {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private page = 0;
  private pick = 0;
  private selected: number | null = 0;
  private lastEntries: readonly ReserveEntry[] = [];

  /**
   * @param scene - The Squad Builder scene.
   * @param parent - The editor panel.
   * @param catalog - The faction's deployable quick builds.
   * @param handlers - Edit callbacks.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly parent: Phaser.GameObjects.Container,
    private readonly catalog: readonly DeployOption[],
    private readonly handlers: ReserveListHandlers,
  ) {}

  /** The catalog ship the + ADD button would add (e2e). */
  get pickedOption(): DeployOption | null {
    return this.catalog[this.pick] ?? null;
  }

  /** The selected reserve row (e2e), or null. */
  get selectedIndex(): number | null {
    return this.selected;
  }

  /** Add the catalog ship shown in the picker to the reserve. */
  addPicked(): void {
    const option = this.pickedOption;
    if (option)
      this.handlers.onAdd({
        definitionId: option.definitionId,
        loadoutId: option.loadoutId,
      });
  }

  /** @param entries - The reserve to show. */
  render(entries: readonly ReserveEntry[]): void {
    this.clear();
    this.lastEntries = entries;
    this.selected =
      entries.length === 0
        ? null
        : Math.min(this.selected ?? 0, entries.length - 1);
    const pages = Math.max(
      1,
      Math.ceil(entries.length / RESERVE_ROWS_PER_PAGE),
    );
    this.page = Math.min(this.page, pages - 1);
    const first = this.page * RESERVE_ROWS_PER_PAGE;
    entries
      .slice(first, first + RESERVE_ROWS_PER_PAGE)
      .forEach((entry, i) => this.row(entry, first + i, i));
    this.toolbar(entries);
    if (pages > 1) this.pager(pages, entries);
    this.picker(entries);
  }

  /** Destroy the rows and the picker. */
  clear(): void {
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
  }

  private row(entry: ReserveEntry, index: number, slot: number): void {
    const option = toDeployOption(entry);
    const name = option
      ? `${option.label.toUpperCase()}  ${option.cost} PTS`
      : entry.definitionId;
    this.track(
      addSelectable(this.scene, this.parent, {
        x: LIST.left,
        y: LIST.top + slot * LIST.pitch - LIST.rowH / 2,
        width: LIST.width,
        height: LIST.rowH,
        label: `${index + 1}  ${name}`,
        role: "micro",
        selected: index === this.selected,
        accent: HOLO_PALETTE.accent,
        tip: "reserve.flown_cost",
        onPress: () => {
          this.selected = index;
          this.render(this.lastEntries);
        },
      }),
    );
  }

  private toolbar(entries: readonly ReserveEntry[]): void {
    const sel = this.selected;
    const act = (
      slot: number,
      label: string,
      enabled: boolean,
      term: TermId,
      onClick: () => void,
    ): void => {
      const button = this.button(TOOLBAR.x, LIST.top + slot * TOOLBAR.pitch, label, enabled, onClick);
      attachTermTooltip(this.scene, button, term);
    };
    act(0, "▲", sel !== null && sel > 0, "reserve.order", () => this.move(-1, entries));
    act(1, "▼", sel !== null && sel < entries.length - 1, "reserve.order", () => this.move(1, entries));
    act(2, "✕", sel !== null, "reserve.row_remove", () => this.removeSelected(entries));
  }

  private move(delta: -1 | 1, entries: readonly ReserveEntry[]): void {
    if (this.selected === null) return;
    const index = this.selected;
    this.selected = selectionAfterMove(index, delta, entries.length);
    this.handlers.onMove(index, delta);
  }

  private removeSelected(entries: readonly ReserveEntry[]): void {
    if (this.selected === null) return;
    const index = this.selected;
    this.selected = selectionAfterRemove(index, entries.length - 1);
    this.handlers.onRemove(index);
  }

  private pager(pages: number, entries: readonly ReserveEntry[]): void {
    const flip = (delta: number) => () => {
      this.page = Math.min(pages - 1, Math.max(0, this.page + delta));
      this.render(entries);
    };
    const back = this.button(LIST.left + BUTTON.width / 2, PAGE_Y, "◀", this.page > 0, flip(-1));
    const next = this.button(LIST.left + 150, PAGE_Y, "▶", this.page < pages - 1, flip(1));
    attachTermTooltip(this.scene, back, "reserve.page");
    attachTermTooltip(this.scene, next, "reserve.page");
    this.text(LIST.left + BUTTON.width + 8, PAGE_Y, `PAGE ${this.page + 1} / ${pages}`, HOLO_PALETTE.textSecondary).setOrigin(0, 0.5);
  }

  private picker(entries: readonly ReserveEntry[]): void {
    const option = this.catalog[this.pick];
    this.text(PICK.x, PICK.top, "ADD A SHIP", HOLO_PALETTE.textSecondary);
    this.track(addTipZone(this.scene, this.parent, { x: PICK.x - PICK.width / 2, y: PICK.top - 10, width: PICK.width, height: 20 }, "reserve.add"));
    const cycle = (delta: number) => () => {
      const n = this.catalog.length;
      this.pick = n > 0 ? (this.pick + delta + n) % n : 0;
      this.render(entries);
    };
    this.button(PICK.x - PICK.arrowGap, PICK.top + 34, "◀", this.catalog.length > 1, cycle(-1));
    this.button(PICK.x + PICK.arrowGap, PICK.top + 34, "▶", this.catalog.length > 1, cycle(1));
    this.text(PICK.x, PICK.top + 28, option ? option.label.toUpperCase() : "—", HOLO_PALETTE.textPrimary);
    const detail = option
      ? `${option.cost} PTS · ${option.role.replace(/_/g, " ").toUpperCase()}`
      : "";
    this.text(PICK.x, PICK.top + 46, detail, HOLO_PALETTE.textSecondary);
    const add = createHoverButton(
      this.scene,
      PICK.x,
      PICK.top + 84,
      {
        width: PICK.width,
        height: 32,
        color: HOLO_PALETTE.panelFill,
        variant: "secondary",
        label: "+ ADD TO RESERVE",
        font: "600 12px",
      },
      () => this.addPicked(),
    );
    add.setEnabled(
      option !== undefined && entries.length < MAX_RESERVE_ENTRIES,
    );
    attachTermTooltip(this.scene, add, "reserve.add");
    this.track(add);
  }

  private button(
    x: number,
    y: number,
    label: string,
    enabled: boolean,
    onClick: () => void,
  ): HoloPressButton {
    const button = createHoverButton(
      this.scene,
      x,
      y,
      {
        width: BUTTON.width,
        height: BUTTON.height,
        color: HOLO_PALETTE.panelFill,
        variant: "secondary",
        label,
        font: `600 ${BUTTON.font}px`,
      },
      onClick,
    );
    button.setEnabled(enabled);
    return this.track(button);
  }

  private text(
    x: number,
    y: number,
    content: string,
    color: number,
  ): Phaser.GameObjects.Text {
    return this.track(
      createHoloText(this.scene, x, y, content, "caption", color).setFontSize(TEXT_PX),
    );
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.parent.add(object);
    this.objects.push(object);
    return object;
  }
}
