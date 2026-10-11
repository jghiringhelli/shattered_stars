/**
 * ReserveListView — the reserve editor's two columns: the ordered reserve
 * (numbered rows with ▲ / ▼ / ✕ and paging) and the "add a ship" picker
 * cycling through the faction's quick builds (◀ / ▶, + ADD). Rebuilt on
 * every change; reports edits through callbacks.
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
import { createHoloText } from "../hud/holoPrimitives";
import { HOLO_PALETTE } from "../theme/HoloTheme";

/** Rows shown per page. */
export const RESERVE_ROWS_PER_PAGE = 9;

const LIST = { left: -350, top: -120, pitch: 28 } as const;
const ICON = { width: 30, height: 22, font: 12 } as const;
/** Icon buttons' x: right of the name column. */
const ICON_X = [-38, -4, 30] as const;
const PICK = { x: 200, top: -120, width: 240, arrowGap: 135 } as const;
const PAGE_Y = LIST.top + RESERVE_ROWS_PER_PAGE * LIST.pitch + 6;

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
    const pages = Math.max(
      1,
      Math.ceil(entries.length / RESERVE_ROWS_PER_PAGE),
    );
    this.page = Math.min(this.page, pages - 1);
    const first = this.page * RESERVE_ROWS_PER_PAGE;
    entries
      .slice(first, first + RESERVE_ROWS_PER_PAGE)
      .forEach((entry, i) =>
        this.row(entry, first + i, LIST.top + i * LIST.pitch, entries.length),
      );
    if (pages > 1) this.pager(pages, entries);
    this.picker(entries);
  }

  /** Destroy the rows and the picker. */
  clear(): void {
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
  }

  private row(
    entry: ReserveEntry,
    index: number,
    y: number,
    count: number,
  ): void {
    const option = toDeployOption(entry);
    const name = option
      ? `${option.label.toUpperCase()}  ${option.cost} PTS`
      : entry.definitionId;
    this.text(
      LIST.left,
      y,
      `${index + 1}  ${name}`,
      HOLO_PALETTE.textPrimary,
    ).setOrigin(0, 0.5);
    this.icon(ICON_X[0], y, "▲", index > 0, () =>
      this.handlers.onMove(index, -1),
    );
    this.icon(ICON_X[1], y, "▼", index < count - 1, () =>
      this.handlers.onMove(index, 1),
    );
    this.icon(ICON_X[2], y, "✕", true, () => this.handlers.onRemove(index));
  }

  private pager(pages: number, entries: readonly ReserveEntry[]): void {
    const flip = (delta: number) => () => {
      this.page = Math.min(pages - 1, Math.max(0, this.page + delta));
      this.render(entries);
    };
    this.icon(LIST.left + ICON.width / 2, PAGE_Y, "◀", this.page > 0, flip(-1));
    this.text(
      LIST.left + ICON.width + 8,
      PAGE_Y,
      `PAGE ${this.page + 1} / ${pages}`,
      HOLO_PALETTE.textSecondary,
    ).setOrigin(0, 0.5);
    this.icon(LIST.left + 150, PAGE_Y, "▶", this.page < pages - 1, flip(1));
  }

  private picker(entries: readonly ReserveEntry[]): void {
    const option = this.catalog[this.pick];
    this.text(PICK.x, PICK.top, "ADD A SHIP", HOLO_PALETTE.textSecondary);
    const cycle = (delta: number) => () => {
      const n = this.catalog.length;
      this.pick = n > 0 ? (this.pick + delta + n) % n : 0;
      this.render(entries);
    };
    this.icon(
      PICK.x - PICK.arrowGap,
      PICK.top + 34,
      "◀",
      this.catalog.length > 1,
      cycle(-1),
    );
    this.icon(
      PICK.x + PICK.arrowGap,
      PICK.top + 34,
      "▶",
      this.catalog.length > 1,
      cycle(1),
    );
    this.text(
      PICK.x,
      PICK.top + 28,
      option ? option.label.toUpperCase() : "—",
      HOLO_PALETTE.textPrimary,
    );
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
    this.track(add);
  }

  private icon(
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
        width: ICON.width,
        height: ICON.height,
        color: HOLO_PALETTE.panelFill,
        variant: "secondary",
        label,
        font: `600 ${ICON.font}px`,
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
      createHoloText(this.scene, x, y, content, "caption", color),
    );
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.parent.add(object);
    this.objects.push(object);
    return object;
  }
}
