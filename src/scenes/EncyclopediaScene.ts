/**
 * EncyclopediaScene
 *
 * Browsable ship encyclopedia with faction filtering, scrollable ship list,
 * and a full detail panel showing cinematic art, lore, and normalized stats.
 * Navigation: faction tabs, mouse wheel scroll, ESC to return to menu.
 */

import Phaser from "phaser";
import {
  getAllEncyclopediaEntries,
  getEncyclopediaEntry,
} from "../data/ShipEncyclopedia";
import type { EncyclopediaEntry } from "../data/ShipEncyclopedia";
import { getShipDefinition } from "../data/ShipDefinitions";
import { EncyclopediaDetailPanel } from "../ui/EncyclopediaDetailPanel";
import { FACTION_COLORS } from "../config";
import type { FactionId } from "../config";
import { addSceneBackground, addSceneTitleFrame } from "../ui/TexturedPanel";

const FACTION_TABS = [
  { key: "all", label: "ALL", color: 0x445566 as number },
  {
    key: "terran_hegemony",
    label: "HGMY",
    color: FACTION_COLORS.terran_hegemony as number,
  },
  {
    key: "free_confederation",
    label: "CONF",
    color: FACTION_COLORS.free_confederation as number,
  },
  {
    key: "synthetic_collective",
    label: "SYNT",
    color: FACTION_COLORS.synthetic_collective as number,
  },
  {
    key: "void_corsairs",
    label: "CORS",
    color: FACTION_COLORS.void_corsairs as number,
  },
  {
    key: "ascendant_empire",
    label: "ASCN",
    color: FACTION_COLORS.ascendant_empire as number,
  },
] as const;

const LEFT_W = 285;
const LIST_TOP = 134;
const LIST_H = 580;
const ROW_H = 26;
const TAB_W = 42;
const TAB_GAP = 3;
const TAB_OX = 6;

export class EncyclopediaScene extends Phaser.Scene {
  private detailPanel!: EncyclopediaDetailPanel;
  private listContainer!: Phaser.GameObjects.Container;
  private filteredEntries: EncyclopediaEntry[] = [];
  private activeFaction: FactionId | null = null;
  private listScrollY = 0;
  private maxScrollY = 0;
  private tabBgMap = new Map<string, Phaser.GameObjects.Graphics>();

  constructor() {
    super({ key: "EncyclopediaScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x050d1a);
    addSceneBackground(this);
    this.createHeader();
    this.createLeftPanel();
    this.detailPanel = new EncyclopediaDetailPanel(
      this,
      LEFT_W + 5,
      55,
      this.scale.width - LEFT_W - 10,
    );
    this.rebuildList();
    this.setupInput();
  }

  private createHeader(): void {
    const w = this.scale.width;
    addSceneTitleFrame(this, 25, 50);
    const g = this.add.graphics();
    g.fillStyle(0x0d1525, 1);
    g.fillRect(0, 0, w, 50);
    g.lineStyle(1, 0x223355, 1);
    g.lineBetween(0, 50, w, 50);
    this.add
      .text(w / 2, 25, "SHIP ENCYCLOPEDIA", {
        font: "bold 22px Arial",
        color: "#88bbdd",
      })
      .setOrigin(0.5);
    this.addBackButton();
  }

  private addBackButton(): void {
    const btn = this.add.container(62, 25);
    const bg = this.add.graphics();
    const draw = (hov: boolean): void => {
      bg.clear();
      bg.fillStyle(hov ? 0x334455 : 0x1a2a3a, 1);
      bg.fillRoundedRect(-52, -14, 104, 28, 6);
    };
    draw(false);
    btn.add([
      bg,
      this.add
        .text(0, 0, "← BACK", { font: "bold 13px Arial", color: "#aaccee" })
        .setOrigin(0.5),
    ]);
    btn.setInteractive(
      new Phaser.Geom.Rectangle(-52, -14, 104, 28),
      Phaser.Geom.Rectangle.Contains,
    );
    btn.on("pointerover", () => draw(true));
    btn.on("pointerout", () => draw(false));
    btn.on("pointerdown", () => this.scene.start("MainMenuScene"));
  }

  private createLeftPanel(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x090f1c, 1);
    bg.fillRect(0, 50, LEFT_W, this.scale.height - 50);
    bg.lineStyle(1, 0x1a2a44, 1);
    bg.lineBetween(LEFT_W, 50, LEFT_W, this.scale.height);
    this.createFactionTabs();
    this.listContainer = this.add.container(0, LIST_TOP);
    const maskG = this.add.graphics();
    maskG.fillRect(0, LIST_TOP, LEFT_W, LIST_H);
    this.listContainer.setMask(
      new Phaser.Display.Masks.GeometryMask(this, maskG),
    );
  }

  private createFactionTabs(): void {
    FACTION_TABS.forEach(({ key, label, color }, i) => {
      const bx = TAB_OX + i * (TAB_W + TAB_GAP);
      const bg = this.add.graphics();
      this.tabBgMap.set(key, bg);
      this.drawTab(bg, bx, 58, color, key === "all");
      this.add
        .text(bx + TAB_W / 2, 70, label, {
          font: "9px Arial",
          color: "#dddddd",
        })
        .setOrigin(0.5);
      const hit = this.add
        .rectangle(bx + TAB_W / 2, 70, TAB_W, 24, 0, 0)
        .setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () =>
        this.onFactionFilter(key === "all" ? null : (key as FactionId)),
      );
    });
  }

