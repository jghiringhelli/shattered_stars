/**
 * Minimap Component
 * Shows ship positions in a small overview
 */

import Phaser from 'phaser';
import type { FactionId } from '../config';
import { FACTION_COLORS, BATTLEFIELD_SIZE } from '../config';

export interface MinimapShip {
  id: string;
  x: number;
  y: number;
  faction: FactionId;
  isPlayer: boolean;
  isAlive: boolean;
}

export interface MinimapConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export class Minimap extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics;
  private shipDots: Phaser.GameObjects.Graphics;
  private viewRect: Phaser.GameObjects.Graphics;
  private border: Phaser.GameObjects.Graphics;

  private mapWidth: number;
  private mapHeight: number;
  private mapScale: number;

  constructor(config: MinimapConfig) {
    super(config.scene, config.x, config.y);

    this.mapWidth = config.width ?? 150;
    this.mapHeight = config.height ?? 150;
    this.mapScale = this.mapWidth / BATTLEFIELD_SIZE;

    // Background
    this.background = config.scene.add.graphics();
    this.background.fillStyle(0x000000, 0.7);
    this.background.fillRect(0, 0, this.mapWidth, this.mapHeight);
    this.add(this.background);

    // Ship dots layer
    this.shipDots = config.scene.add.graphics();
    this.add(this.shipDots);

    // Camera view rectangle
    this.viewRect = config.scene.add.graphics();
    this.add(this.viewRect);

    // Border
    this.border = config.scene.add.graphics();
    this.border.lineStyle(2, 0x444444, 1);
    this.border.strokeRect(0, 0, this.mapWidth, this.mapHeight);
    this.add(this.border);

    // Make it interactive for camera panning
    const hitArea = new Phaser.Geom.Rectangle(0, 0, this.mapWidth, this.mapHeight);
    this.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    this.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.handleClick(pointer);
    });

    config.scene.add.existing(this);
    this.setScrollFactor(0);
    this.setDepth(99);
  }

  private handleClick(pointer: Phaser.Input.Pointer): void {
    // Convert click position to world coordinates
    const localX = pointer.x - this.x;
    const localY = pointer.y - this.y;

    const worldX = localX / this.mapScale;
    const worldY = localY / this.mapScale;

    // Center camera on clicked position
    this.scene.cameras.main.centerOn(worldX, worldY);
  }

  updateShips(ships: MinimapShip[]): void {
    this.shipDots.clear();

    for (const ship of ships) {
      if (!ship.isAlive) continue;

      const mapX = ship.x * this.mapScale;
      const mapY = ship.y * this.mapScale;

      const color = FACTION_COLORS[ship.faction] ?? 0xffffff;
      const radius = ship.isPlayer ? 4 : 3;

      this.shipDots.fillStyle(color, 1);
      this.shipDots.fillCircle(mapX, mapY, radius);

      // Highlight player ship
      if (ship.isPlayer) {
        this.shipDots.lineStyle(1, 0xffffff, 0.8);
        this.shipDots.strokeCircle(mapX, mapY, radius + 2);
      }
    }
  }

  updateViewRect(): void {
    const camera = this.scene.cameras.main;

    this.viewRect.clear();
    this.viewRect.lineStyle(1, 0xffffff, 0.6);

    const rectX = (camera.scrollX * this.mapScale);
    const rectY = (camera.scrollY * this.mapScale);
    const rectW = camera.width * this.mapScale;
    const rectH = camera.height * this.mapScale;

    this.viewRect.strokeRect(rectX, rectY, rectW, rectH);
  }

  update(ships: MinimapShip[]): void {
    this.updateShips(ships);
    this.updateViewRect();
  }
}
