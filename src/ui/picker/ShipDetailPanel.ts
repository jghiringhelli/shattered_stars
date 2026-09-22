/**
 * ShipDetailPanel — big persistent panel to the right of the ship list.
 * Shows the selected ship's full art (aspect-ratio preserved), stats,
 * actions, description, and the loadout submenu (Base + up to a few
 * payload options) with each loadout's playstyle/usage tips — replacing
 * the old small hover tooltip and the cramped bottom loadout strip.
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import { FACTION_COLORS } from "../../config";
import { getEncyclopediaEntry } from "../../data/ShipEncyclopedia";
import {
  getShipLoadouts,
  getEquippableLoadouts,
} from "../../data/ShipLoadouts";
import { getLoadoutPlaystyle } from "../../data/ShipRoleProfiles";
import { ACTION_DEFINITIONS } from "../../systems/ActionsSystem";
import { punch } from "../UIJuice";
import {
  addContainedImage,
  computeLoadoutBonuses,
  buildStatLine,
} from "./catalogHelpers";
import type { LoadoutBonuses } from "./types";

const STAT_DEFS = [
  { key: "attack", label: "ATTACK", color: 0xff6655 },
  { key: "agility", label: "AGILITY", color: 0x44ffaa },
  { key: "hull", label: "HULL", color: 0x66ccff },
  { key: "shields", label: "SHIELDS", color: 0x4488ff },
] as const;

const ART_H = 150;
const LOADOUT_BTN_W = 150;
const LOADOUT_BTN_H = 40;
const LOADOUT_BTN_GAP = 8;
const LOADOUTS_PER_PAGE = 3;

/** Read-only view of the ship/loadout currently staged, owned by CatalogStaging. */
export interface StagingSelection {
  getSelectedShipId(): string | null;
  getSelectedLoadoutId(): string | null;
  selectLoadout(loadoutId: string | null): void;
}

