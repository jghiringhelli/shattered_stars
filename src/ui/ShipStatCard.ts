/**
 * ShipStatCard
 *
 * A compact hover panel showing normalized ship stats (speed, maneuverability,
 * attack, defense, payload). Created on pointerover, destroyed on pointerout.
 * Use ShipStatCard.positionNear() to anchor the card relative to a ship sprite.
 *
 * Holo look: translucent panel with the ship's faction accent, outlined role
 * chip and palette-coloured gauges.
 */

import Phaser from "phaser";
import {
  getEncyclopediaEntry,
  type EncyclopediaEntry,
} from "../data/ShipEncyclopedia";
import { getShipDefinition } from "../data/ShipDefinitions";
import { drawHoloFrame, drawHoloGauge } from "./menu/holoChrome";
import { holoFont } from "./theme/holoFont";
import {
  factionAccent,
  HOLO_DEPTH,
  HOLO_PALETTE,
  HOLO_RADIUS,
} from "./theme/HoloTheme";
import { toCssColor } from "./theme/colorMath";

const CARD_W = 220;
const CARD_H = 182;
/** Inner layout of the card. */
const LAYOUT = {
  pad: 10,
  nameY: 8,
  nameMaxChars: 23,
  badgeY: 28,
  badgeW: 92,
  badgeH: 16,
  dividerY: 50,
  statsY: 58,
  statPitch: 24,
  barX: 44,
  barW: 136,
  barH: 6,
  barDy: 6,
  valueX: 188,
  nameSize: 13,
  captionSize: 12,
  fillAlpha: 0.92,
} as const;

const STAT_COLORS: Record<string, number> = {
  speed: HOLO_PALETTE.accent,
  maneuverability: HOLO_PALETTE.success,
  attack: HOLO_PALETTE.danger,
  defense: HOLO_PALETTE.shield,
  payload: HOLO_PALETTE.warning,
};

const ROLE_COLORS: Record<string, number> = {
  light_fighter: 0xb8c4cc,
  heavy_fighter: 0x7ab8e8,
  interceptor: 0x6fe0c8,
  bomber: 0xe8a07a,
  support: 0xb2e07a,
  gunship: 0xe07ab2,
  capital: 0xf0cc55,
};

