/**
 * Settings Scene
 *
 * Game settings including:
 * - Audio volume
 * - Graphics quality
 * - Controls
 */

import Phaser from 'phaser';

interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  cameraShake: boolean;
  showDamageNumbers: boolean;
  showMinimap: boolean;
}

export class SettingsScene extends Phaser.Scene {
  private settings: GameSettings = {
    masterVolume: 0.8,
    musicVolume: 0.7,
    sfxVolume: 1.0,
    cameraShake: true,
    showDamageNumbers: true,
    showMinimap: true,
  };

  constructor() {
    super({ key: 'SettingsScene' });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0a1a);

    // Load saved settings
    this.loadSettings();

    this.createHeader();
    this.createSettingsUI();
    this.createBackButton();
    this.setupInput();
  }

  private createHeader(): void {
    const centerX = this.scale.width / 2;

    this.add
      .text(centerX, 50, 'SETTINGS', {
        font: 'bold 48px Arial',
        color: '#ffffff',
      })
      .setOrigin(0.5);
  }

  private createSettingsUI(): void {
    const centerX = this.scale.width / 2;
    let y = 150;
    const spacing = 60;

    // Audio section
    this.add
      .text(centerX, y, '--- AUDIO ---', {
        font: 'bold 24px Arial',
        color: '#888888',
      })
      .setOrigin(0.5);
    y += 50;

    this.createSlider(centerX, y, 'Master Volume', this.settings.masterVolume, (val) => {
      this.settings.masterVolume = val;
      this.saveSettings();
    });
    y += spacing;

    this.createSlider(centerX, y, 'Music Volume', this.settings.musicVolume, (val) => {
      this.settings.musicVolume = val;
      this.saveSettings();
    });
    y += spacing;

    this.createSlider(centerX, y, 'SFX Volume', this.settings.sfxVolume, (val) => {
      this.settings.sfxVolume = val;
      this.saveSettings();
    });
    y += spacing + 20;

    // Visual section
    this.add
      .text(centerX, y, '--- VISUAL ---', {
        font: 'bold 24px Arial',
        color: '#888888',
      })
      .setOrigin(0.5);
    y += 50;

    this.createToggle(centerX, y, 'Camera Shake', this.settings.cameraShake, (val) => {
      this.settings.cameraShake = val;
      this.saveSettings();
    });
    y += spacing;

    this.createToggle(centerX, y, 'Damage Numbers', this.settings.showDamageNumbers, (val) => {
      this.settings.showDamageNumbers = val;
      this.saveSettings();
    });
    y += spacing;

    this.createToggle(centerX, y, 'Minimap', this.settings.showMinimap, (val) => {
      this.settings.showMinimap = val;
      this.saveSettings();
    });
  }

  private createSlider(
    x: number,
    y: number,
    label: string,
    value: number,
    onChange: (val: number) => void
  ): void {
    const sliderWidth = 200;

    // Label
    this.add
      .text(x - 150, y, label, {
        font: '18px Arial',
        color: '#ffffff',
      })
      .setOrigin(1, 0.5);

    // Slider background
    const bg = this.add.graphics();
    bg.fillStyle(0x333333, 1);
    bg.fillRoundedRect(x - 100, y - 8, sliderWidth, 16, 8);

    // Slider fill
    const fill = this.add.graphics();
    this.updateSliderFill(fill, x - 100, y, sliderWidth, value);

    // Value text
    const valueText = this.add
      .text(x + 120, y, `${Math.round(value * 100)}%`, {
        font: '18px Arial',
        color: '#aaaaaa',
      })
      .setOrigin(0, 0.5);

    // Interactive zone
    const hitArea = this.add.rectangle(x, y, sliderWidth + 20, 30, 0x000000, 0);
    hitArea.setInteractive();

    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const localX = pointer.x - (x - 100);
      const newValue = Phaser.Math.Clamp(localX / sliderWidth, 0, 1);
      this.updateSliderFill(fill, x - 100, y, sliderWidth, newValue);
      valueText.setText(`${Math.round(newValue * 100)}%`);
      onChange(newValue);
    });

    hitArea.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        const localX = pointer.x - (x - 100);
        const newValue = Phaser.Math.Clamp(localX / sliderWidth, 0, 1);
        this.updateSliderFill(fill, x - 100, y, sliderWidth, newValue);
        valueText.setText(`${Math.round(newValue * 100)}%`);
        onChange(newValue);
      }
    });
  }

  private updateSliderFill(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    value: number
  ): void {
    graphics.clear();
    graphics.fillStyle(0x44aaff, 1);
    graphics.fillRoundedRect(x, y - 8, width * value, 16, 8);
  }

  private createToggle(
    x: number,
    y: number,
    label: string,
    value: boolean,
    onChange: (val: boolean) => void
  ): void {
    // Label
    this.add
      .text(x - 150, y, label, {
        font: '18px Arial',
        color: '#ffffff',
      })
      .setOrigin(1, 0.5);

    // Toggle background
    const bg = this.add.graphics();
    this.drawToggle(bg, x - 80, y, value);

    // Toggle text
    const toggleText = this.add
      .text(x - 80, y, value ? 'ON' : 'OFF', {
        font: 'bold 14px Arial',
        color: value ? '#44ff44' : '#888888',
      })
      .setOrigin(0.5);

    // Interactive
    const hitArea = this.add.rectangle(x - 80, y, 60, 30, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => {
      const newValue = !value;
      value = newValue;
      this.drawToggle(bg, x - 80, y, newValue);
      toggleText.setText(newValue ? 'ON' : 'OFF');
      toggleText.setColor(newValue ? '#44ff44' : '#888888');
      onChange(newValue);
    });
  }

  private drawToggle(graphics: Phaser.GameObjects.Graphics, x: number, y: number, on: boolean): void {
    graphics.clear();
    graphics.fillStyle(on ? 0x226622 : 0x333333, 1);
    graphics.fillRoundedRect(x - 30, y - 15, 60, 30, 8);
    graphics.lineStyle(2, on ? 0x44ff44 : 0x666666, 1);
    graphics.strokeRoundedRect(x - 30, y - 15, 60, 30, 8);
  }

  private createBackButton(): void {
    const btn = this.add.container(this.scale.width / 2, this.scale.height - 80);

    const bg = this.add.graphics();
    bg.fillStyle(0x333344, 1);
    bg.fillRoundedRect(-80, -20, 160, 40, 8);
    btn.add(bg);

    const text = this.add
      .text(0, 0, 'BACK', {
        font: 'bold 24px Arial',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    btn.add(text);

    btn.setInteractive(new Phaser.Geom.Rectangle(-80, -20, 160, 40), Phaser.Geom.Rectangle.Contains);

    btn.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x444466, 1);
      bg.fillRoundedRect(-80, -20, 160, 40, 8);
    });

    btn.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x333344, 1);
      bg.fillRoundedRect(-80, -20, 160, 40, 8);
    });

    btn.on('pointerdown', () => {
      this.scene.start('MainMenuScene');
    });
  }

  private setupInput(): void {
    this.input.keyboard!.on('keydown-ESC', () => {
      this.scene.start('MainMenuScene');
    });
  }

  private loadSettings(): void {
    const saved = localStorage.getItem('shattered_stars_settings');
    if (saved) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      } catch {
        // Use defaults
      }
    }
  }

  private saveSettings(): void {
    localStorage.setItem('shattered_stars_settings', JSON.stringify(this.settings));
    this.registry.set('settings', this.settings);
  }
}
