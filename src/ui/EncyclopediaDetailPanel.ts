/**
 * EncyclopediaDetailPanel — the right-side panel of EncyclopediaScene: a
 * HoloPanel bordered in the selected ship's faction accent, the ship name and
 * role chip, a tab bar (OVERVIEW / STATS / LOADOUT / LORE — one visible at a
 * time, remembered for the session; Q / E, LB / RB or the mouse switch) and
 * the open tab's body (shipDetailBodies). Everything under the frame lives in
 * one body container that is rebuilt when the ship or the tab changes.
 */

import Phaser from "phaser";
import { getShipDefinition } from "../data/ShipDefinitions";
import type { EncyclopediaEntry } from "../data/ShipEncyclopedia";
import { getEquippableLoadouts } from "../data/ShipLoadouts";
import { roleTermId } from "../data/tooltips";
import { createHoloPanel, type HoloPanel } from "./hud/HoloPanel";
import { drawHoloFrame, type HoloRect } from "./menu/holoChrome";
import { bindTabKeys, drawDetailTabs, DETAIL_TABS_H } from "./menu/DetailTabs";
import {
  recallTab,
  rememberTab,
  stepTab,
  tabsFor,
  type DetailTabId,
} from "./menu/detailTabsModel";
import { addTipZone } from "./menu/tooltipTargets";
import { addPickerText, pickerTextStyle } from "./picker/pickerStyle";
import {
  HOLO_BORDER,
  HOLO_PALETTE,
  HOLO_SPACING,
  factionAccent,
} from "./theme/HoloTheme";
import {
  PANEL_HEADER_HEIGHT,
  ROLE_COLORS,
  snakeToLabel,
} from "./encyclopedia/encyclopediaLayout";
import {
  drawLoadout,
  drawLore,
  drawOverview,
  drawStats,
  type ShipTabContext,
} from "./encyclopedia/shipDetailBodies";

/** The screen whose tab set and remembered tab the panel uses. */
const SCREEN = "encyclopediaShip";
/** Role chip height (px). */
const CHIP_H = 24;
/** Panel header size (px) — nothing under 12 px at 1280x720. */
const PANEL_TITLE_PX = 12;
/** Gap between the name and the role chip (px). */
const NAME_GAP = 16;

/** Detail view of one encyclopedia entry. */
export class EncyclopediaDetailPanel {
  private readonly panel: HoloPanel;
  /** Role / best-with hint of the signature build (kept for e2e; shown on OVERVIEW). */
  readonly hintText: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Container | null = null;
  private entry: EncyclopediaEntry | null = null;
  private tab: DetailTabId = recallTab(SCREEN);
  private buildIndex = 0;

  /**
   * @param scene - Owning scene.
   * @param area - Panel bounds in world coordinates.
   * @param tabKeysActive - Whether Q / E may switch tabs now (not while typing a search).
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly area: HoloRect,
    tabKeysActive: () => boolean = () => true,
  ) {
    this.panel = createHoloPanel(
      scene,
      area.x + area.width / 2,
      area.y + area.height / 2,
      { width: area.width, height: area.height, title: " ", titleSize: PANEL_TITLE_PX },
    );
    this.hintText = scene.add
      .text(0, 0, "", pickerTextStyle("name", HOLO_PALETTE.accent))
      .setVisible(false);
    bindTabKeys(scene, {
      step: (direction) =>
        this.open(stepTab(tabsFor(SCREEN), this.tab, direction)),
      isActive: () => this.entry !== null && tabKeysActive(),
    });
  }

  /** The open tab (e2e). */
  get openTab(): DetailTabId {
    return this.tab;
  }

  /** @param tab - The tab to open. */
  open(tab: DetailTabId): void {
    if (tab === this.tab) return;
    this.tab = tab;
    rememberTab(SCREEN, tab);
    this.render();
  }

