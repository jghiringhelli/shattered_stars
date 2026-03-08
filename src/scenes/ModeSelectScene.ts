/**
 * Mode Selection Scene
 *
 * Allows player to choose between:
 * - Turn-Based: Classic X-Wing style with planning phases
 * - Continuous Tactical: Smooth real-time with interval-based maneuver commits
 */

import Phaser from 'phaser';

export class ModeSelectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ModeSelectScene' });
  }

  create(): void {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;

    // Title
    this.add
      .text(centerX, 100, 'SHATTERED STARS', {
        font: 'bold 48px Arial',
        color: '#00ffaa',
        stroke: '#004422',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, 160, 'Tactical Starship Combat', {
        font: '20px monospace',
        color: '#888888',
      })
      .setOrigin(0.5);

    // Mode buttons
    this.createModeButton(
      centerX,
      centerY - 60,
      'TURN-BASED MODE',
      'Classic X-Wing style: Plan → Activate → Combat → End',
      'Full tactical depth with secret maneuver planning',
      () => this.scene.start('TurnBasedBattleScene')
    );

    this.createModeButton(
      centerX,
      centerY + 100,
      'CONTINUOUS TACTICAL',
      'Real-time combat with 300ms maneuver intervals',
      'Smooth gameplay while keeping maneuver templates',
      () => this.scene.start('ContinuousTacticalScene')
    );

    // Instructions
    this.add
      .text(centerX, this.scale.height - 40, 'Click a mode to begin', {
        font: '16px monospace',
        color: '#666666',
      })
      .setOrigin(0.5);
  }

  private createModeButton(
    x: number,
    y: number,
    title: string,
    desc1: string,
    desc2: string,
    onClick: () => void
  ): void {
    const width = 500;
    const height = 100;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x222244, 0.8);
    bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 10);
    bg.lineStyle(2, 0x4466aa, 1);
    bg.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 10);

    // Title
    const titleText = this.add
      .text(x, y - 25, title, {
        font: 'bold 24px monospace',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Descriptions
    this.add
      .text(x, y + 5, desc1, {
        font: '14px monospace',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    this.add
      .text(x, y + 25, desc2, {
        font: '12px monospace',
        color: '#666666',
      })
      .setOrigin(0.5);

    // Interactive zone
    const hitArea = this.add
      .rectangle(x, y, width, height)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x334466, 0.9);
      bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 10);
      bg.lineStyle(3, 0x66aaff, 1);
      bg.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 10);
      titleText.setColor('#00ffaa');
    });

    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x222244, 0.8);
      bg.fillRoundedRect(x - width / 2, y - height / 2, width, height, 10);
      bg.lineStyle(2, 0x4466aa, 1);
      bg.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 10);
      titleText.setColor('#ffffff');
    });

    hitArea.on('pointerdown', onClick);
  }
}
