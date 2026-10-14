/**
 * ShipDetailPanel — the big panel right of the ship list (and in the ship
 * picker overlay). A compact header (name, role · size · points, the
 * selected build's price) sits over a tab bar; ONE tab is open at a time
 * (progressive disclosure):
 *
 *   OVERVIEW  art, description, build line, aura tag, four key numbers
 *   STATS     numbers grid, maneuver dial, action bar
 *   LOADOUT   slots, cards with their price, flown cost
 *   PILOT     pilot, initiative, ability
 *   BUILDS    pick a quick build + what it is for / how to fly it
 *
 * The open tab is remembered for the session (detailTabsModel); Q / E,
 * LB / RB and left / right (tabs are focus targets) switch tabs.
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import type { FactionId } from "../../config";
import { getShipLoadouts, type ShipLoadout } from "../../data/ShipLoadouts";
import { bindTabKeys, drawDetailTabs } from "../menu/DetailTabs";
import {
  recallTab,
  rememberTab,
  stepTab,
  tabsFor,
  type DetailScreen,
  type DetailTabId,
} from "../menu/detailTabsModel";
import { drawHoloFrame } from "../menu/holoChrome";
import type { FocusTarget } from "../menu/MenuFocus";
import {
  factionAccent,
  HOLO_RADIUS,
  HOLO_SPACING,
} from "../theme/HoloTheme";
import { computeLoadoutBonuses } from "./catalogHelpers";
import { drawBuildsTab } from "./BuildsTabView";
import {
  drawOverviewBody,
  drawStatsBody,
  type TabBodyArgs,
} from "./detailTabBodies";
import type { SectionArea } from "./detailSections";
import { DETAIL_PAD, drawDetailEmptyState } from "./detailHeader";
import { drawFlownCostLine, drawPanelHeader } from "./detailPanelParts";
import { QuickBuildDetailView } from "./QuickBuildDetailView";

/** Panel bounds (top-left origin). */
interface PanelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Read-only view of the ship/loadout currently staged, owned by CatalogStaging. */
export interface StagingSelection {
  getSelectedShipId(): string | null;
  getSelectedLoadoutId(): string | null;
  selectLoadout(loadoutId: string | null): void;
}

/** Panels narrower than this show only the open tab's label and no key hint (px). */
const NARROW_PANEL_W = 560;
/** Header height above the tab bar (px). */
const HEADER_H = 44;

export class ShipDetailPanel {
  private container: Phaser.GameObjects.Container | null = null;
  private buildsPage = 0;
  private tab: DetailTabId;
  private lastArgs: {
    ships: readonly ShipDefinition[];
    staging: StagingSelection;
    rect: PanelRect;
  } | null = null;

  /**
   * @param scene - Owning scene.
   * @param onFocusTargets - Receives the tab bar's focus targets after each render.
   * @param screen - Which screen's tab set and remembered tab to use.
   * @param keysEnabled - Q / E are ignored while this returns false (a text
   *   field or an overlay owns the keyboard).
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onFocusTargets: (targets: FocusTarget[]) => void = () => {},
    private readonly screen: DetailScreen = "shipPicker",
    keysEnabled: () => boolean = () => true,
  ) {
    this.tab = recallTab(screen);
    bindTabKeys(scene, {
      step: (direction) =>
        this.open(stepTab(tabsFor(this.screen), this.tab, direction)),
      isActive: () =>
        this.container !== null && this.lastArgs !== null && keysEnabled(),
    });
  }

  /** The open tab (e2e / debugging). */
  get openTab(): DetailTabId {
    return this.tab;
  }

  /** Opens a tab and redraws. */
  open(tab: DetailTabId): void {
    if (tab === this.tab) return;
    this.tab = tab;
    rememberTab(this.screen, tab);
    this.rerender();
  }