  private drawTab(
    g: Phaser.GameObjects.Graphics,
    bx: number,
    by: number,
    color: number,
    active: boolean,
  ): void {
    g.clear();
    g.fillStyle(active ? color : 0x141e2e, 1);
    g.fillRoundedRect(bx, by, TAB_W, 24, 4);
    g.lineStyle(1, color, active ? 1 : 0.45);
    g.strokeRoundedRect(bx, by, TAB_W, 24, 4);
  }

  private onFactionFilter(faction: FactionId | null): void {
    this.activeFaction = faction;
    this.listScrollY = 0;
    const activeKey = faction ?? "all";
    FACTION_TABS.forEach(({ key, color }, i) => {
      const bg = this.tabBgMap.get(key);
      if (bg)
        this.drawTab(
          bg,
          TAB_OX + i * (TAB_W + TAB_GAP),
          58,
          color,
          key === activeKey,
        );
    });
    this.rebuildList();
  }

  private rebuildList(): void {
    this.listContainer.removeAll(true);
    const all = getAllEncyclopediaEntries();
    this.filteredEntries = this.activeFaction
      ? all.filter(
          (e) => getShipDefinition(e.shipId)?.faction === this.activeFaction,
        )
      : [...all];
    this.filteredEntries.forEach((entry, i) => {
      this.listContainer.add(this.createShipRow(entry, i * ROW_H));
    });
    this.maxScrollY = Math.max(0, this.filteredEntries.length * ROW_H - LIST_H);
    this.listContainer.y = LIST_TOP;
    if (this.filteredEntries[0])
      this.showDetail(this.filteredEntries[0].shipId);
  }

  private createShipRow(
    entry: EncyclopediaEntry,
    y: number,
  ): Phaser.GameObjects.Container {
    const row = this.add.container(0, y);
    const def = getShipDefinition(entry.shipId);
    const fCol = def ? FACTION_COLORS[def.faction] : 0x444466;

    const rowBg = this.add.graphics();
    const drawBg = (hover: boolean): void => {
      rowBg.clear();
      rowBg.fillStyle(hover ? 0x162030 : 0x090f1c, 1);
      rowBg.fillRect(0, 0, LEFT_W - 1, ROW_H - 1);
    };
    drawBg(false);
    row.add(rowBg);

    const dot = this.add.graphics();
    dot.fillStyle(fCol, 1);
    dot.fillCircle(10, ROW_H / 2, 4);
    row.add(dot);

    row.add(
      this.add.text(22, 5, def?.name ?? entry.shipId, {
        font: "12px Arial",
        color: "#ccddee",
      }),
    );
    row.add(
      this.add
        .text(LEFT_W - 5, 5, (def?.role ?? "").slice(0, 5).toUpperCase(), {
          font: "9px Arial",
          color: "#334455",
        })
        .setOrigin(1, 0),
    );

    const hit = this.add
      .rectangle(LEFT_W / 2, ROW_H / 2, LEFT_W, ROW_H, 0, 0)
      .setInteractive({ useHandCursor: true });
    row.add(hit);
    hit.on("pointerover", () => drawBg(true));
    hit.on("pointerout", () => drawBg(false));
    hit.on("pointerdown", () => this.showDetail(entry.shipId));
    return row;
  }

  private showDetail(shipId: string): void {
    this.detailPanel.show(getEncyclopediaEntry(shipId));
  }

  private setupInput(): void {
    this.input.keyboard!.on("keydown-ESC", () =>
      this.scene.start("MainMenuScene"),
    );
    this.input.on(
      "wheel",
      (_p: unknown, _go: unknown, _dx: unknown, dy: number) => {
        this.listScrollY = Phaser.Math.Clamp(
          this.listScrollY + dy * 0.35,
          0,
          this.maxScrollY,
        );
        this.listContainer.y = LIST_TOP - this.listScrollY;
      },
    );
  }
}
