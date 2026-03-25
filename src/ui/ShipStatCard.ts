/**
 * ShipStatCard
 *
 * A compact hover panel showing normalized ship stats (speed, maneuverability,
 * attack, defense, payload). Created on pointerover, destroyed on pointerout.
 * Use ShipStatCard.positionNear() to anchor the card relative to a ship sprite.
 */

import Phaser from 'phaser';
import { getEncyclopediaEntry, type EncyclopediaEntry } from '../data/ShipEncyclopedia';
import { FACTION_COLORS } from '../config';
import { getShipDefinition } from '../data/ShipDefinitions';

const CARD_W = 220;
const CARD_H = 182;

const STAT_COLORS: Record<string, number> = {
  speed: 0x00ccff,
  maneuverability: 0x44ff88,
  attack: 0xff4444,
  defense: 0x4488ff,
  payload: 0xff8800,
};

const ROLE_COLORS: Record<string, number> = {
  light_fighter: 0x888888,
  heavy_fighter: 0x4488cc,
  interceptor: 0x44ccaa,
  bomber: 0xcc6644,
  support: 0x88cc44,
  gunship: 0xcc4488,
  capital: 0xddaa00,
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
  constructor(scene: Phaser.Scene, x: number, y: number, entry: EncyclopediaEntry) {
    super(scene, x, y);

    const def = getShipDefinition(entry.shipId);
    const factionColor = def ? FACTION_COLORS[def.faction] : 0x444466;
    const roleColor = def ? (ROLE_COLORS[def.role] ?? 0x888888) : 0x888888;

    this.add(this.buildPanel(scene, factionColor));
    this.add(this.buildNameRow(scene, def?.name ?? entry.shipId));
    this.add(this.buildRoleBadge(scene, def?.role ?? '', roleColor));
    this.add(this.buildDivider(scene));
    this.addStatBars(scene, entry);
    this.setDepth(1000);
  }

  private buildPanel(scene: Phaser.Scene, factionColor: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(0x06080f, 0.96);
    g.fillRoundedRect(0, 0, CARD_W, CARD_H, 7);
    g.lineStyle(2, factionColor, 1);
    g.strokeRoundedRect(0, 0, CARD_W, CARD_H, 7);
    return g;
  }

  private buildNameRow(scene: Phaser.Scene, name: string): Phaser.GameObjects.Text {
    const display = name.length > 23 ? name.slice(0, 22) + '…' : name;
    return scene.add.text(10, 8, display, { font: 'bold 13px Arial', color: '#ffffff' });
  }

  private buildRoleBadge(scene: Phaser.Scene, role: string, color: number): Phaser.GameObjects.Container {
    const badge = scene.add.container(10, 26);
    const bg = scene.add.graphics();
    bg.fillStyle(color, 0.9);
    bg.fillRoundedRect(0, 0, 86, 16, 4);
    badge.add(bg);
    const label = scene.add
      .text(43, 8, role.replace(/_/g, ' ').toUpperCase(), { font: '9px Arial', color: '#ffffff' })
      .setOrigin(0.5);
    badge.add(label);
    return badge;
  }

  private buildDivider(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.lineStyle(1, 0x222244, 1);
    g.lineBetween(8, 48, CARD_W - 8, 48);
    return g;
  }

  private addStatBars(scene: Phaser.Scene, entry: EncyclopediaEntry): void {
    const stats: Array<[string, number]> = [
      ['speed', entry.stats.speed],
      ['maneuverability', entry.stats.maneuverability],
      ['attack', entry.stats.attack],
      ['defense', entry.stats.defense],
      ['payload', entry.stats.payload],
    ];
    const barX = 44;
    const barW = 126;

    stats.forEach(([key, val], i) => {
      const y = 56 + i * 24;
      const color = STAT_COLORS[key] ?? 0x888888;

      this.add(
        scene.add.text(8, y, key.slice(0, 3).toUpperCase(), { font: '10px Arial', color: '#9999bb' }),
      );

      const track = scene.add.graphics();
      track.fillStyle(0x1a1a33, 1);
      track.fillRoundedRect(barX, y + 1, barW, 13, 3);
      this.add(track);

      const fillW = Math.max(5, Math.round((val / entry.stats.maxStat) * barW));
      const fill = scene.add.graphics();
      fill.fillStyle(color, 1);
      fill.fillRoundedRect(barX, y + 1, fillW, 13, 3);
      this.add(fill);

      this.add(
        scene.add.text(barX + barW + 5, y, String(val), { font: 'bold 10px Arial', color: '#ffffff' }),
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
  static positionNear(card: ShipStatCard, tx: number, ty: number, sceneW: number, sceneH: number): void {
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
    container.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      card?.destroy();
      card = new ShipStatCard(scene, 0, 0, entry);
      card.setScrollFactor(0);
      scene.add.existing(card);
      ShipStatCard.positionNear(card, pointer.x, pointer.y, scene.scale.width, scene.scale.height);
    });
    container.on('pointerout', () => {
      card?.destroy();
      card = null;
    });
  }
}