  /**
   * Update the panel to display the given encyclopedia entry.
   * @param entry - The encyclopedia entry to display.
   */
  show(entry: EncyclopediaEntry): void {
    if (this.entry?.shipId !== entry.shipId) this.buildIndex = 0;
    this.entry = entry;
    this.render();
  }

  private render(): void {
    const entry = this.entry;
    const def = entry ? getShipDefinition(entry.shipId) : undefined;
    if (!entry || !def) return;
    const accent = factionAccent(def.faction);
    this.panel.setAccent(accent).setTitle(snakeToLabel(def.faction));
    this.body?.destroy();
    const body = this.scene.add.container(0, 0);
    this.body = body;
    this.hintText.setVisible(false);
    const pad = HOLO_SPACING.lg;
    const x = this.area.x + pad;
    const width = this.area.width - pad * 2;
    const top = this.area.y + PANEL_HEADER_HEIGHT + pad;
    this.drawHeader(body, def, { x, y: top, width }, accent);
    const tabsY = top + CHIP_H + HOLO_SPACING.md;
    drawDetailTabs(this.scene, body, {
      x,
      y: tabsY,
      width,
      accent,
      tabs: tabsFor(SCREEN),
      active: this.tab,
      onSelect: (tab) => this.open(tab),
    });
    const ctx: ShipTabContext = {
      scene: this.scene,
      container: body,
      x,
      y: tabsY + DETAIL_TABS_H + pad,
      width,
      bottom: this.area.y + this.area.height - pad,
      entry,
      def,
      accent,
      hintText: this.hintText,
    };
    this.drawBody(ctx);
  }

  private drawBody(ctx: ShipTabContext): void {
    if (this.tab === "stats") drawStats(ctx);
    else if (this.tab === "lore") drawLore(ctx);
    else if (this.tab === "loadout") {
      const loadouts = getEquippableLoadouts(ctx.def.id);
      drawLoadout(ctx, {
        loadouts,
        index: this.buildIndex,
        onStep: (direction) => {
          const count = Math.max(1, loadouts.length);
          this.buildIndex = (this.buildIndex + direction + count) % count;
          this.render();
        },
      });
    } else {
      const entry = ctx.entry;
      drawOverview(ctx, () => {
        if (this.entry?.shipId === entry.shipId && this.tab === "overview") this.render();
      });
    }
  }

  private drawHeader(
    body: Phaser.GameObjects.Container,
    def: NonNullable<ReturnType<typeof getShipDefinition>>,
    box: { readonly x: number; readonly y: number; readonly width: number },
    accent: number,
  ): void {
    const name = addPickerText(this.scene, { x: box.x, y: box.y }, def.name, "title", HOLO_PALETTE.textPrimary);
    const label = addPickerText(this.scene, { x: 0, y: 0 }, snakeToLabel(def.role), "micro", HOLO_PALETTE.textPrimary).setOrigin(0, 0.5);
    const chipX = box.x + name.width + NAME_GAP;
    const chipW = label.width + HOLO_SPACING.md * 2;
    const color = ROLE_COLORS[def.role] ?? HOLO_PALETTE.textSecondary;
    const chip = this.scene.add.graphics();
    drawHoloFrame(chip, { x: chipX, y: box.y, width: chipW, height: CHIP_H }, {
      accent: color,
      fill: color,
      fillAlpha: 0.18,
      borderWidth: HOLO_BORDER.regular,
      borderAlpha: 1,
      radius: CHIP_H / 2,
    });
    label.setPosition(chipX + HOLO_SPACING.md, box.y + CHIP_H / 2);
    const cost = addPickerText(this.scene, { x: box.x + box.width, y: box.y }, `${def.baseStats.pointCost} pt`, "title", accent).setOrigin(1, 0);
    body.add([name, chip, label, cost]);
    addTipZone(this.scene, body, { x: chipX, y: box.y, width: chipW, height: CHIP_H }, roleTermId(def.role));
    addTipZone(this.scene, body, { x: cost.x - cost.width, y: box.y, width: cost.width, height: cost.height }, "stat.points");
  }
}
