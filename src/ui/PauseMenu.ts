/**
 * Pause Menu Component
 *
 * Overlay menu that appears when game is paused.
 * Can be added to any battle scene.
 */

import Phaser from "phaser";
import { createHoverButton } from "./ButtonFactory";

export interface PauseMenuConfig {
  scene: Phaser.Scene;
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onQuit: () => void;
}

export class PauseMenu extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics;
  private panel: Phaser.GameObjects.Container;
  private onResume: () => void;
  private onRestart: () => void;
  private onSettings: () => void;
  private onQuit: () => void;

  constructor(config: PauseMenuConfig) {
    super(config.scene, 0, 0);

    this.onResume = config.onResume;
    this.onRestart = config.onRestart;
    this.onSettings = config.onSettings;
    this.onQuit = config.onQuit;

    const width = config.scene.scale.width;
    const height = config.scene.scale.height;

    // Semi-transparent background
    this.background = config.scene.add.graphics();
    this.background.fillStyle(0x000000, 0.7);
    this.background.fillRect(0, 0, width, height);
    this.add(this.background);

    // Panel
    this.panel = config.scene.add.container(width / 2, height / 2);
    this.add(this.panel);

    // Panel background
    const panelBg = config.scene.add.graphics();
    panelBg.fillStyle(0x1a1a2a, 0.95);
    panelBg.fillRoundedRect(-200, -200, 400, 440, 16);
    panelBg.lineStyle(3, 0x4488ff, 1);
    panelBg.strokeRoundedRect(-200, -200, 400, 440, 16);
    this.panel.add(panelBg);

    // Title
    const title = config.scene.add
      .text(0, -160, "PAUSED", {
        font: "bold 48px Arial",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    this.panel.add(title);

    // Menu items
    const btnConfig = {
      width: 240,
      height: 50,
      radius: 8,
      font: "bold 24px Arial",
      hoverScale: 1.05 as const,
    };
    this.panel.add(
      createHoverButton(
        config.scene,
        0,
        -60,
        { ...btnConfig, color: 0x227722, label: "RESUME" },
        () => {
          this.hide();
          this.onResume();
        },
      ),
    );
    this.panel.add(
      createHoverButton(
        config.scene,
        0,
        20,
        { ...btnConfig, color: 0x666622, label: "RESTART" },
        () => {
          this.onRestart();
        },
      ),
    );
    this.panel.add(
      createHoverButton(
        config.scene,
        0,
        100,
        { ...btnConfig, color: 0x224466, label: "SETTINGS" },
        () => {
          this.onSettings();
        },
      ),
    );
    this.panel.add(
      createHoverButton(
        config.scene,
        0,
        180,
        { ...btnConfig, color: 0x662222, label: "QUIT TO MENU" },
        () => {
          this.onQuit();
        },
      ),
    );

    // Set depth and scroll factor
    this.setDepth(2000);
    this.setScrollFactor(0);

    // Add to scene
    config.scene.add.existing(this);

    // Start hidden
    this.setVisible(false);
  }

  show(): void {
    this.setVisible(true);

    // Animate in
    this.panel.setScale(0.8);
    this.panel.setAlpha(0);
    this.background.setAlpha(0);

    this.scene.tweens.add({
      targets: this.background,
      alpha: 1,
      duration: 200,
    });

    this.scene.tweens.add({
      targets: this.panel,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: "Back.out",
    });
  }

  hide(): void {
    this.scene.tweens.add({
      targets: [this.background, this.panel],
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.setVisible(false);
      },
    });
  }
}
