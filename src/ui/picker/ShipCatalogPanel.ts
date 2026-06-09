/**
 * ShipCatalogPanel — left panel of ShipPickerScene.
 * Shows faction ship catalog; user clicks a ship to stage it, picks a loadout,
 * then clicks [→ ADD TO SQUAD] to add the config to the roster.
 *
 * Emits: 'addInstance' { shipId: string, loadoutId: string | null }
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import { FACTION_COLORS } from "../../config";
import type { FactionId } from "../../config";
import { getShipLoadouts } from "../../data/ShipLoadouts";
import { UPGRADE_DEFINITIONS } from "../../systems/UpgradeSystem";
import { ShipTooltip } from "./ShipTooltip";
import type { LoadoutBonuses } from "./types";

export type { LoadoutBonuses };

/** Maps an action key to a human-readable in-game label. */
function formatActionName(action: string): string {
  const labels: Record<string, string> = {
    boost: "Boost",
    barrel_roll: "Barrel Roll",
    calculate: "Calculate",
    coordinate: "Coordinate",
    target_lock: "Target Lock",
    evade: "Evade",
    focus: "Focus",
  };
  return labels[action] ?? action.replace(/_/g, " ");
}

/** Aggregates stat and special effects from a list of upgrade IDs. */
function computeLoadoutBonuses(upgradeIds: readonly string[]): LoadoutBonuses {
  const b: LoadoutBonuses = {
    hull: 0,
    shld: 0,
    atk: 0,
    agi: 0,
    range: 0,
    actions: [],
    rerolls: 0,
    charges: 0,
  };
  for (const upId of upgradeIds) {
    const e = UPGRADE_DEFINITIONS[upId]?.effects;
    if (!e) continue;
    if (e.hullBonus) b.hull += e.hullBonus;
    if (e.shieldBonus) b.shld += e.shieldBonus;
    if (e.attackBonus) b.atk += e.attackBonus;
    if (e.agilityBonus) b.agi += e.agilityBonus;
    if (e.rangeBonus) b.range += e.rangeBonus;
    if (e.addsAction) b.actions.push(formatActionName(e.addsAction));
    if (e.addsActionLinked)
      b.actions.push(
        `${formatActionName(e.addsActionLinked.action)} (linked → ${formatActionName(e.addsActionLinked.linkedTo)})`,
      );
    if (e.rerollCount) b.rerolls += e.rerollCount;
    if (e.chargesAdded) b.charges += e.chargesAdded;
  }
  return b;
}

/** Produces short colored-stat strings like "+2 HUL  +1 ATK". */
function buildStatLine(b: LoadoutBonuses, basePt: number): string {
  const parts: string[] = [`${basePt}pt`];
  if (b.hull) parts.push(`${b.hull > 0 ? "+" : ""}${b.hull} HUL`);
  if (b.shld) parts.push(`${b.shld > 0 ? "+" : ""}${b.shld} SHD`);
  if (b.atk) parts.push(`${b.atk > 0 ? "+" : ""}${b.atk} ATK`);
  if (b.agi) parts.push(`${b.agi > 0 ? "+" : ""}${b.agi} AGI`);
  if (b.range) parts.push(`+${b.range} RNG`);
  return parts.join("  ");
}

export const CAT_X = 60;
export const CAT_W = 440;

const ROLE_SORT: Record<string, number> = {
  interceptor: 0,
  light_fighter: 1,
  heavy_fighter: 2,
  bomber: 3,
  gunship: 4,
  support: 5,
  capital: 6,
};

/** Secondary capability tags derived from ship role and available actions. */
function secondaryTags(def: ShipDefinition): string[] {
  const tags: string[] = [];
  if (def.role === "gunship" || def.baseStats.actions.includes("rotate_arc"))
    tags.push("TURRET");
  if (def.role === "bomber" || def.baseStats.actions.includes("reload"))
    tags.push("ORDNANCE");
  if (def.role === "support" || def.baseStats.actions.includes("coordinate"))
    tags.push("SUPPORT");
  return tags;
}
const TOP_Y = 98;
const PANEL_H = 570;
const COL_W = CAT_W / 2; // 220
const ROW_H = 50;
const ROW_GAP = 4;
const GRID_ROWS = 7;
const STAGE_TOP = TOP_Y + 10 + GRID_ROWS * (ROW_H + ROW_GAP); // ~500

