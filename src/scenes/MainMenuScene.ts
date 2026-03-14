/**
 * Main Menu Scene
 *
 * Entry point for the game with navigation to:
 * - Skirmish (Squad builder -> Battle)
 * - Campaign (Future)
 * - Settings
 * - Credits
 */

import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';

export class MainMenuScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private menuItems: Phaser.GameObjects.Container[] = [];
  private selectedIndex = 0;
  private starfield!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x050510);

    // Initialize audio and play menu music
    audioManager.initialize();
    audioManager.playMusic('menu_theme');

    this.createStarfield();
    this.createTitle();
    this.createMenuItems();
    this.setupInput();

    // Animate title in
    this.titleText.setAlpha(0);
    this.tweens.add({
      targets: this.titleText,
      alpha: 1,
      y: 120,
      duration: 1000,
      ease: 'Power2',
    });

    // Stagger menu items in
    this.menuItems.forEach((item, i) => {
      item.setAlpha(0);
      item.x = -200;
      this.tweens.add({
        targets: item,
        alpha: 1,
        x: this.scale.width / 2,
        duration: 500,
        delay: 500 + i * 100,
        ease: 'Back.out',
      });
    });
  }

  update(): void {
    // Slowly rotate starfield for visual interest
    this.starfield.rotation += 0.0001;
  }

  private createStarfield(): void {
    this.starfield = this.add.graphics();

    for (let i = 0; i < 200; i++) {
      const x = Phaser.Math.Between(-640, 1920);
      const y = Phaser.Math.Between(-360, 1080);
      const size = Phaser.Math.FloatBetween(0.5, 2);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.8);

      this.starfield.fillStyle(0xffffff, alpha);
      this.starfield.fillCircle(x, y, size);
    }

    // Some nebula colors
    this.starfield.fillStyle(0x2244aa, 0.05);
    this.starfield.fillCircle(400, 300, 300);
    this.starfield.fillStyle(0x442266, 0.05);
    this.starfield.fillCircle(900, 500, 250);
  }

  private createTitle(): void {
    const centerX = this.scale.width / 2;

    // Main title
    this.titleText = this.add
      .text(centerX, 80, 'SHATTERED STARS', {
        font: 'bold 72px Arial',
        color: '#ffffff',
        stroke: '#003366',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(centerX, 180, 'Tactical Starship Combat', {
        font: '24px Arial',
        color: '#88aacc',
      })
      .setOrigin(0.5);

    // Version
    this.add
      .text(this.scale.width - 20, this.scale.height - 20, 'v0.1.0 Alpha', {
        font: '14px monospace',
        color: '#444444',
      })
      .setOrigin(1, 1);
  }

  private createMenuItems(): void {
    this.menuItems = [];  // reset on every create() to avoid stale refs after scene restart
    this.selectedIndex = 0;
    const centerX = this.scale.width / 2;
    const startY = 250;
    const spacing = 55;

    const items = [
      { label: 'SKIRMISH', action: () => this.startSkirmish(), enabled: true },
      { label: 'SURVIVAL', action: () => this.startSurvival(), enabled: true },
      { label: 'EPIC BATTLE', action: () => this.startEpicBattle(), enabled: true },
      { label: 'DOGFIGHT', action: () => this.startDogfight(), enabled: true },
      { label: 'ACE DUEL', action: () => this.startAceDuel(), enabled: true },
      { label: 'CAMPAIGN', action: () => this.startCampaign(), enabled: true },
      { label: 'SETTINGS', action: () => this.openSettings(), enabled: true },
      { label: 'CREDITS', action: () => this.showCredits(), enabled: true },
    ];

    items.forEach((item, index) => {
      const container = this.createMenuItem(
        centerX,
        startY + index * spacing,
        item.label,
        item.action,
        item.enabled
      );
      this.menuItems.push(container);
    });

    this.updateSelection();
  }

  private createMenuItem(
    x: number,
    y: number,
    label: string,
    action: () => void,
    enabled: boolean
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x112233, 0.6);
    bg.fillRoundedRect(-150, -25, 300, 50, 8);
    container.add(bg);

    // Text
    const text = this.add
      .text(0, 0, label, {
        font: 'bold 28px Arial',
        color: enabled ? '#ffffff' : '#666666',
      })
      .setOrigin(0.5);
    container.add(text);

    // Store data
    container.setData('bg', bg);
    container.setData('text', text);
    container.setData('action', action);
    container.setData('enabled', enabled);

    // Make interactive
    if (enabled) {
      container.setInteractive(
        new Phaser.Geom.Rectangle(-150, -25, 300, 50),
        Phaser.Geom.Rectangle.Contains
      );

      container.on('pointerover', () => {
        this.selectedIndex = this.menuItems.indexOf(container);
        this.updateSelection();
      });

      container.on('pointerdown', () => {
        this.selectMenuItem();
      });
    }

    return container;
  }

  private updateSelection(): void {
    this.menuItems.forEach((item, index) => {
      const bg = item.getData('bg') as Phaser.GameObjects.Graphics;
      const text = item.getData('text') as Phaser.GameObjects.Text;
      const enabled = item.getData('enabled') as boolean;
      const isSelected = index === this.selectedIndex;

      bg.clear();

      if (isSelected && enabled) {
        bg.fillStyle(0x224466, 0.9);
        bg.lineStyle(2, 0x44aaff, 1);
      } else {
        bg.fillStyle(0x112233, 0.6);
        bg.lineStyle(0, 0x000000, 0);
      }

      bg.fillRoundedRect(-150, -25, 300, 50, 8);

      if (isSelected && enabled) {
        bg.strokeRoundedRect(-150, -25, 300, 50, 8);
        text.setColor('#44ffaa');
        text.setScale(1.05);
      } else {
        text.setColor(enabled ? '#ffffff' : '#666666');
        text.setScale(1);
      }
    });
  }

  private setupInput(): void {
    this.input.keyboard!.on('keydown-UP', () => {
      do {
        this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
      } while (!this.menuItems[this.selectedIndex]?.getData('enabled'));
      audioManager.playSound('ui_hover', 0.5);
      this.updateSelection();
    });

    this.input.keyboard!.on('keydown-DOWN', () => {
      do {
        this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
      } while (!this.menuItems[this.selectedIndex]?.getData('enabled'));
      audioManager.playSound('ui_hover', 0.5);
      this.updateSelection();
    });

    this.input.keyboard!.on('keydown-ENTER', () => {
      this.selectMenuItem();
    });

    this.input.keyboard!.on('keydown-SPACE', () => {
      this.selectMenuItem();
    });
  }

  private selectMenuItem(): void {
    const item = this.menuItems[this.selectedIndex];
    if (!item) return;

    const enabled = item.getData('enabled') as boolean;
    if (!enabled) return;

    const action = item.getData('action') as () => void;

    // Play select sound
    audioManager.playSound('ui_select', 0.7);

    // Flash effect
    this.cameras.main.flash(100, 68, 170, 255, false);

    action();
  }

  private startSkirmish(): void {
    this.scene.start('SquadBuilderScene', { initialMode: 'arcade' });
  }

  private startSurvival(): void {
    this.scene.start('SurvivalScene');
  }

  private startEpicBattle(): void {
    this.scene.start('EpicBattleScene');
  }

  private startDogfight(): void {
    this.scene.start('ArcadeBattleScene');
  }

  private startAceDuel(): void {
    this.scene.start('AceDuelScene');
  }

  private startCampaign(): void {
    this.scene.start('CampaignScene');
  }

  private openSettings(): void {
    this.scene.start('SettingsScene');
  }

  private showCredits(): void {
    this.scene.start('CreditsScene');
  }

  private showComingSoon(feature: string): void {
    // Show a temporary popup
    const popup = this.add.container(this.scale.width / 2, this.scale.height / 2);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRoundedRect(-200, -60, 400, 120, 16);
    bg.lineStyle(2, 0xffaa00, 1);
    bg.strokeRoundedRect(-200, -60, 400, 120, 16);
    popup.add(bg);

    const text = this.add
      .text(0, -15, `${feature}`, {
        font: 'bold 32px Arial',
        color: '#ffaa00',
      })
      .setOrigin(0.5);
    popup.add(text);

    const subtext = this.add
      .text(0, 25, 'Coming Soon!', {
        font: '20px Arial',
        color: '#888888',
      })
      .setOrigin(0.5);
    popup.add(subtext);

    popup.setAlpha(0);
    popup.setScale(0.5);

    this.tweens.add({
      targets: popup,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Back.out',
    });

    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: popup,
        alpha: 0,
        scale: 0.5,
        duration: 200,
        onComplete: () => popup.destroy(),
      });
    });
  }
}
