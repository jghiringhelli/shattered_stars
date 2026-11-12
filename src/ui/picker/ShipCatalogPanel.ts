/**
 * ShipCatalogPanel — left panel of ShipPickerScene and the Skirmish ship step:
 * ships grouped into role sections (each header explains its role) under a
 * row of filter chips (role filter + sort by points). The user clicks a ship
 * to stage it, picks a payload in the detail panel, then clicks ADD (or
 * LAUNCH) to add the config to the roster.
 *
 * Emits: 'addInstance' { shipId: string, loadoutId: string | null } and
 * 'selectionChanged' (CatalogSelection) after every render.
 */

import Phaser from "phaser";
import type { ShipDefinition, ShipRole } from "../../core/types";
import type { FactionId } from "../../config";
import { getEquippableLoadouts } from "../../data/ShipLoadouts";
import { sortRolesForSections } from "../../data/roleHints/roleSections";
import { drawHoloFrame } from "../menu/holoChrome";
import type { FocusTarget } from "../menu/MenuFocus";
import { factionAccent, HOLO_RADIUS, HOLO_SPACING } from "../theme/HoloTheme";
import { ShipDetailPanel } from "./ShipDetailPanel";
import { CatalogScroll } from "./CatalogScroll";
import { CatalogStaging } from "./CatalogStaging";
import { buildCatalogCard } from "./CatalogCard";
import { drawFilterBar, FILTER_BAR_H } from "./CatalogFilterBar";
import { drawSectionHeader, SECTION_HEADER_H } from "./CatalogSectionHeader";
import {
  buildSections,
  layoutSections,
  nextSort,
  toggleCollapsed,
  type CatalogFilters,
  type GridItem,
} from "./catalogSections";
import { CAT_X, CAT_W } from "./catalogHelpers";
import type { LoadoutBonuses } from "./types";

export type { LoadoutBonuses };
export { CAT_X, CAT_W };

/** XP-gating hooks: which ship ids are locked and why. Defaults to "nothing locked". */
export interface CatalogGating {
  readonly lockedShipIds: ReadonlySet<string>;
  reasonFor(shipId: string): string;
}

/** Role sections the player folded; remembered for the session. */
let collapsedRoles: ReadonlySet<ShipRole> = new Set();

const NO_GATING: CatalogGating = { lockedShipIds: new Set<string>(), reasonFor: () => "" };

/** What the catalog currently has staged (the "selectionChanged" payload). */
export interface CatalogSelection {
  readonly shipId: string | null;
  readonly loadoutId: string | null;
}

/** What the format hides from the catalog and what starts staged. */
export interface CatalogOptions {
  /** Capital ships left out because the format is not Epic (shown as a notice). */
  readonly hiddenCapitals?: number;
  /** Ship and build staged on open (coming back to the screen). */
  readonly initial?: CatalogSelection;
}

/** Default panel top — the menu grid's first content row. */
const DEFAULT_TOP_Y = 104;
/** Default panel height — content band down to the primary-action row. */
const DEFAULT_PANEL_H = 528;
/** Height of the staging strip (selection line + confirm button). */
const STAGE_H = 104;

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
  /** Gap between one section's cards and the next header. */
  sectionGap: HOLO_SPACING.sm,
  columns: 2,
} as const;
const CARD_W =
  (CAT_W - GRID.pad * 2 - GRID.gutter - GRID.columnGap) / GRID.columns;
const ROW_PITCH = GRID.rowH + GRID.rowGap;
const SECTION_METRICS = {
  columns: GRID.columns,
  rowPitch: ROW_PITCH,
  headerH: SECTION_HEADER_H,
  sectionGap: GRID.sectionGap,
} as const;
/** Gap between the catalog and the detail panel / screen edge. */
const DETAIL_GAP = HOLO_SPACING.lg;
const SCREEN_MARGIN = HOLO_SPACING.xxl;

/** Horizontal extent of the detail panel. */
interface DetailArea {
  readonly x: number;
  readonly width: number;
}

/** A placed row of the scrolling grid and the zones that must follow the clip. */
interface GridRow {
  readonly hits: Phaser.GameObjects.Rectangle[];
  readonly top: number;
  readonly height: number;
}

export class ShipCatalogPanel extends Phaser.Events.EventEmitter {
  private container!: Phaser.GameObjects.Container;
  private gridContainer!: Phaser.GameObjects.Container;
  private readonly detailPanel: ShipDetailPanel;
  private readonly scroll: CatalogScroll;
  private readonly staging: CatalogStaging;
  private readonly accent: number;
  private readonly gridTop: number;
  private gridRows: GridRow[] = [];
  private detailArea: DetailArea | null = null;
  private scrollWired = false;
  private showOnlyUnlocked = false;
  private filters: CatalogFilters = { role: null, sort: "default" };
  private chipTargets: FocusTarget[] = [];
  private tabTargets: FocusTarget[] = [];
  /** Filter-chip then tab focus targets; mutated in place so a MenuFocus keeps them. */
  readonly focusTargets: FocusTarget[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ships: ShipDefinition[],
    private readonly factionId: FactionId,
    private readonly gating: CatalogGating = NO_GATING,
    confirmLabel = "ADD",
    private readonly topY = DEFAULT_TOP_Y,
    private readonly panelH = DEFAULT_PANEL_H,
    private readonly options: CatalogOptions = {},
  ) {
    super();
    this.accent = factionAccent(this.factionId);
    this.gridTop = this.topY + GRID.pad * 2 + FILTER_BAR_H;
    this.detailPanel = new ShipDetailPanel(scene, (targets) => {
      this.tabTargets = targets;
      this.syncFocusTargets();
    });
    this.scroll = new CatalogScroll({
      clipX: CAT_X,
      clipY: this.gridTop,
      clipW: CAT_W,
      clipH: this.panelH - (this.gridTop - this.topY) - STAGE_H,
    });
    this.staging = new CatalogStaging(scene, ships, confirmLabel);
    this.staging.on("addInstance", (e: unknown) => this.emit("addInstance", e));
    this.staging.on("requestRender", () => this.render());
    const initial = options.initial;
    if (initial?.shipId) this.staging.restore(initial.shipId, initial.loadoutId);
  }