export class ShipCatalogPanel extends Phaser.Events.EventEmitter {
  private container!: Phaser.GameObjects.Container;
  private selectedShipId: string | null = null;
  private selectedLoadoutId: string | null = null;
  private readonly tooltip: ShipTooltip;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly ships: ShipDefinition[],
    private readonly factionId: FactionId,
  ) {
    super();
    this.tooltip = new ShipTooltip(scene);
  }

  render(): void {
    this.container?.destroy();
    this.container = this.scene.add.container(0, 0);
    this.drawBackground();
    this.drawGrid();
    this.drawStagingArea();
  }

  destroy(): void {
    this.tooltip.destroy();
    this.container?.destroy();
    super.destroy();
  }

  private drawBackground(): void {
    const fCol = FACTION_COLORS[this.factionId];
    const g = this.scene.add.graphics();
    g.fillStyle(0x0d1525, 1);
    g.fillRoundedRect(CAT_X, TOP_Y, CAT_W, PANEL_H, 10);
    g.lineStyle(2, fCol, 0.7);
    g.strokeRoundedRect(CAT_X, TOP_Y, CAT_W, PANEL_H, 10);
    this.container.add(g);
  }

  private drawGrid(): void {
    const sorted = [...this.ships].sort(
      (a, b) => (ROLE_SORT[a.role] ?? 9) - (ROLE_SORT[b.role] ?? 9),
    );
    sorted.forEach((def, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = CAT_X + 4 + col * COL_W;
      const y = TOP_Y + 10 + row * (ROW_H + ROW_GAP);
      if (y + ROW_H < STAGE_TOP - 4) this.drawShipRow(def, x, y);
    });
  }

  private drawShipRow(def: ShipDefinition, x: number, y: number): void {
    const isSel = this.selectedShipId === def.id;
    const bg = this.scene.add.graphics();
    bg.fillStyle(isSel ? 0x0e2618 : 0x111a28, 1);
    bg.fillRoundedRect(x, y, COL_W - 8, ROW_H, 5);
    bg.lineStyle(1, isSel ? 0x44ff88 : 0x223040, 1);
    bg.strokeRoundedRect(x, y, COL_W - 8, ROW_H, 5);

    // Use real sprite if loaded; fall back to faction+size placeholder
    const spriteKey = this.scene.textures.exists(def.spriteKey)
      ? def.spriteKey
      : `ship_${def.faction}_${def.baseStats.size}`;
    const sprite = this.scene.add
      .image(x + 18, y + ROW_H / 2, spriteKey)
      .setDisplaySize(32, 32);
    const nameT = this.scene.add.text(x + 38, y + 6, def.name, {
      font: `bold 12px Arial`,
      color: isSel ? "#88ffcc" : "#d8ecff",
    });
    const ptsT = this.scene.add
      .text(x + COL_W - 12, y + 6, `${def.baseStats.pointCost}pt`, {
        font: "11px Arial",
        color: isSel ? "#aaddaa" : "#88aa66",
      })
      .setOrigin(1, 0);
    const roleT = this.scene.add.text(
      x + 38,
      y + 24,
      def.role.replace(/_/g, " "),
      { font: "10px Arial", color: isSel ? "#55cc88" : "#5a8060" },
    );

    const tags = secondaryTags(def);
    const tagObjs: Phaser.GameObjects.Text[] = [];
    let tagX = x + 38 + 72; // role text max ~70px
    for (const tag of tags) {
      const tObj = this.scene.add.text(tagX, y + 24, tag, {
        font: "8px Arial",
        color: "#446688",
        backgroundColor: "#0a1520",
        padding: { x: 3, y: 1 },
      });
      tagObjs.push(tObj);
      tagX += (tObj.width ?? 40) + 4;
    }

    const hit = this.scene.add
      .rectangle(x + (COL_W - 8) / 2, y + ROW_H / 2, COL_W - 8, ROW_H, 0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => {
      this.selectedShipId = def.id;
      this.selectedLoadoutId = null;
      this.render();
    });
    hit.on("pointerover", () => {
      const selLd = getShipLoadouts(def.id).find(
        (l) => l.id === this.selectedLoadoutId,
      );
      const b = computeLoadoutBonuses(selLd?.upgrades ?? []);
      this.tooltip.show(def, CAT_X + CAT_W + 8, y, b);
    });
    hit.on("pointerout", () => {
      this.tooltip.hide();
    });
    this.container.add([bg, sprite, nameT, ptsT, roleT, ...tagObjs, hit]);
  }

  private drawStagingArea(): void {
    const stageH = PANEL_H - (STAGE_TOP - TOP_Y) - 8;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x090e18, 1);
    bg.fillRoundedRect(CAT_X + 4, STAGE_TOP, CAT_W - 8, stageH, 6);
    bg.lineStyle(1, 0x1e2d40, 1);
    bg.strokeRoundedRect(CAT_X + 4, STAGE_TOP, CAT_W - 8, stageH, 6);
    this.container.add(bg);

    if (!this.selectedShipId) {
      this.container.add(
        this.scene.add
          .text(
            CAT_X + CAT_W / 2,
            STAGE_TOP + stageH / 2,
            "Click a ship above to select it",
            { font: "13px Arial", color: "#3a5566" },
          )
          .setOrigin(0.5),
      );
      return;
    }

    const def = this.ships.find((s) => s.id === this.selectedShipId);
    if (!def) return;
    this.container.add(
      this.scene.add.text(CAT_X + 10, STAGE_TOP + 6, def.name, {
        font: "bold 14px Arial",
        color: "#88ffcc",
      }),
    );
    this.container.add(
      this.scene.add
        .text(
          CAT_X + CAT_W - 10,
          STAGE_TOP + 6,
          def.baseStats.size.toUpperCase(),
          { font: "11px Arial", color: "#5588aa" },
        )
        .setOrigin(1, 0),
    );
    this.drawLoadoutOptions(def, STAGE_TOP + 26);
    this.drawAddButton(def, STAGE_TOP + stageH - 36);
  }

  private drawLoadoutOptions(def: ShipDefinition, y: number): void {
    const loadouts = getShipLoadouts(def.id);
    const btnW = 66;
    const gap = 4;
    const baseActive = this.selectedLoadoutId === null;
    this.container.add(
      this.makeLoadoutBtn(CAT_X + 8, y, btnW, "Base", baseActive, () => {
        this.selectedLoadoutId = null;
        this.render();
      }),
    );
    loadouts.slice(0, 4).forEach((ld, i) => {
      const isActive = this.selectedLoadoutId === ld.id;
      const label = ld.name.length > 9 ? `${ld.name.slice(0, 8)}…` : ld.name;
      this.container.add(
        this.makeLoadoutBtn(
          CAT_X + 8 + (btnW + gap) * (i + 1),
          y,
          btnW,
          label,
          isActive,
          () => {
            this.selectedLoadoutId = ld.id;
            this.render();
          },
        ),
      );
    });

    const selLd = loadouts.find((l) => l.id === this.selectedLoadoutId);
    const bonuses = computeLoadoutBonuses(selLd?.upgrades ?? []);
    const statLine = buildStatLine(
      bonuses,
      selLd?.pointCost ?? def.baseStats.pointCost,
    );
    this.container.add(
      this.scene.add.text(CAT_X + 8, y + 24, statLine, {
        font: "bold 11px Arial",
        color: selLd ? "#88cc55" : "#6688aa",
      }),
    );

    // Full description — no truncation, word-wrapped to panel width
    const description = selLd?.description ?? def.description;
    this.container.add(
      this.scene.add.text(CAT_X + 8, y + 40, description, {
        font: "11px Arial",
        color: "#7090a8",
        wordWrap: { width: CAT_W - 20 },
      }),
    );

    this.drawUsageTips(bonuses, y + 66);
  }

  private drawUsageTips(bonuses: LoadoutBonuses, y: number): void {
    const lines: Array<{ text: string; color: string }> = [];
    if (bonuses.actions.length > 0) {
      lines.push({
        text: `+ Abilities: ${bonuses.actions.join(", ")} — activate in battle`,
        color: "#558844",
      });
    }
    if (bonuses.rerolls > 0) {
      lines.push({
        text: `+ Hit bonus: +${bonuses.rerolls * 5}% accuracy`,
        color: "#ffcc66",
      });
    }
    if (bonuses.charges > 0) {
      lines.push({
        text: `+ ${bonuses.charges} charge${bonuses.charges > 1 ? "s" : ""} — spend when firing ordnance or activating an ability`,
        color: "#cc88ff",
      });
    }
    lines.forEach((line, i) => {
      this.container.add(
        this.scene.add.text(CAT_X + 8, y + i * 15, line.text, {
          font: "10px Arial",
          color: line.color,
          wordWrap: { width: CAT_W - 20 },
        }),
      );
    });
  }

  private makeLoadoutBtn(
    x: number,
    y: number,
    w: number,
    label: string,
    active: boolean,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const h = 20;
    const c = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();
    bg.fillStyle(active ? 0x1a3322 : 0x131c28, 1);
    bg.fillRoundedRect(0, 0, w, h, 3);
    bg.lineStyle(1, active ? 0x44ff88 : 0x253545, 1);
    bg.strokeRoundedRect(0, 0, w, h, 3);
    c.add([
      bg,
      this.scene.add
        .text(w / 2, h / 2, label, {
          font: `${active ? "bold " : ""}11px Arial`,
          color: active ? "#88ffcc" : "#5577aa",
        })
        .setOrigin(0.5),
    ]);
    c.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    c.on("pointerdown", onClick);
    return c;
  }

  private drawAddButton(def: ShipDefinition, y: number): void {
    const w = CAT_W - 16;
    const h = 28;
    const c = this.scene.add.container(CAT_X + 8, y);
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a3322, 1);
    bg.fillRoundedRect(0, 0, w, h, 5);
    bg.lineStyle(2, 0x44ff88, 1);
    bg.strokeRoundedRect(0, 0, w, h, 5);
    const loadoutId = this.selectedLoadoutId;
    const ldLabel = loadoutId
      ? (getShipLoadouts(def.id).find((l) => l.id === loadoutId)?.name ??
        "Loadout")
      : "Base";
    c.add([
      bg,
      this.scene.add
        .text(
          w / 2,
          h / 2,
          `→  ADD  ${def.name.toUpperCase()} — ${ldLabel.toUpperCase()}`,
          { font: "bold 12px Arial", color: "#44ff88" },
        )
        .setOrigin(0.5),
    ]);
    c.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    c.on("pointerdown", () =>
      this.emit("addInstance", { shipId: def.id, loadoutId }),
    );
    this.container.add(c);
  }
}
