/**
 * EncyclopediaDetailPanel
 *
 * The right-side panel in EncyclopediaScene. Shows cinematic ship art,
 * lore text, role badge, and five normalized stat bars for the selected ship.
 */

import Phaser from "phaser";
import type { EncyclopediaEntry } from "../data/ShipEncyclopedia";
import { getShipDefinition } from "../data/ShipDefinitions";
import { FACTION_COLORS } from "../config";
import { addContainedImage } from "./picker/catalogHelpers";

const ART_H = 280;

const STAT_META: Array<{ key: string; label: string; color: number }> = [
  { key: "speed", label: "SPEED", color: 0x00ccff },
  { key: "maneuverability", label: "MANEUVER", color: 0x44ff88 },
  { key: "attack", label: "ATTACK", color: 0xff4444 },
  { key: "defense", label: "DEFENSE", color: 0x4488ff },
  { key: "payload", label: "PAYLOAD", color: 0xff8800 },
];

const ROLE_COLORS: Record<string, number> = {
  light_fighter: 0x888888,
  heavy_fighter: 0x4488cc,
  interceptor: 0x44ccaa,
  bomber: 0xcc6644,
  support: 0x88cc44,
  gunship: 0xcc4488,
  capital: 0xddaa00,
};

export class EncyclopediaDetailPanel {
  private readonly scene: Phaser.Scene;
  private readonly x: number;
  private readonly y: number;
  private readonly w: number;
  private readonly barX: number;
  private readonly barW: number;
  private readonly barYs: number[] = [];

  private artPlaceholder!: Phaser.GameObjects.Graphics;
  private artPlaceholderLabel!: Phaser.GameObjects.Text;
  private artImage: Phaser.GameObjects.Image | null = null;
  private nameText!: Phaser.GameObjects.Text;
  private roleBadge!: Phaser.GameObjects.Graphics;
  private roleText!: Phaser.GameObjects.Text;
  private loreText!: Phaser.GameObjects.Text;
  private statFills: Phaser.GameObjects.Graphics[] = [];
  private statNums: Phaser.GameObjects.Text[] = [];
  private scaleNote!: Phaser.GameObjects.Text;

  /**
   * @param scene - Owning scene.
   * @param x - Left edge of the panel in world coordinates.
   * @param y - Top edge of the panel in world coordinates.
   * @param width - Panel width in pixels.
   */
  constructor(scene: Phaser.Scene, x: number, y: number, width: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.w = width;
    this.barX = x + 110;
    this.barW = Math.floor(width * 0.55);
    this.buildLayout();
  }

