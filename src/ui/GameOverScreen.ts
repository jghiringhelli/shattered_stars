/**
 * Game Over Screen Component
 *
 * Shows victory/defeat with stats and options.
 */

import Phaser from 'phaser';

export interface GameOverStats {
  winner: string; // Faction name that won
  isPlayerVictory: boolean;
  shipsDestroyed: number;
  shipsLost: number;
  damageDealt: number;
  turnCount?: number; // For turn-based mode
  battleDuration?: number; // For continuous mode (ms)
}

export interface GameOverConfig {
  scene: Phaser.Scene;
  stats: GameOverStats;
  onRestart: () => void;
  onQuit: () => void;
}

export class GameOverScreen extends Phaser.GameObjects.Container {
  constructor(config: GameOverConfig) {
    super(config.scene, 0, 0);

    const width = config.scene.scale.width;
    const height = config.scene.scale.height;

    // Background
    const bg = config.scene.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRect(0, 0, width, height);
    this.add(bg);

    // Main panel
    const panel = config.scene.add.container(width / 2, height / 2);
    this.add(panel);

    // Panel background
    const panelBg = config.scene.add.graphics();
    const panelColor = config.stats.isPlayerVictory ? 0x224422 : 0x442222;
    panelBg.fillStyle(panelColor, 0.95);
    panelBg.fillRoundedRect(-300, -250, 600, 500, 20);
    panelBg.lineStyle(4, config.stats.isPlayerVictory ? 0x44ff44 : 0xff4444, 1);
    panelBg.strokeRoundedRect(-300, -250, 600, 500, 20);
    panel.add(panelBg);

    // Victory/Defeat text
    const resultText = config.stats.isPlayerVictory ? 'VICTORY!' : 'DEFEAT';
    const resultColor = config.stats.isPlayerVictory ? '#44ff44' : '#ff4444';

    const title = config.scene.add
      .text(0, -200, resultText, {
        font: 'bold 64px Arial',
        color: resultColor,
      })
      .setOrigin(0.5);
    panel.add(title);

    // Winner info
    const winnerText = config.scene.add
      .text(0, -130, `${config.stats.winner} Wins`, {
        font: '28px Arial',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    panel.add(winnerText);

    // Stats section
    const statsY = -60;
    const statSpacing = 35;

    this.createStatLine(config.scene, panel, 0, statsY, 'Ships Destroyed', config.stats.shipsDestroyed.toString());
    this.createStatLine(config.scene, panel, 0, statsY + statSpacing, 'Ships Lost', config.stats.shipsLost.toString());
    this.createStatLine(config.scene, panel, 0, statsY + statSpacing * 2, 'Damage Dealt', config.stats.damageDealt.toString());

    if (config.stats.turnCount !== undefined) {
      this.createStatLine(config.scene, panel, 0, statsY + statSpacing * 3, 'Turns', config.stats.turnCount.toString());
    }

    if (config.stats.battleDuration !== undefined) {
      const seconds = Math.floor(config.stats.battleDuration / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      const timeStr = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
      this.createStatLine(config.scene, panel, 0, statsY + statSpacing * 3, 'Duration', timeStr);
    }

    // Buttons
    this.createButton(config.scene, panel, -100, 170, 'PLAY AGAIN', 0x336633, () => {
      config.onRestart();
    });

    this.createButton(config.scene, panel, 100, 170, 'MAIN MENU', 0x333366, () => {
      config.onQuit();
    });

    // Set depth and scroll factor
    this.setDepth(2500);
    this.setScrollFactor(0);

    // Animate in
    this.setAlpha(0);
    panel.setScale(0.5);

    config.scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 300,
    });

    config.scene.tweens.add({
      targets: panel,
      scale: 1,
      duration: 500,
      ease: 'Back.out',
      delay: 100,
    });

    // Add to scene
    config.scene.add.existing(this);
  }

  private createStatLine(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    value: string
  ): void {
    const labelText = scene.add
      .text(x - 100, y, label, {
        font: '20px Arial',
        color: '#aaaaaa',
      })
      .setOrigin(1, 0.5);
    parent.add(labelText);

    const valueText = scene.add
      .text(x + 100, y, value, {
        font: 'bold 24px Arial',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);
    parent.add(valueText);
  }

  private createButton(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void
  ): void {
    const container = scene.add.container(x, y);

    const bg = scene.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-90, -25, 180, 50, 8);
    container.add(bg);

    const text = scene.add
      .text(0, 0, label, {
        font: 'bold 18px Arial',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    container.add(text);

    container.setInteractive(
      new Phaser.Geom.Rectangle(-90, -25, 180, 50),
      Phaser.Geom.Rectangle.Contains
    );

    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(Phaser.Display.Color.ValueToColor(color).lighten(20).color, 1);
      bg.fillRoundedRect(-90, -25, 180, 50, 8);
      text.setScale(1.05);
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(-90, -25, 180, 50, 8);
      text.setScale(1);
    });

    container.on('pointerdown', onClick);

    parent.add(container);
  }
}
