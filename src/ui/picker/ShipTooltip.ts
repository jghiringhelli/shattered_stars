/**
 * ShipTooltip — hover card with encyclopedia art, full stats, action bar,
 * and optional loadout modification highlights.
 * Rendered at depth 200 so it floats above all other panels.
 */

import Phaser from "phaser";
import type { ShipDefinition } from "../../core/types";
import { FACTION_COLORS } from "../../config";
import { getEncyclopediaEntry } from "../../data/ShipEncyclopedia";
import { ACTION_DEFINITIONS } from "../../systems/ActionsSystem";
import type { LoadoutBonuses } from "./types";

const TIP_W = 280;

const STAT_DEFS = [
  { key: "attack", label: "ATK", color: 0xff6655 },
  { key: "agility", label: "AGI", color: 0x44ffaa },
  { key: "hull", label: "HUL", color: 0x66ccff },
  { key: "shields", label: "SHD", color: 0x4488ff },
] as const;

export class ShipTooltip {
  private container: Phaser.GameObjects.Container | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * Show tooltip anchored at (anchorX, anchorY).
   * Pass loadoutBonuses when a loadout is selected to highlight stat changes.
   */
  show(
    def: ShipDefinition,
    anchorX: number,
    anchorY: number,
    bonuses?: LoadoutBonuses,
  ): void {
    this.hide();
    const actions = def.baseStats.actions ?? [];
    const tipH = 100 + 60 + 40 + actions.length * 20 + 16;
    const sh = this.scene.scale.height;
    const sw = this.scene.scale.width;
    const x = Math.min(anchorX, sw - TIP_W - 8);
    const y = Math.max(8, Math.min(anchorY - tipH / 2, sh - tipH - 8));
    this.container = this.scene.add.container(x, y).setDepth(200);
    this.drawCard(def, bonuses, tipH);
  }

  hide(): void {
    this.container?.destroy();
    this.container = null;
  }
  destroy(): void {
    this.hide();
  }

  private drawCard(
    def: ShipDefinition,
    bonuses: LoadoutBonuses | undefined,
    tipH: number,
  ): void {
    const c = this.container!;
    const fCol =
      FACTION_COLORS[def.faction as keyof typeof FACTION_COLORS] ?? 0x334455;
    const hexCol = `#${fCol.toString(16).padStart(6, "0")}`;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x060c18, 0.98);
    bg.fillRoundedRect(0, 0, TIP_W, tipH, 8);
    bg.lineStyle(2, fCol, 0.9);
    bg.strokeRoundedRect(0, 0, TIP_W, tipH, 8);
    c.add(bg);

    // Encyclopedia art (landscape 768×512 → fits as 260×87)
    const artKey = `ship_art_${def.id}`;
    const imgKey = this.scene.textures.exists(artKey) ? artKey : def.spriteKey;
    const imgH = this.scene.textures.exists(artKey) ? 87 : 96;
    const img = this.scene.add
      .image(TIP_W / 2, imgH / 2 + 4, imgKey)
      .setDisplaySize(TIP_W - 8, imgH);
    c.add(img);

    let y = imgH + 10;
    c.add(
      this.scene.add
        .text(TIP_W / 2, y, def.name, {
          font: "bold 15px Arial",
          color: "#eef6ff",
        })
        .setOrigin(0.5, 0),
    );
    y += 18;
    const badge = `${def.role.replace(/_/g, " ").toUpperCase()}  ·  ${def.baseStats.size.toUpperCase()}`;
    c.add(
      this.scene.add
        .text(TIP_W / 2, y, badge, { font: "11px Arial", color: hexCol })
        .setOrigin(0.5, 0),
    );
    y += 16;

    y = this.drawStats(def, bonuses, c, y) + 6;
    y = this.drawActions(def, c, y) + 8;

    const entry = getEncyclopediaEntry(def.id);
    const desc = entry?.lore ?? def.description;
    c.add(
      this.scene.add.text(10, y, desc, {
        font: "11px Arial",
        color: "#8ab0cc",
        wordWrap: { width: TIP_W - 20 },
      }),
    );
  }

  private drawStats(
    def: ShipDefinition,
    bonuses: LoadoutBonuses | undefined,
    c: Phaser.GameObjects.Container,
    y: number,
  ): number {
    const colW = (TIP_W - 16) / STAT_DEFS.length;
    const bonusMap: Record<string, number> = {
      attack: bonuses?.atk ?? 0,
      agility: bonuses?.agi ?? 0,
      hull: bonuses?.hull ?? 0,
      shields: bonuses?.shld ?? 0,
    };
    STAT_DEFS.forEach((s, i) => {
      const sx = 8 + i * colW;
      const base = def.baseStats[s.key as keyof typeof def.baseStats] as number;
      const delta = bonusMap[s.key] ?? 0;
      const total = base + delta;
      const hexCol = `#${s.color.toString(16).padStart(6, "0")}`;
      const g = this.scene.add.graphics();
      g.fillStyle(s.color, 0.12);
      g.fillRect(sx, y + 14, colW - 4, 13);
      g.fillStyle(s.color, 0.7);
      g.fillRect(sx, y + 14, Math.max(4, (total / 8) * (colW - 4)), 13);
      c.add(g);
      c.add(
        this.scene.add
          .text(sx + (colW - 4) / 2, y, s.label, {
            font: "bold 10px Arial",
            color: hexCol,
          })
          .setOrigin(0.5, 0),
      );
      const valLabel = delta !== 0 ? `${total} (+${delta})` : String(total);
      const valColor = delta > 0 ? "#88ffcc" : "#ffffff";
      c.add(
        this.scene.add
          .text(sx + (colW - 4) / 2, y + 15, valLabel, {
            font: "bold 12px Arial",
            color: valColor,
          })
          .setOrigin(0.5, 0),
      );
    });
    return y + 36;
  }

  private drawActions(
    def: ShipDefinition,
    c: Phaser.GameObjects.Container,
    y: number,
  ): number {
    const actions = def.baseStats.actions ?? [];
    if (actions.length === 0) return y;
    c.add(
      this.scene.add.text(10, y, "ACTIONS", {
        font: "bold 10px Arial",
        color: "#3a5a7a",
      }),
    );
    y += 14;
    for (const actionKey of actions) {
      const actionDef =
        ACTION_DEFINITIONS[actionKey as keyof typeof ACTION_DEFINITIONS];
      const label = actionKey.replace(/_/g, " ");
      const desc = actionDef?.description ?? "";
      c.add(
        this.scene.add.text(10, y, `◆ ${label}`, {
          font: "bold 11px Arial",
          color: "#66bbee",
        }),
      );
      c.add(
        this.scene.add.text(10, y + 12, desc, {
          font: "10px Arial",
          color: "#5a7a8a",
        }),
      );
      y += 24;
    }
    return y;
  }
}