  private buildLayout(): void {
    const { scene, x, y, w } = this;

    // Art placeholder (shown until real art is loaded)
    this.artPlaceholder = scene.add.graphics();
    this.artPlaceholder.fillStyle(0x0d1525, 1);
    this.artPlaceholder.fillRect(x, y, w, ART_H);
    this.artPlaceholderLabel = scene.add
      .text(x + w / 2, y + ART_H / 2, "", {
        font: "13px Arial",
        color: "#445566",
      })
      .setOrigin(0.5);

    // Name
    const textY = y + ART_H + 16;
    this.nameText = scene.add
      .text(x + w / 2, textY, "", {
        font: "bold 28px Arial",
        color: "#ddeeff",
      })
      .setOrigin(0.5, 0);

    // Role badge
    const badgeY = textY + 42;
    this.roleBadge = scene.add.graphics();
    this.roleText = scene.add
      .text(x + w / 2, badgeY + 11, "", {
        font: "12px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Lore
    this.loreText = scene.add.text(x + 20, badgeY + 34, "", {
      font: "15px Arial",
      color: "#8899bb",
      wordWrap: { width: w - 40 },
      lineSpacing: 4,
    });

    // Stats section
    const statsY = badgeY + 100;
    scene.add.text(x + 12, statsY - 22, "COMBAT STATS", {
      font: "bold 12px Arial",
      color: "#445566",
    });
    const divider = scene.add.graphics();
    divider.lineStyle(1, 0x1a2a44, 1);
    divider.lineBetween(x + 12, statsY - 6, x + w - 12, statsY - 6);
    this.buildStatBars(statsY);
    this.scaleNote = scene.add
      .text(x + w - 12, statsY + STAT_META.length * 30 + 4, "", {
        font: "11px Arial",
        color: "#334455",
      })
      .setOrigin(1, 0);
  }

  private buildStatBars(startY: number): void {
    const { scene, x, barX, barW } = this;

    STAT_META.forEach(({ label, color }, i) => {
      const y = startY + i * 30;
      this.barYs.push(y);

      scene.add.text(x + 12, y + 2, label, {
        font: "11px Arial",
        color: "#6677aa",
      });

      const track = scene.add.graphics();
      track.fillStyle(0x111828, 1);
      track.fillRoundedRect(barX, y, barW, 18, 5);

      const fill = scene.add.graphics();
      this.statFills.push(fill);

      this.statNums.push(
        scene.add.text(barX + barW + 10, y + 2, "", {
          font: "bold 12px Arial",
          color: "#aabbcc",
        }),
      );

      // Subtle tick marks for scale reference
      const ticks = scene.add.graphics();
      ticks.lineStyle(1, 0x1a2a44, 1);
      [1, 2, 3, 4].forEach((t) => {
        const tx = barX + Math.round((t / 5) * barW);
        ticks.lineBetween(tx, y + 2, tx, y + 16);
      });
    });
  }

  /**
   * Update the panel to display the given encyclopedia entry.
   * @param entry - The encyclopedia entry to display.
   */
  show(entry: EncyclopediaEntry): void {
    this.updateArt(entry);
    this.updateTextBlocks(entry);
    this.updateStats(entry);
  }

  private updateArt(entry: EncyclopediaEntry): void {
    const { scene, x, y, w } = this;
    this.artImage?.destroy();
    this.artImage = null;
    this.artPlaceholder.clear();
    this.artPlaceholder.fillStyle(0x0d1525, 1);
    this.artPlaceholder.fillRect(x, y, w, ART_H);

    if (scene.textures.exists(entry.artKey)) {
      this.artImage = addContainedImage(
        scene,
        entry.artKey,
        x + w / 2,
        y + ART_H / 2,
        w,
        ART_H,
      );
      this.artPlaceholderLabel.setText("");
    } else {
      const def = getShipDefinition(entry.shipId);
      const col = def ? FACTION_COLORS[def.faction] : 0x222244;
      this.artPlaceholder.lineStyle(1, col, 0.4);
      this.artPlaceholder.strokeRect(x + 1, y + 1, w - 2, ART_H - 2);
      this.artPlaceholderLabel.setText(
        "[ Art not generated — run scripts/generate_ship_art.py ]",
      );
    }
  }

  private updateTextBlocks(entry: EncyclopediaEntry): void {
    const { x, y, w } = this;
    const def = getShipDefinition(entry.shipId);
    this.nameText.setText(def?.name ?? entry.shipId);

    const role = def?.role ?? "";
    const roleLabel = role.replace(/_/g, " ").toUpperCase();
    const roleColor = ROLE_COLORS[role] ?? 0x888888;
    const lw = roleLabel.length * 8 + 24;
    const badgeY = y + ART_H + 16 + 42;
    this.roleBadge.clear();
    this.roleBadge.fillStyle(roleColor, 0.85);
    this.roleBadge.fillRoundedRect(x + w / 2 - lw / 2, badgeY, lw, 22, 6);
    this.roleText.setText(roleLabel);

    this.loreText.setText(entry.lore);
  }

  private updateStats(entry: EncyclopediaEntry): void {
    const vals = [
      entry.stats.speed,
      entry.stats.maneuverability,
      entry.stats.attack,
      entry.stats.defense,
      entry.stats.payload,
    ];
    vals.forEach((val, i) => {
      const color = STAT_META[i]!.color;
      const barY = this.barYs[i]!;
      const fillW = Math.max(
        6,
        Math.round((val / entry.stats.maxStat) * this.barW),
      );
      this.statFills[i]!.clear();
      this.statFills[i]!.fillStyle(color, 1);
      this.statFills[i]!.fillRoundedRect(this.barX, barY, fillW, 18, 5);
      this.statNums[i]!.setText(`${val} / ${entry.stats.maxStat}`);
    });
    this.scaleNote.setText(
      entry.stats.maxStat === 10
        ? "★ Capital scale (1-10)"
        : "Standard scale (1-5)",
    );
  }
}
