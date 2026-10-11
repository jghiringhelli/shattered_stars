/**
 * ShipCatalogPanel — left panel of ShipPickerScene.
 * Shows faction ship catalog as holo cards; user clicks a ship to stage it,
 * picks a loadout in the detail panel, then clicks ADD to add the config to
 * the roster.
 *
 * Emits: 'addInstance' { shipId: string, loadoutId: string | null }
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import type { FactionId } from "../../config";
import { drawHoloFrame } from "../menu/holoChrome";
import { factionAccent, HOLO_RADIUS, HOLO_SPACING } from "../theme/HoloTheme";
import { ShipDetailPanel } from "./ShipDetailPanel";
import { CatalogScroll } from "./CatalogScroll";
import { CatalogStaging } from "./CatalogStaging";
import { buildCatalogCard } from "./CatalogCard";
import { CAT_X, CAT_W } from "./catalogHelpers";
import type { LoadoutBonuses } from "./types";

export type { LoadoutBonuses };
export { CAT_X, CAT_W };

/** XP-gating hooks: which ship ids are locked and why. Defaults to "nothing locked". */
export interface CatalogGating {
  readonly lockedShipIds: ReadonlySet<string>;
  reasonFor(shipId: string): string;
}

const NO_GATING: CatalogGating = {
  lockedShipIds: new Set<string>(),
  reasonFor: () => "",
};

const ROLE_SORT: Record<string, number> = {
  interceptor: 0,
  light_fighter: 1,
  heavy_fighter: 2,
  bomber: 3,
  gunship: 4,
  support: 5,
  capital: 6,
};

/** Default panel top — the menu grid's first content row. */
const DEFAULT_TOP_Y = 104;
/** Default panel height — content band down to the primary-action row. */
const DEFAULT_PANEL_H = 528;

/** Card grid layout inside the catalog panel. */
const GRID = {
  /** Inner padding of the panel. */
  pad: HOLO_SPACING.sm,
  /** Space reserved on the right for the scrollbar. */
  gutter: HOLO_SPACING.sm,
  /** Horizontal gap between the two card columns. */
  columnGap: HOLO_SPACING.sm,
  rowH: 48,
  rowGap: HOLO_SPACING.sm,
  /** Rows visible before scrolling. */
  rows: 7,
  columns: 2,
} as const;
const CARD_W =
  (CAT_W - GRID.pad * 2 - GRID.gutter - GRID.columnGap) / GRID.columns;
const ROW_PITCH = GRID.rowH + GRID.rowGap;
/** Gap between the catalog and the detail panel / screen edge. */
const DETAIL_GAP = HOLO_SPACING.lg;
const SCREEN_MARGIN = HOLO_SPACING.xxl;

/** Horizontal extent of the detail panel. */
interface DetailArea {
  readonly x: number;
  readonly width: number;
}