export class ShipStatCard extends Phaser.GameObjects.Container {
  /**
   * Create a stat card for the given encyclopedia entry.
   *
   * @param scene - The Phaser scene this card belongs to.
   * @param x - X position of the card top-left corner.
   * @param y - Y position of the card top-left corner.
   * @param entry - Encyclopedia entry with stats to display.
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    entry: EncyclopediaEntry,
  ) {
    super(scene, x, y);

    const def = getShipDefinition(entry.shipId);
    const accent = def ? factionAccent(def.faction) : HOLO_PALETTE.border;
    const roleColor = def
      ? (ROLE_COLORS[def.role] ?? HOLO_PALETTE.textSecondary)
      : HOLO_PALETTE.textSecondary;

    this.add(this.buildPanel(scene, accent));
    this.add(this.buildNameRow(scene, def?.name ?? entry.shipId));
    this.add(this.buildRoleBadge(scene, def?.role ?? "", roleColor));
    this.add(this.buildDivider(scene));
    this.addStatBars(scene, entry);
    this.setDepth(HOLO_DEPTH.hud);
  }

  private buildPanel(
    scene: Phaser.Scene,
    accent: number,
  ): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    drawHoloFrame(
      g,
      { x: 0, y: 0, width: CARD_W, height: CARD_H },
      {
        accent,
        fillAlpha: LAYOUT.fillAlpha,
        borderAlpha: 1,
        cornerTicks: true,
      },
    );
    return g;
  }

  private buildNameRow(
    scene: Phaser.Scene,
    name: string,
  ): Phaser.GameObjects.Text {
    const display =
      name.length > LAYOUT.nameMaxChars
        ? name.slice(0, LAYOUT.nameMaxChars - 1) + "…"
        : name;
    return scene.add.text(LAYOUT.pad, LAYOUT.nameY, display, {
      ...holoFont(LAYOUT.nameSize, "600"),
      color: toCssColor(HOLO_PALETTE.textPrimary),
    });
  }

  private buildRoleBadge(
    scene: Phaser.Scene,
    role: string,
    color: number,
  ): Phaser.GameObjects.Container {
    const badge = scene.add.container(LAYOUT.pad, LAYOUT.badgeY);
    const bg = scene.add.graphics();
    drawHoloFrame(
      bg,
      { x: 0, y: 0, width: LAYOUT.badgeW, height: LAYOUT.badgeH },
      {
        accent: color,
        fill: color,
        fillAlpha: 0.15,
        borderAlpha: 0.9,
        radius: HOLO_RADIUS.sm,
      },
    );
    badge.add(bg);
    const label = scene.add
      .text(
        LAYOUT.badgeW / 2,
        LAYOUT.badgeH / 2,
        role.replace(/_/g, " ").toUpperCase(),
        {
          ...holoFont(LAYOUT.captionSize - 1, "600"),
          color: toCssColor(color),
        },
      )
      .setLetterSpacing(1)
      .setOrigin(0.5);
    badge.add(label);
    return badge;
  }

  private buildDivider(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.lineStyle(1, HOLO_PALETTE.border, 0.6);
    g.lineBetween(
      LAYOUT.pad,
      LAYOUT.dividerY,
      CARD_W - LAYOUT.pad,
      LAYOUT.dividerY,
    );
    return g;
  }

  private addStatBars(scene: Phaser.Scene, entry: EncyclopediaEntry): void {
    const stats: Array<[string, number]> = [
      ["speed", entry.stats.speed],
      ["maneuverability", entry.stats.maneuverability],
      ["attack", entry.stats.attack],
      ["defense", entry.stats.defense],
      ["payload", entry.stats.payload],
    ];
    const bars = scene.add.graphics();
    this.add(bars);

    stats.forEach(([key, val], i) => {
      const y = LAYOUT.statsY + i * LAYOUT.statPitch;
      const color = STAT_COLORS[key] ?? HOLO_PALETTE.textSecondary;
      this.add(
        scene.add
          .text(LAYOUT.pad, y, key.slice(0, 3).toUpperCase(), {
            ...holoFont(LAYOUT.captionSize, "600"),
            color: toCssColor(HOLO_PALETTE.textSecondary),
          })
          .setLetterSpacing(1),
      );
      drawHoloGauge(
        bars,
        {
          x: LAYOUT.barX,
          y: y + LAYOUT.barDy,
          width: LAYOUT.barW,
          height: LAYOUT.barH,
        },
        val / entry.stats.maxStat,
        color,
      );
      this.add(
        scene.add.text(LAYOUT.valueX, y, String(val), {
          ...holoFont(LAYOUT.captionSize + 1, "600"),
          color: toCssColor(HOLO_PALETTE.textPrimary),
        }),
      );
    });
  }

  /**
   * Position a stat card near a target world coordinate, clamped to screen bounds.
   *
   * @param card - The ShipStatCard to position.
   * @param tx - Target world X (e.g. ship sprite x).
   * @param ty - Target world Y (e.g. ship sprite y).
   * @param sceneW - Scene width for right-edge clamping.
   * @param sceneH - Scene height for bottom-edge clamping.
   */
  static positionNear(
    card: ShipStatCard,
    tx: number,
    ty: number,
    sceneW: number,
    sceneH: number,
  ): void {
    const ox = tx - CARD_W / 2;
    const oy = ty < sceneH / 2 ? ty + 44 : ty - CARD_H - 44;
    card.setPosition(
      Phaser.Math.Clamp(ox, 5, sceneW - CARD_W - 5),
      Phaser.Math.Clamp(oy, 5, sceneH - CARD_H - 5),
    );
  }

  /**
   * Attach a hover stat card to a ship container in any battle scene.
   * The card appears at the pointer position on pointerover and is destroyed on pointerout.
   * The container must already have setInteractive() called before this.
   *
   * @param scene - Owning scene (used to add the card as a child object).
   * @param container - Interactive container to attach hover events to.
   * @param shipDefinitionId - Ship definition ID used to look up encyclopedia data.
   */
  static attachHoverCard(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    shipDefinitionId: string,
  ): void {
    const entry = getEncyclopediaEntry(shipDefinitionId);
    let card: ShipStatCard | null = null;
    container.on("pointerover", (pointer: Phaser.Input.Pointer) => {
      card?.destroy();
      card = new ShipStatCard(scene, 0, 0, entry);
      card.setScrollFactor(0);
      scene.add.existing(card);
      ShipStatCard.positionNear(
        card,
        pointer.x,
        pointer.y,
        scene.scale.width,
        scene.scale.height,
      );
    });
    container.on("pointerout", () => {
      card?.destroy();
      card = null;
    });
  }
}