  /** Renders the panel for the ship currently selected in `staging`, or an empty prompt. */
  render(
    ships: readonly ShipDefinition[],
    staging: StagingSelection,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const rect = { x, y, width: w, height: h };
    this.lastArgs = { ships, staging, rect };
    const def = ships.find((s) => s.id === staging.getSelectedShipId());
    if (!def) {
      const bg = this.resetContainer();
      drawHoloFrame(bg, rect, { radius: HOLO_RADIUS.lg });
      drawDetailEmptyState(this.scene, this.container!, rect);
      this.onFocusTargets([]);
      return;
    }
    this.build(def, staging, rect);
  }

  destroy(): void {
    this.container?.destroy();
    this.container = null;
    this.lastArgs = null;
  }

  private resetContainer(): Phaser.GameObjects.Graphics {
    this.container?.destroy();
    this.container = this.scene.add.container(0, 0);
    const bg = this.scene.add.graphics();
    this.container.add(bg);
    return bg;
  }

  private rerender(): void {
    if (!this.lastArgs) return;
    const { ships, staging, rect } = this.lastArgs;
    this.render(ships, staging, rect.x, rect.y, rect.width, rect.height);
  }

  /** The staged build resolved against the full catalogue (a preset may stage one the row lacks). */
  private selectedLoadout(
    def: ShipDefinition,
    staging: StagingSelection,
  ): ShipLoadout | undefined {
    return getShipLoadouts(def.id).find(
      (l) => l.id === staging.getSelectedLoadoutId(),
    );
  }

  private build(
    def: ShipDefinition,
    staging: StagingSelection,
    rect: PanelRect,
  ): void {
    const accent = factionAccent(def.faction as FactionId);
    drawHoloFrame(this.resetContainer(), rect, {
      radius: HOLO_RADIUS.lg,
      accent,
    });
    const c = this.container!;
    const loadout = this.selectedLoadout(def, staging);
    const x = rect.x + DETAIL_PAD;
    const width = rect.width - DETAIL_PAD * 2;
    const top = rect.y + DETAIL_PAD;
    drawPanelHeader(this.scene, c, def, loadout, { x, y: top, width }, accent);
    const tabs = drawDetailTabs(this.scene, c, {
      x,
      y: top + HEADER_H,
      width,
      accent,
      tabs: tabsFor(this.screen),
      active: this.tab,
      onSelect: (tab) => this.open(tab),
      ...(width < NARROW_PANEL_W ? { compact: true, showKeyHint: false } : {}),
    });
    this.onFocusTargets(tabs.focusTargets);
    const area: SectionArea = {
      scene: this.scene,
      container: c,
      x,
      y: tabs.bottom + HOLO_SPACING.lg,
      width,
    };
    this.drawBody(
      {
        area,
        def,
        loadout,
        bonuses: computeLoadoutBonuses(loadout?.upgrades ?? []),
        bottom: rect.y + rect.height - DETAIL_PAD,
      },
      staging,
      accent,
    );
  }

  private drawBody(
    body: TabBodyArgs,
    staging: StagingSelection,
    accent: number,
  ): void {
    const { area, def, loadout } = body;
    const view = new QuickBuildDetailView(this.scene, area.container);
    const box = {
      shipId: def.id,
      loadout,
      x: area.x,
      y: area.y,
      width: area.width,
    };
    switch (this.tab) {
      case "overview":
        drawOverviewBody(body);
        return;
      case "stats":
        drawStatsBody(body);
        return;
      case "pilot":
        view.render({ ...box, part: "pilot" });
        return;
      case "loadout":
        view.render({ ...box, part: "loadout" });
        drawFlownCostLine(this.scene, area.container, def, loadout, {
          x: area.x,
          bottom: body.bottom,
        });
        return;
      default:
        drawBuildsTab(this.scene, area.container, {
          def,
          selectedLoadoutId: staging.getSelectedLoadoutId(),
          page: this.buildsPage,
          x: area.x,
          y: area.y,
          width: area.width,
          bottom: body.bottom,
          accent,
          onSelect: (id) => {
            staging.selectLoadout(id);
            this.rerender();
          },
          onPage: (page) => {
            this.buildsPage = page;
            this.rerender();
          },
        });
    }
  }
}
