/**
 * Boot scene - handles asset loading and initialization
 */

import Phaser from 'phaser';
import { FACTION_COLORS, SHIP_SIZES } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Show loading progress
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(440, 320, 400, 50);

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const loadingText = this.make.text({
      x: width / 2,
      y: height / 2 - 50,
      text: 'Loading...',
      style: {
        font: '24px monospace',
        color: '#ffffff',
      },
    });
    loadingText.setOrigin(0.5, 0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x00bfff, 1);
      progressBar.fillRect(450, 330, 380 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Generate placeholder ship textures programmatically
    this.generatePlaceholderTextures();
  }

  create(): void {
    // Transition to main menu
    this.scene.start('MainMenuScene');
  }

  /**
   * Generate simple geometric placeholder textures for ships
   * These will be replaced with actual sprites later
   */
  private generatePlaceholderTextures(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });

    // Generate a ship texture for each faction and size
    for (const [factionId, color] of Object.entries(FACTION_COLORS)) {
      for (const [sizeName, sizePixels] of Object.entries(SHIP_SIZES)) {
        const key = `ship_${factionId}_${sizeName}`;
        this.generateShipTexture(graphics, key, color, sizePixels);
      }
    }

    // Generate projectile textures
    this.generateProjectileTextures(graphics);

    // Generate UI textures
    this.generateUITextures(graphics);

    graphics.destroy();
  }

  private generateShipTexture(
    graphics: Phaser.GameObjects.Graphics,
    key: string,
    color: number,
    size: number
  ): void {
    graphics.clear();

    // Draw a simple triangle pointing up (ship shape)
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(size / 2, 0); // Top point
    graphics.lineTo(size, size); // Bottom right
    graphics.lineTo(size / 2, size * 0.75); // Back indent
    graphics.lineTo(0, size); // Bottom left
    graphics.closePath();
    graphics.fillPath();

    // Add a lighter accent for the cockpit/front
    graphics.fillStyle(0xffffff, 0.3);
    graphics.fillTriangle(
      size / 2, 0,
      size / 2 - size / 6, size / 3,
      size / 2 + size / 6, size / 3
    );

    // Add engine glow at back
    graphics.fillStyle(0xffffff, 0.5);
    graphics.fillCircle(size / 2, size * 0.85, size / 8);

    graphics.generateTexture(key, size, size);
  }

  private generateProjectileTextures(graphics: Phaser.GameObjects.Graphics): void {
    // Laser bolt
    graphics.clear();
    graphics.fillStyle(0x00bfff, 1);
    graphics.fillRect(0, 0, 4, 12);
    graphics.fillStyle(0xffffff, 0.8);
    graphics.fillRect(1, 1, 2, 10);
    graphics.generateTexture('projectile_laser', 4, 12);

    // Missile
    graphics.clear();
    graphics.fillStyle(0xff6b35, 1);
    graphics.fillTriangle(4, 0, 0, 8, 8, 8);
    graphics.fillRect(2, 8, 4, 8);
    graphics.fillStyle(0xffff00, 0.8);
    graphics.fillCircle(4, 16, 3);
    graphics.generateTexture('projectile_missile', 8, 20);
  }

  private generateUITextures(graphics: Phaser.GameObjects.Graphics): void {
    // Health bar background
    graphics.clear();
    graphics.fillStyle(0x333333, 1);
    graphics.fillRect(0, 0, 40, 6);
    graphics.generateTexture('healthbar_bg', 40, 6);

    // Health bar fill (hull)
    graphics.clear();
    graphics.fillStyle(0x00ff00, 1);
    graphics.fillRect(0, 0, 40, 6);
    graphics.generateTexture('healthbar_hull', 40, 6);

    // Health bar fill (shields)
    graphics.clear();
    graphics.fillStyle(0x00bfff, 1);
    graphics.fillRect(0, 0, 40, 6);
    graphics.generateTexture('healthbar_shields', 40, 6);

    // Target indicator
    graphics.clear();
    graphics.lineStyle(2, 0xff0000, 1);
    graphics.strokeCircle(16, 16, 14);
    graphics.strokeCircle(16, 16, 8);
    graphics.generateTexture('target_indicator', 32, 32);

    // Selection indicator
    graphics.clear();
    graphics.lineStyle(2, 0x00ff00, 1);
    graphics.strokeCircle(20, 20, 18);
    graphics.generateTexture('selection_indicator', 40, 40);
  }
}
