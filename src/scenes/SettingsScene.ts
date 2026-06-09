/**
 * Settings Scene
 *
 * Game settings including:
 * - Audio volume
 * - Graphics quality
 * - Controls
 */

import Phaser from "phaser";
import { audioManager } from "../audio/AudioManager";
import {
  DEFAULT_SETTINGS,
  loadSettings as loadStoredSettings,
  saveSettings as saveToStorage,
} from "../systems/SettingsStorage";
import { addSceneBackground } from "../ui/TexturedPanel";

type MutableSettings = {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  cameraShake: boolean;
  showDamageNumbers: boolean;
  showMinimap: boolean;
};

export class SettingsScene extends Phaser.Scene {
  private settings: MutableSettings = { ...DEFAULT_SETTINGS };
  private returnScene: string | null = null;

  constructor() {
    super({ key: "SettingsScene" });
  }

  init(data: { returnScene?: string } = {}): void {
    this.returnScene = data.returnScene ?? null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x0a0a1a);
    addSceneBackground(this);
    this.loadSettings();
    this.createHeader();
    this.createSettingsUI();
    this.createBackButton();
    this.setupInput();
  }

  private createHeader(): void {
    this.add
      .text(this.scale.width / 2, 50, "SETTINGS", {
        font: "bold 48px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);
  }

  private createSettingsUI(): void {
    const audioEndY = this.createAudioSection(150, 60);
    this.createVisualSection(audioEndY, 60);
  }

  /**
   * Create the Audio settings section (three sliders: master, music, SFX).
   *
   * @param startY  - Top Y position of this section.
   * @param spacing - Vertical gap between controls.
   * @returns The Y coordinate after the last slider (ready for the next section).
   */
  private createAudioSection(startY: number, spacing: number): number {
    const cx = this.scale.width / 2;
    let y = startY;
    this.add
      .text(cx, y, "--- AUDIO ---", {
        font: "bold 24px Arial",
        color: "#888888",
      })
      .setOrigin(0.5);
    y += 50;
    this.createSlider(
      cx,
      y,
      "Master Volume",
      this.settings.masterVolume,
      (val) => {
        this.settings.masterVolume = val;
        audioManager.setMasterVolume(val);
        this.saveSettings();
      },
    );
    y += spacing;
    this.createSlider(
      cx,
      y,
      "Music Volume",
      this.settings.musicVolume,
      (val) => {
        this.settings.musicVolume = val;
        audioManager.setMusicVolume(val);
        this.saveSettings();
      },
    );
    y += spacing;
    this.createSlider(cx, y, "SFX Volume", this.settings.sfxVolume, (val) => {
      this.settings.sfxVolume = val;
      audioManager.setSfxVolume(val);
      this.saveSettings();
    });
    return y + spacing + 20;
  }

  /**
   * Create the Visual settings section (three toggles: camera shake, damage numbers, minimap).
   *
   * @param startY  - Top Y position of this section.
   * @param spacing - Vertical gap between controls.
   */
  private createVisualSection(startY: number, spacing: number): void {
    const cx = this.scale.width / 2;
    let y = startY;
    this.add
      .text(cx, y, "--- VISUAL ---", {
        font: "bold 24px Arial",
        color: "#888888",
      })
      .setOrigin(0.5);
    y += 50;
    this.createToggle(
      cx,
      y,
      "Camera Shake",
      this.settings.cameraShake,
      (val) => {
        this.settings.cameraShake = val;
        this.saveSettings();
      },
    );
    y += spacing;
    this.createToggle(
      cx,
      y,
      "Damage Numbers",
      this.settings.showDamageNumbers,
      (val) => {
        this.settings.showDamageNumbers = val;
        this.saveSettings();
      },
    );
    y += spacing;
    this.createToggle(cx, y, "Minimap", this.settings.showMinimap, (val) => {
      this.settings.showMinimap = val;
      this.saveSettings();
    });
  }

  /**
   * Build a shared pointer handler for slider pointerdown and pointermove events.
   *
   * @param fill        - Graphics object rendering the filled portion of the slider track.
   * @param sliderX     - Left-edge X of the slider track.
   * @param sliderY     - Center Y of the slider track.
   * @param sliderWidth - Pixel width of the slider track.
   * @param valueText   - Text object showing the current percentage.
   * @param onChange    - Callback invoked with the new 0–1 value.
   * @returns A pointer event handler that computes and applies the new value.
   */
  private makeSliderHandler(
    fill: Phaser.GameObjects.Graphics,
    sliderX: number,
    sliderY: number,
    sliderWidth: number,
    valueText: Phaser.GameObjects.Text,
    onChange: (val: number) => void,
  ): (pointer: Phaser.Input.Pointer) => void {
    return (pointer) => {
      const newValue = Phaser.Math.Clamp(
        (pointer.x - sliderX) / sliderWidth,
        0,
        1,
      );
      this.updateSliderFill(fill, sliderX, sliderY, sliderWidth, newValue);
      valueText.setText(`${Math.round(newValue * 100)}%`);
      onChange(newValue);
    };
  }

  private createSlider(
    x: number,
    y: number,
    label: string,
    value: number,
    onChange: (val: number) => void,
  ): void {
    const sliderWidth = 200;
    this.add
      .text(x - 150, y, label, { font: "18px Arial", color: "#ffffff" })
      .setOrigin(1, 0.5);
    const bg = this.add.graphics();
    bg.fillStyle(0x333333, 1);
    bg.fillRoundedRect(x - 100, y - 8, sliderWidth, 16, 8);
    const fill = this.add.graphics();
    this.updateSliderFill(fill, x - 100, y, sliderWidth, value);
    const valueText = this.add
      .text(x + 120, y, `${Math.round(value * 100)}%`, {
        font: "18px Arial",
        color: "#aaaaaa",
      })
      .setOrigin(0, 0.5);
    const hitArea = this.add.rectangle(x, y, sliderWidth + 20, 30, 0x000000, 0);
    hitArea.setInteractive();
    const handler = this.makeSliderHandler(
      fill,
      x - 100,
      y,
      sliderWidth,
      valueText,
      onChange,
    );
    hitArea.on("pointerdown", handler);
    hitArea.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) handler(pointer);
    });
  }

  private updateSliderFill(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    value: number,
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
    onChange: (val: boolean) => void,
  ): void {
    this.add
      .text(x - 150, y, label, { font: "18px Arial", color: "#ffffff" })
      .setOrigin(1, 0.5);
    const bg = this.add.graphics();
    this.drawToggle(bg, x - 80, y, value);
    const toggleText = this.add
      .text(x - 80, y, value ? "ON" : "OFF", {
        font: "bold 14px Arial",
        color: value ? "#44ff44" : "#888888",
      })
      .setOrigin(0.5);
    const hitArea = this.add.rectangle(x - 80, y, 60, 30, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on("pointerdown", () => {
      const newValue = !value;
      value = newValue;
      this.drawToggle(bg, x - 80, y, newValue);
      toggleText
        .setText(newValue ? "ON" : "OFF")
        .setColor(newValue ? "#44ff44" : "#888888");
      onChange(newValue);
    });
  }

  private drawToggle(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    on: boolean,
  ): void {
    graphics.clear();
    graphics.fillStyle(on ? 0x226622 : 0x333333, 1);
    graphics.fillRoundedRect(x - 30, y - 15, 60, 30, 8);
    graphics.lineStyle(2, on ? 0x44ff44 : 0x666666, 1);
    graphics.strokeRoundedRect(x - 30, y - 15, 60, 30, 8);
  }

  private createBackButton(): void {
    const btn = this.add.container(
      this.scale.width / 2,
      this.scale.height - 80,
    );
    const bg = this.add.graphics();
    bg.fillStyle(0x333344, 1);
    bg.fillRoundedRect(-80, -20, 160, 40, 8);
    btn.add(bg);
    btn.add(
      this.add
        .text(0, 0, "BACK", { font: "bold 24px Arial", color: "#ffffff" })
        .setOrigin(0.5),
    );
    btn.setInteractive(
      new Phaser.Geom.Rectangle(-80, -20, 160, 40),
      Phaser.Geom.Rectangle.Contains,
    );
    btn.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(0x444466, 1);
      bg.fillRoundedRect(-80, -20, 160, 40, 8);
    });
    btn.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(0x333344, 1);
      bg.fillRoundedRect(-80, -20, 160, 40, 8);
    });
    btn.on("pointerdown", () => {
      this.exitSettings();
    });
  }

  private setupInput(): void {
    this.input.keyboard!.on("keydown-ESC", () => {
      this.exitSettings();
    });
  }

  private exitSettings(): void {
    if (this.returnScene) {
      this.scene.stop();
    } else {
      this.scene.start("MainMenuScene");
    }
  }

  private loadSettings(): void {
    this.settings = { ...loadStoredSettings() };
    audioManager.setMasterVolume(this.settings.masterVolume);
    audioManager.setMusicVolume(this.settings.musicVolume);
    audioManager.setSfxVolume(this.settings.sfxVolume);
  }

  private saveSettings(): void {
    saveToStorage(this.settings);
    this.registry.set("settings", this.settings);
  }
}