export class ShipCatalogPanel extends Phaser.Events.EventEmitter {
  private container!: Phaser.GameObjects.Container;
  private gridContainer!: Phaser.GameObjects.Container;
  private readonly detailPanel: ShipDetailPanel;
  private readonly scroll: CatalogScroll;
  private readonly staging: CatalogStaging;
  private readonly accent: number;
  private rowHits: Array<{ hit: Phaser.GameObjects.Rectangle; top: number }> =
    [];
  private detailArea: DetailArea | null = null;
  private scrollWired = false;
  private showOnlyUnlocked = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ships: ShipDefinition[],
    private readonly factionId: FactionId,
    private readonly gating: CatalogGating = NO_GATING,
    confirmLabel = "ADD",
    private readonly topY = DEFAULT_TOP_Y,
    private readonly panelH = DEFAULT_PANEL_H,
  ) {
    super();
    this.accent = factionAccent(this.factionId);
    this.detailPanel = new ShipDetailPanel(scene);
    this.scroll = new CatalogScroll({
      clipX: CAT_X,
      clipY: this.topY + GRID.pad,
      clipW: CAT_W,
      clipH: GRID.rows * ROW_PITCH,
    });
    this.staging = new CatalogStaging(scene, ships, confirmLabel);
    this.staging.on("addInstance", (e: unknown) => this.emit("addInstance", e));
    this.staging.on("requestRender", () => this.render());
  }

  /** Rebuilds the grid, the staging strip and the detail panel. */
  render(): void {
    this.container?.destroy();
    this.gridContainer?.destroy();
    this.container = this.scene.add.container(0, 0);
    const gridTop = this.topY + GRID.pad;
    this.gridContainer = this.scene.add.container(0, gridTop);
    this.drawBackground();
    this.drawGrid();
    this.gridContainer.setY(gridTop - this.scroll.offset);
    this.scroll.applyMask(this.scene, this.gridContainer);
    this.scroll.drawScrollbar(this.scene);
    if (!this.scrollWired) {
      this.scroll.setupWheel(
        this.scene,
        () => this.gridContainer,
        () => this.syncRowHits(),
      );
      this.scrollWired = true;
    }
    this.syncRowHits();
    const stageTop = gridTop + GRID.rows * ROW_PITCH;
    const stageH = this.panelH - (stageTop - this.topY) - GRID.pad;
    this.staging.render(this.container, stageTop, stageH, this.accent);
    this.renderDetail();
  }

  destroy(): void {
    this.detailPanel.destroy();
    this.scroll.destroy();
    this.staging.destroy();
    this.container?.destroy();
    this.gridContainer?.destroy();
    super.destroy();
  }

  /** Filters the grid down to unlocked ships only (for a less overwhelming new-player view). */
  setShowOnlyUnlocked(value: boolean): void {
    this.showOnlyUnlocked = value;
    this.render();
  }

  /**
   * Place the detail panel explicitly (default: from the catalog's right
   * edge to the screen margin). Takes effect on the next render().
   *
   * @param x - Left edge of the detail panel.
   * @param width - Detail panel width.
   */
  setDetailArea(x: number, width: number): void {
    this.detailArea = { x, width };
  }

  private renderDetail(): void {
    const x = this.detailArea?.x ?? CAT_X + CAT_W + DETAIL_GAP;
    const width =
      this.detailArea?.width ?? this.scene.scale.width - x - SCREEN_MARGIN;
    this.detailPanel.render(
      this.ships,
      this.staging,
      x,
      this.topY,
      width,
      this.panelH,
    );
  }

  private drawBackground(): void {
    const g = this.scene.add.graphics();
    drawHoloFrame(
      g,
      { x: CAT_X, y: this.topY, width: CAT_W, height: this.panelH },
      { accent: this.accent, radius: HOLO_RADIUS.lg },
    );
    this.container.add(g);
  }

  private drawGrid(): void {
    const visible = this.showOnlyUnlocked
      ? this.ships.filter((s) => !this.gating.lockedShipIds.has(s.id))
      : this.ships;
    const sorted = [...visible].sort(
      (a, b) => (ROLE_SORT[a.role] ?? 9) - (ROLE_SORT[b.role] ?? 9),
    );
    this.rowHits = [];
    sorted.forEach((def, i) => {
      const col = i % GRID.columns;
      const row = Math.floor(i / GRID.columns);
      const x = CAT_X + GRID.pad + col * (CARD_W + GRID.columnGap);
      this.drawShipRow(def, x, row * ROW_PITCH);
    });
    const totalRows = Math.ceil(sorted.length / GRID.columns);
    this.scroll.setContentHeight(totalRows * ROW_PITCH);
  }

  private drawShipRow(def: ShipDefinition, x: number, y: number): void {
    const locked = this.gating.lockedShipIds.has(def.id);
    const card = buildCatalogCard(
      this.scene,
      {
        def,
        x,
        y,
        width: CARD_W,
        height: GRID.rowH,
        locked,
        selected: !locked && this.staging.getSelectedShipId() === def.id,
        lockReason: locked ? this.gating.reasonFor(def.id) : "",
        accent: this.accent,
      },
      () => {
        this.staging.selectShip(def.id);
        this.render();
      },
    );
    this.rowHits.push({ hit: card.hit, top: y });
    this.gridContainer.add(card.objects);
  }

  /** Rows scrolled out of the clip must not swallow clicks meant for the staging strip. */
  private syncRowHits(): void {
    for (const { hit, top } of this.rowHits) {
      if (hit.input) {
        hit.input.enabled = this.scroll.isSpanVisible(top, GRID.rowH);
      }
    }
  }
}