  /** Rebuilds the chips, the sectioned grid, the staging strip and the detail panel. */
  render(): void {
    this.container?.destroy();
    this.gridContainer?.destroy();
    this.container = this.scene.add.container(0, 0);
    this.gridContainer = this.scene.add.container(0, this.gridTop);
    this.drawBackground();
    this.drawChips();
    this.drawGrid();
    this.gridContainer.setY(this.gridTop - this.scroll.offset);
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
    const stageTop = this.topY + this.panelH - STAGE_H;
    this.staging.render(
      this.container,
      stageTop,
      STAGE_H - GRID.pad,
      this.accent,
    );
    this.renderDetail();
    this.emit("selectionChanged", {
      shipId: this.staging.getSelectedShipId(),
      loadoutId: this.staging.getSelectedLoadoutId(),
    } satisfies CatalogSelection);
  }

  destroy(): void {
    this.detailPanel.destroy();
    this.scroll.destroy();
    this.staging.destroy();
    this.container?.destroy();
    this.gridContainer?.destroy();
    this.focusTargets.length = 0;
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

  /** Role filter + sort chips above the grid. */
  private drawChips(): void {
    const roles = sortRolesForSections(this.ships.map((ship) => ship.role));
    const targets = drawFilterBar(this.scene, this.container, {
      x: CAT_X + GRID.pad,
      y: this.topY + GRID.pad,
      width: CAT_W - GRID.pad * 2,
      accent: this.accent,
      roles,
      epicOnlyCapitals: (this.options.hiddenCapitals ?? 0) > 0,
      filters: this.filters,
      onRole: (role) => this.applyFilters({ ...this.filters, role }),
      onSort: () =>
        this.applyFilters({ ...this.filters, sort: nextSort(this.filters.sort) }),
    });
    this.chipTargets = targets;
    this.syncFocusTargets();
  }

  private syncFocusTargets(): void {
    this.focusTargets.splice(
      0,
      this.focusTargets.length,
      ...this.chipTargets,
      ...this.tabTargets,
    );
    this.emit("focusTargetsChanged");
  }

  /** Folds / unfolds a role section (remembered for the session). */
  private toggleSection(role: ShipRole): void {
    collapsedRoles = toggleCollapsed(collapsedRoles, role);
    this.render();
  }

  private applyFilters(filters: CatalogFilters): void {
    this.filters = filters;
    this.scroll.reset();
    this.render();
  }

  private drawGrid(): void {
    const visible = this.showOnlyUnlocked
      ? this.ships.filter((s) => !this.gating.lockedShipIds.has(s.id))
      : this.ships;
    const sections = buildSections(
      visible,
      this.filters,
      (id) => getEquippableLoadouts(id).length,
      { hiddenCapitals: this.options.hiddenCapitals ?? 0, collapsed: collapsedRoles },
    );
    const layout = layoutSections(sections, SECTION_METRICS);
    this.gridRows = [];
    for (const item of layout.items) this.drawItem(item);
    this.scroll.setContentHeight(layout.height);
  }

  private drawItem(item: GridItem): void {
    if (item.kind === "header") {
      const hits = drawSectionHeader(this.scene, this.gridContainer, {
        section: item.section,
        x: CAT_X + GRID.pad,
        y: item.y,
        width: CAT_W - GRID.pad * 2 - GRID.gutter,
        accent: this.accent,
        ...(item.section.epicOnly
          ? {}
          : { onToggle: () => this.toggleSection(item.section.role) }),
      });
      this.gridRows.push({ hits, top: item.y, height: SECTION_HEADER_H });
      return;
    }
    const x = CAT_X + GRID.pad + item.column * (CARD_W + GRID.columnGap);
    this.drawShipRow(item.ship, x, item.y);
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
    this.gridRows.push({ hits: card.hits, top: y, height: GRID.rowH });
    this.gridContainer.add(card.objects);
  }

  /** Rows scrolled out of the clip must not swallow clicks or hovers meant for the staging strip. */
  private syncRowHits(): void {
    for (const { hits, top, height } of this.gridRows) {
      const visible = this.scroll.isSpanVisible(top, height);
      for (const hit of hits) {
        if (hit.input) hit.input.enabled = visible;
      }
    }
  }
}
