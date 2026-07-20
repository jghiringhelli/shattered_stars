/**
 * SquadRosterPanel — right panel of ShipPickerScene.
 * Shows the current squad as instance rows (one row per ship+loadout slot).
 * Hovering a row reveals stats, tactical description, and upgrade effects.
 *
 * Emits: 'removeInstance' { id: string }
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import { FACTION_COLORS } from "../../config";
import type { FactionId } from "../../config";
import { getShipLoadouts } from "../../data/ShipLoadouts";
import { getEncyclopediaEntry } from "../../data/ShipEncyclopedia";
import { UPGRADE_DEFINITIONS } from "../../systems/UpgradeSystem";

export interface SquadInstance {
  id: string;
  shipId: string;
  loadoutId: string | null;
}

export const ROSTER_X = 510;
export const ROSTER_W = 750;

const TOP_Y = 98;
const PANEL_H = 570;
const ROW_H = 36;
const MAX_ROWS = 7;
const DETAIL_TOP = TOP_Y + 32 + MAX_ROWS * ROW_H + 12;

export class SquadRosterPanel extends Phaser.Events.EventEmitter {
  private container!: Phaser.GameObjects.Container;
  private detailContainer!: Phaser.GameObjects.Container;
  private rowBgMap = new Map<string, Phaser.GameObjects.Graphics>();
  private hoveredId: string | null = null;
  private instances: SquadInstance[] = [];
  private ships: ShipDefinition[] = [];
  private pointLimit = 200;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly factionId: FactionId,
  ) {
    super();
  }

  /** Full re-render (called when roster changes) */
  render(
    instances: SquadInstance[],
    ships: ShipDefinition[],
    pointLimit: number,
  ): void {
    this.instances = instances;
    this.ships = ships;
    this.pointLimit = pointLimit;
    this.hoveredId = null;
    this.rowBgMap.clear();
    this.container?.destroy();
    this.detailContainer?.destroy();
    this.container = this.scene.add.container(0, 0);
    this.drawBackground();
    this.drawHeader();
    if (instances.length === 0) {
      this.drawEmptyState();
    } else {
      this.drawInstanceRows();
    }
    this.detailContainer = this.scene.add.container(0, 0);
    this.drawDetailSection();
  }

  destroy(): void {
    this.container?.destroy();
    this.detailContainer?.destroy();
    super.destroy();
  }

  private drawBackground(): void {
    const fCol = FACTION_COLORS[this.factionId];
    const g = this.scene.add.graphics();
    g.fillStyle(0x0d1525, 1);
    g.fillRoundedRect(ROSTER_X, TOP_Y, ROSTER_W, PANEL_H, 10);
    g.lineStyle(2, fCol, 0.7);
    g.strokeRoundedRect(ROSTER_X, TOP_Y, ROSTER_W, PANEL_H, 10);
    this.container.add(g);
  }

  private drawHeader(): void {
    const total = this.computeTotal();
    const over = total > this.pointLimit;
    this.container.add(
      this.scene.add.text(ROSTER_X + 12, TOP_Y + 8, "SQUAD", {
        font: "bold 13px Arial",
        color: "#5577aa",
      }),
    );
    this.container.add(
      this.scene.add
        .text(
          ROSTER_X + ROSTER_W - 12,
          TOP_Y + 8,
          `${total} / ${this.pointLimit} pts`,
          { font: "bold 13px Arial", color: over ? "#ff5544" : "#44ff88" },
        )
        .setOrigin(1, 0),
    );
    const div = this.scene.add.graphics();
    div.lineStyle(1, 0x1e2d40, 1);
    div.lineBetween(
      ROSTER_X + 8,
      TOP_Y + 28,
      ROSTER_X + ROSTER_W - 8,
      TOP_Y + 28,
    );
    this.container.add(div);
  }

  private drawEmptyState(): void {
    this.container.add(
      this.scene.add
        .text(
          ROSTER_X + ROSTER_W / 2,
          TOP_Y + 32 + (MAX_ROWS * ROW_H) / 2,
          "Select a ship on the left,\nthen click  →  ADD TO SQUAD",
          { font: "13px Arial", color: "#2a3d50", align: "center" },
        )
        .setOrigin(0.5),
    );
  }

  private drawInstanceRows(): void {
    this.instances.slice(0, MAX_ROWS).forEach((inst, i) => {
      this.drawInstanceRow(inst, TOP_Y + 32 + i * ROW_H);
    });
    if (this.instances.length > MAX_ROWS) {
      this.container.add(
        this.scene.add.text(
          ROSTER_X + 12,
          TOP_Y + 32 + MAX_ROWS * ROW_H + 2,
          `+${this.instances.length - MAX_ROWS} more — remove some to see all`,
          { font: "9px Arial", color: "#445566" },
        ),
      );
    }
  }

  private drawInstanceRow(inst: SquadInstance, y: number): void {
    const def = this.ships.find((s) => s.id === inst.shipId);
    if (!def) return;
    const isHovered = this.hoveredId === inst.id;
    const loadout =
      getShipLoadouts(inst.shipId).find((l) => l.id === inst.loadoutId) ?? null;
    const pts = loadout?.pointCost ?? def.baseStats.pointCost;
    const rowW = ROSTER_W - 16;

    const bg = this.scene.add.graphics();
    this.paintRowBg(bg, y, rowW, isHovered);
    this.rowBgMap.set(inst.id, bg);
    this.container.add(bg);

    const spriteKey = `ship_${def.faction}_${def.baseStats.size}`;
    this.container.add(
      this.scene.add
        .image(ROSTER_X + 22, y + (ROW_H - 4) / 2, spriteKey)
        .setDisplaySize(22, 22),
    );
    this.container.add(
      this.scene.add.text(ROSTER_X + 36, y + 3, def.name, {
        font: "10px Arial",
        color: "#cce0ff",
      }),
    );
    this.container.add(
      this.scene.add.text(ROSTER_X + 36, y + 15, loadout?.name ?? "Base", {
        font: "9px Arial",
        color: "#3a5a74",
      }),
    );
    this.container.add(
      this.scene.add
        .text(ROSTER_X + ROSTER_W - 44, y + 3, `${pts}pt`, {
          font: "9px Arial",
          color: "#445566",
        })
        .setOrigin(1, 0),
    );

    const dupeCount = this.instances.filter(
      (i) => i.shipId === inst.shipId,
    ).length;
    if (dupeCount > 1) {
      this.container.add(
        this.scene.add.text(ROSTER_X + ROSTER_W - 58, y + 15, `×${dupeCount}`, {
          font: "bold 9px Arial",
          color: "#ccaa44",
        }),
      );
    }

    const rm = this.scene.add
      .text(ROSTER_X + ROSTER_W - 22, y + (ROW_H - 4) / 2, "×", {
        font: "bold 14px Arial",
        color: "#884444",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    rm.on("pointerover", () => rm.setColor("#ff6666"));
    rm.on("pointerout", () => rm.setColor("#884444"));
    rm.on("pointerdown", () => this.emit("removeInstance", { id: inst.id }));
    this.container.add(rm);

    const hit = this.scene.add
      .rectangle(
        ROSTER_X + 8 + (rowW - 28) / 2,
        y + (ROW_H - 4) / 2,
        rowW - 28,
        ROW_H - 4,
        0,
        0,
      )
      .setInteractive();
    hit.on("pointerover", () => this.setHovered(inst.id));
    hit.on("pointerout", () => {
      if (this.hoveredId === inst.id) this.setHovered(null);
    });
    this.container.add(hit);
  }

  private paintRowBg(
    g: Phaser.GameObjects.Graphics,
    y: number,
    rowW: number,
    hovered: boolean,
  ): void {
    g.clear();
    g.fillStyle(hovered ? 0x12281a : 0x111820, 1);
    g.fillRoundedRect(ROSTER_X + 8, y, rowW, ROW_H - 4, 4);
    g.lineStyle(1, hovered ? 0x44ff88 : 0x1a2535, 1);
    g.strokeRoundedRect(ROSTER_X + 8, y, rowW, ROW_H - 4, 4);
  }

  /** Update only the hovered state without a full re-render */
  private setHovered(id: string | null): void {
    if (this.hoveredId === id) return;
    const prev = this.hoveredId;
    this.hoveredId = id;
    this.updateRowBgHighlight(prev, false);
    this.updateRowBgHighlight(id, true);
    this.detailContainer?.destroy();
    this.detailContainer = this.scene.add.container(0, 0);
    this.drawDetailSection();
  }

  private updateRowBgHighlight(
    instanceId: string | null,
    hovered: boolean,
  ): void {
    if (!instanceId) return;
    const i = this.instances.findIndex((inst) => inst.id === instanceId);
    if (i < 0 || i >= MAX_ROWS) return;
    const bg = this.rowBgMap.get(instanceId);
    if (!bg) return;
    this.paintRowBg(bg, TOP_Y + 32 + i * ROW_H, ROSTER_W - 16, hovered);
  }

  private drawDetailSection(): void {
    const div = this.scene.add.graphics();
    div.lineStyle(1, 0x1a2840, 1);
    div.lineBetween(
      ROSTER_X + 8,
      DETAIL_TOP - 4,
      ROSTER_X + ROSTER_W - 8,
      DETAIL_TOP - 4,
    );
    this.detailContainer.add(div);

    if (!this.hoveredId) {
      this.detailContainer.add(
        this.scene.add
          .text(
            ROSTER_X + ROSTER_W / 2,
            DETAIL_TOP + 50,
            "Hover a row to see ship details",
            { font: "11px Arial", color: "#1e2d40" },
          )
          .setOrigin(0.5),
      );
      return;
    }
    const inst = this.instances.find((i) => i.id === this.hoveredId);
    const def = inst ? this.ships.find((s) => s.id === inst.shipId) : null;
    if (!def || !inst) return;
    const loadout =
      getShipLoadouts(inst.shipId).find((l) => l.id === inst.loadoutId) ?? null;
    const x = ROSTER_X + 12;
    let y = DETAIL_TOP + 4;
    this.detailContainer.add(
      this.scene.add.text(x, y, def.name, {
        font: "bold 13px Arial",
        color: "#88ffaa",
      }),
    );
    this.detailContainer.add(
      this.scene.add
        .text(
          ROSTER_X + ROSTER_W - 12,
          y,
          `${def.role.replace(/_/g, " ").toUpperCase()} · ${def.baseStats.size.toUpperCase()}`,
          { font: "9px Arial", color: "#556677" },
        )
        .setOrigin(1, 0),
    );
    y += 18;
    y = this.drawStats(def, x, y) + 6;
    const entry = getEncyclopediaEntry(def.id);
    const loreText = entry?.lore ?? def.description;
    const loreT = this.scene.add.text(x, y, loreText, {
      font: "10px Arial",
      color: "#778899",
      wordWrap: { width: ROSTER_W - 28 },
    });
    this.detailContainer.add(loreT);
    y += Math.min(44, (loreT.height || 0) + 6);
    if (loadout?.upgrades.length) this.drawUpgrades(loadout, x, y);
  }

  private drawStats(def: ShipDefinition, x: number, y: number): number {
    const stats = [
      { label: "ATK", value: def.baseStats.attack, color: 0xff6666 },
      { label: "AGI", value: def.baseStats.agility, color: 0x44ffaa },
      { label: "HUL", value: def.baseStats.hull, color: 0x66ccff },
      { label: "SHD", value: def.baseStats.shields, color: 0x4488ff },
      { label: "SPD", value: def.baseStats.speed.max, color: 0xffcc44 },
    ];
    const barW = Math.floor((ROSTER_W - 28) / stats.length);
    stats.forEach((s, idx) => {
      const sx = x + idx * barW;
      const g = this.scene.add.graphics();
      g.fillStyle(s.color, 0.15);
      g.fillRect(sx, y + 12, barW - 4, 14);
      g.fillStyle(s.color, 0.65);
      g.fillRect(sx, y + 12, Math.max(4, (s.value / 8) * (barW - 4)), 14);
      this.detailContainer.add(g);
      const col = `#${s.color.toString(16).padStart(6, "0")}`;
      this.detailContainer.add(
        this.scene.add.text(sx, y, s.label, {
          font: "bold 9px Arial",
          color: col,
        }),
      );
      this.detailContainer.add(
        this.scene.add
          .text(sx + (barW - 4) / 2, y + 13, String(s.value), {
            font: "bold 11px Arial",
            color: "#ffffff",
          })
          .setOrigin(0.5, 0),
      );
    });
    return y + 34;
  }

  private drawUpgrades(
    loadout: { name: string; description: string; upgrades: readonly string[] },
    x: number,
    y: number,
  ): void {
    this.detailContainer.add(
      this.scene.add.text(x, y, `${loadout.name}: ${loadout.description}`, {
        font: "bold 10px Arial",
        color: "#889966",
      }),
    );
    let uy = y + 14;
    for (const upId of loadout.upgrades) {
      const upg = UPGRADE_DEFINITIONS[upId];
      if (!upg) continue;
      const e = (upg.effects ?? {}) as Record<string, unknown>;
      const parts: string[] = [];
      if (e["hullBonus"]) parts.push(`+${e["hullBonus"]} hull`);
      if (e["shieldBonus"]) parts.push(`+${e["shieldBonus"]} shld`);
      if (e["attackBonus"]) parts.push(`+${e["attackBonus"]} atk`);
      if (e["agilityBonus"]) parts.push(`+${e["agilityBonus"]} agi`);
      if (e["addsAction"]) parts.push(`+${e["addsAction"]}`);
      if (e["rerollCount"]) parts.push(`reroll ${e["rerollCount"]}`);
      if (e["chargesAdded"]) parts.push(`+${e["chargesAdded"]} charges`);
      this.detailContainer.add(
        this.scene.add.text(
          x + 8,
          uy,
          `• ${upg.name}${parts.length ? `  [${parts.join(", ")}]` : ""}`,
          { font: "9px Arial", color: "#667755" },
        ),
      );
      uy += 12;
    }
  }

  private computeTotal(): number {
    return this.instances.reduce((sum, inst) => {
      const def = this.ships.find((s) => s.id === inst.shipId);
      const loadout = getShipLoadouts(inst.shipId).find(
        (l) => l.id === inst.loadoutId,
      );
      return sum + (loadout?.pointCost ?? def?.baseStats.pointCost ?? 0);
    }, 0);
  }
}