export class ShipDetailPanel {
  private container: Phaser.GameObjects.Container | null = null;
  private loadoutPage = 0;
  private lastArgs: {
    ships: readonly ShipDefinition[];
    staging: StagingSelection;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Renders the panel for the ship currently selected in `staging`, or an empty prompt. */
  render(
    ships: readonly ShipDefinition[],
    staging: StagingSelection,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    this.lastArgs = { ships, staging, x, y, w, h };
    this.container?.destroy();
    this.container = this.scene.add.container(0, 0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0d1525, 0.96);
    bg.fillRoundedRect(x, y, w, h, 10);
    this.container.add(bg);

    const shipId = staging.getSelectedShipId();
    const def = ships.find((s) => s.id === shipId);
    if (!def) {
      bg.lineStyle(2, 0x223040, 0.8);
      bg.strokeRoundedRect(x, y, w, h, 10);
      this.container.add(
        this.scene.add
          .text(
            x + w / 2,
            y + h / 2,
            "Select a ship to see its stats and payloads",
            {
              font: "15px Arial",
              color: "#3a5566",
              wordWrap: { width: w - 60 },
              align: "center",
            },
          )
          .setOrigin(0.5),
      );
      return;
    }

    const fCol =
      FACTION_COLORS[def.faction as keyof typeof FACTION_COLORS] ?? 0x334455;
    bg.lineStyle(2, fCol, 0.9);
    bg.strokeRoundedRect(x, y, w, h, 10);

    let cy = y + 12;
    cy = this.drawArtAndHeader(def, x, cy, w) + 8;
    cy = this.drawStats(def, staging, x, cy, w) + 8;
    cy = this.drawActions(def, x, cy, w) + 6;
    cy = this.drawDescription(def, x, cy, w) + 8;
    this.drawLoadoutSection(def, staging, x, cy, w);
  }

  destroy(): void {
    this.container?.destroy();
    this.container = null;
    this.lastArgs = null;
  }

  /** Re-renders using the args from the last render() call — used after a loadout click. */
  private rerender(): void {
    if (!this.lastArgs) return;
    const { ships, staging, x, y, w, h } = this.lastArgs;
    this.render(ships, staging, x, y, w, h);
  }

  private drawArtAndHeader(
    def: ShipDefinition,
    x: number,
    y: number,
    w: number,
  ): number {
    const c = this.container!;
    const artKey = `ship_art_${def.id}`;
    const imgKey = this.scene.textures.exists(artKey) ? artKey : def.spriteKey;
    c.add(
      addContainedImage(
        this.scene,
        imgKey,
        x + w / 2,
        y + ART_H / 2,
        w - 32,
        ART_H,
      ),
    );

    let cy = y + ART_H + 6;
    c.add(
      this.scene.add
        .text(x + w / 2, cy, def.name, {
          font: "bold 20px Arial",
          color: "#eef6ff",
        })
        .setOrigin(0.5, 0),
    );
    cy += 24;
    const fCol =
      FACTION_COLORS[def.faction as keyof typeof FACTION_COLORS] ?? 0x334455;
    const hexCol = `#${fCol.toString(16).padStart(6, "0")}`;
    const badge = `${def.role.replace(/_/g, " ").toUpperCase()}  \u00b7  ${def.baseStats.size.toUpperCase()}  \u00b7  ${def.baseStats.pointCost}pt`;
    c.add(
      this.scene.add
        .text(x + w / 2, cy, badge, { font: "13px Arial", color: hexCol })
        .setOrigin(0.5, 0),
    );
    return cy + 14;
  }

  private drawStats(
    def: ShipDefinition,
    staging: StagingSelection,
    x: number,
    y: number,
    w: number,
  ): number {
    const c = this.container!;
    const selLd = getShipLoadouts(def.id).find(
      (l) => l.id === staging.getSelectedLoadoutId(),
    );
    const bonuses = computeLoadoutBonuses(selLd?.upgrades ?? []);
    const bonusMap: Record<string, number> = {
      attack: bonuses.atk,
      agility: bonuses.agi,
      hull: bonuses.hull,
      shields: bonuses.shld,
    };
    const colW = (w - 32) / STAT_DEFS.length;
    STAT_DEFS.forEach((s, i) => {
      const sx = x + 16 + i * colW;
      const base = def.baseStats[s.key as keyof typeof def.baseStats] as number;
      const delta = bonusMap[s.key] ?? 0;
      const total = base + delta;
      const hexCol = `#${s.color.toString(16).padStart(6, "0")}`;
      c.add(
        this.scene.add
          .text(sx + (colW - 8) / 2, y, s.label, {
            font: "bold 11px Arial",
            color: hexCol,
          })
          .setOrigin(0.5, 0),
      );
      const g = this.scene.add.graphics();
      g.fillStyle(s.color, 0.15);
      g.fillRect(sx, y + 16, colW - 8, 18);
      g.fillStyle(s.color, 0.75);
      g.fillRect(sx, y + 16, Math.max(6, (total / 8) * (colW - 8)), 18);
      c.add(g);
      const valLabel = delta !== 0 ? `${total} (+${delta})` : String(total);
      c.add(
        this.scene.add
          .text(sx + (colW - 8) / 2, y + 18, valLabel, {
            font: "bold 13px Arial",
            color: delta > 0 ? "#88ffcc" : "#ffffff",
          })
          .setOrigin(0.5, 0),
      );
    });
    return y + 40;
  }

  private drawActions(
    def: ShipDefinition,
    x: number,
    y: number,
    w: number,
  ): number {
    const actions = def.baseStats.actions ?? [];
    if (actions.length === 0) return y;
    const c = this.container!;
    c.add(
      this.scene.add.text(x + 16, y, "ACTIONS", {
        font: "bold 11px Arial",
        color: "#3a5a7a",
      }),
    );
    const cy = y + 14;
    const colW = (w - 32) / 2;
    const rowH = 30;
    actions.forEach((actionKey, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = x + 16 + col * colW;
      const ry = cy + row * rowH;
      const actionDef =
        ACTION_DEFINITIONS[actionKey as keyof typeof ACTION_DEFINITIONS];
      c.add(
        this.scene.add.text(cx, ry, `\u25c6 ${actionKey.replace(/_/g, " ")}`, {
          font: "bold 12px Arial",
          color: "#66bbee",
        }),
      );
      c.add(
        this.scene.add.text(cx, ry + 14, actionDef?.description ?? "", {
          font: "10px Arial",
          color: "#5a7a8a",
          wordWrap: { width: colW - 16 },
        }),
      );
    });
    const rows = Math.ceil(actions.length / 2);
    return cy + rows * rowH;
  }

  private drawDescription(
    def: ShipDefinition,
    x: number,
    y: number,
    w: number,
  ): number {
    const entry = getEncyclopediaEntry(def.id);
    const full = entry?.lore ?? def.description;
    const desc = full.length > 150 ? `${full.slice(0, 147)}…` : full;
    const t = this.scene.add.text(x + 16, y, desc, {
      font: "12px Arial",
      color: "#8ab0cc",
      wordWrap: { width: w - 32 },
    });
    this.container!.add(t);
    return y + t.height;
  }

  private drawLoadoutSection(
    def: ShipDefinition,
    staging: StagingSelection,
    x: number,
    y: number,
    w: number,
  ): void {
    const c = this.container!;
    c.add(
      this.scene.add.text(x + 16, y, "PAYLOAD", {
        font: "bold 12px Arial",
        color: "#3a5a7a",
      }),
    );
    const btnY = y + 18;
    const offered = getEquippableLoadouts(def.id);
    const maxPage = Math.max(
      0,
      Math.ceil(offered.length / LOADOUTS_PER_PAGE) - 1,
    );
    const page = Math.min(this.loadoutPage, maxPage);
    const visible = offered.slice(
      page * LOADOUTS_PER_PAGE,
      (page + 1) * LOADOUTS_PER_PAGE,
    );

    let bx = x + 16;
    c.add(
      this.makeLoadoutBtn(
        bx,
        btnY,
        "BASE",
        def.baseStats.pointCost,
        staging.getSelectedLoadoutId() === null,
        () => {
          staging.selectLoadout(null);
          this.rerender();
        },
      ),
    );
    bx += LOADOUT_BTN_W + LOADOUT_BTN_GAP;
    for (const ld of visible) {
      const active = staging.getSelectedLoadoutId() === ld.id;
      c.add(
        this.makeLoadoutBtn(
          bx,
          btnY,
          ld.name.toUpperCase(),
          ld.pointCost,
          active,
          () => {
            staging.selectLoadout(ld.id);
            this.rerender();
          },
        ),
      );
      bx += LOADOUT_BTN_W + LOADOUT_BTN_GAP;
    }
    if (maxPage > 0) {
      c.add(
        this.makePageArrow(bx, btnY, "\u25b6", page < maxPage, () => {
          this.loadoutPage = Math.min(maxPage, this.loadoutPage + 1);
          this.rerender();
        }),
      );
    }

    // Resolve against the full catalogue: a squadron preset may have selected a
    // loadout the button row above does not offer.
    const selLd = getShipLoadouts(def.id).find(
      (l) => l.id === staging.getSelectedLoadoutId(),
    );
    let cy = btnY + LOADOUT_BTN_H + 8;
    const bonuses = computeLoadoutBonuses(selLd?.upgrades ?? []);
    c.add(
      this.scene.add.text(
        x + 16,
        cy,
        buildStatLine(bonuses, selLd?.pointCost ?? def.baseStats.pointCost),
        { font: "bold 12px Arial", color: selLd ? "#88cc55" : "#6688aa" },
      ),
    );
    cy += 16;
    const description =
      selLd?.description ?? "Stock loadout \u2014 no upgrades equipped.";
    const descT = this.scene.add.text(x + 16, cy, description, {
      font: "12px Arial",
      color: "#7090a8",
      wordWrap: { width: w - 32 },
    });
    c.add(descT);
    cy += descT.height + 4;
    if (selLd) {
      const styleT = this.scene.add.text(
        x + 16,
        cy,
        getLoadoutPlaystyle(selLd.role),
        {
          font: "italic 12px Arial",
          color: "#ddaa55",
          wordWrap: { width: w - 32 },
        },
      );
      c.add(styleT);
      cy += styleT.height + 6;
    }
    this.drawUsageTips(bonuses, x, cy, w);
  }

  private drawUsageTips(
    bonuses: LoadoutBonuses,
    x: number,
    y: number,
    w: number,
  ): void {
    const tips: Array<{ text: string; color: string }> = [];
    if (bonuses.actions.length > 0)
      tips.push({
        text: `+ Abilities: ${bonuses.actions.join(", ")} \u2014 activate in battle`,
        color: "#558844",
      });
    if (bonuses.rerolls > 0)
      tips.push({
        text: `+ Hit bonus: +${bonuses.rerolls * 5}% accuracy`,
        color: "#ffcc66",
      });
    if (bonuses.charges > 0)
      tips.push({
        text: `+ ${bonuses.charges} charge${bonuses.charges > 1 ? "s" : ""} \u2014 spend when firing ordnance or activating an ability`,
        color: "#cc88ff",
      });
    tips.forEach((tip, i) => {
      this.container!.add(
        this.scene.add.text(x + 16, y + i * 16, tip.text, {
          font: "11px Arial",
          color: tip.color,
          wordWrap: { width: w - 32 },
        }),
      );
    });
  }

  private makeLoadoutBtn(
    x: number,
    y: number,
    label: string,
    pointCost: number,
    active: boolean,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();
    bg.fillStyle(active ? 0x1a3322 : 0x131c28, 1);
    bg.fillRoundedRect(0, 0, LOADOUT_BTN_W, LOADOUT_BTN_H, 5);
    bg.lineStyle(2, active ? 0x44ff88 : 0x253545, 1);
    bg.strokeRoundedRect(0, 0, LOADOUT_BTN_W, LOADOUT_BTN_H, 5);
    c.add([
      bg,
      this.scene.add
        .text(LOADOUT_BTN_W / 2, 12, label, {
          font: `${active ? "bold " : ""}12px Arial`,
          color: active ? "#88ffcc" : "#5577aa",
        })
        .setOrigin(0.5),
      this.scene.add
        .text(LOADOUT_BTN_W / 2, 27, `${pointCost}pt`, {
          font: "10px Arial",
          color: active ? "#aaddaa" : "#446688",
        })
        .setOrigin(0.5),
    ]);
    c.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, LOADOUT_BTN_W, LOADOUT_BTN_H),
      Phaser.Geom.Rectangle.Contains,
    );
    c.on("pointerdown", onClick);
    // Punch feedback on the button that just became active (including right
    // after a fresh render caused by clicking it) — a destroyed-and-rebuilt
    // container can't tween itself mid-click, so this fires on (re)creation.
    if (active) punch(this.scene, c, { scale: 1.08, durationMs: 160 });
    return c;
  }

  private makePageArrow(
    x: number,
    y: number,
    label: string,
    enabled: boolean,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    const bg = this.scene.add.graphics();
    bg.fillStyle(enabled ? 0x1a2838 : 0x0e1420, 1);
    bg.fillRoundedRect(0, 0, 20, LOADOUT_BTN_H, 4);
    c.add([
      bg,
      this.scene.add
        .text(10, LOADOUT_BTN_H / 2, label, {
          font: "bold 13px Arial",
          color: enabled ? "#5588cc" : "#223344",
        })
        .setOrigin(0.5),
    ]);
    if (enabled) {
      c.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, 20, LOADOUT_BTN_H),
        Phaser.Geom.Rectangle.Contains,
      );
      c.on("pointerdown", onClick);
    }
    return c;
  }
}
