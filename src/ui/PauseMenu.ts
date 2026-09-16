/**
 * Pause Menu Component
 *
 * Overlay menu that appears when game is paused.
 * Can be added to any battle scene.
 */

import Phaser from "phaser";
import { createHoverButton } from "./ButtonFactory";
import { showConfirmDialog } from "./ConfirmDialog";

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
    // Each button gets its own scrollFactor(0) explicitly — Phaser's pointer
    // hit-testing does not correctly inherit scrollFactor from an ancestor
    // container when the camera is scrolled/zoomed, so relying only on this
    // container's own setScrollFactor(0) below silently breaks clicks on the
    // nested buttons (verified live).
    const btnConfig = {
      width: 240,
      height: 50,
      radius: 8,
      font: "bold 24px Arial",
      hoverScale: 1.05 as const,
    };
    const resumeBtn = createHoverButton(
      config.scene,
      0,
      -60,
      { ...btnConfig, color: 0x227722, label: "RESUME" },
      () => {
        this.hide();
        this.onResume();
      },
    ).setScrollFactor(0);
    this.panel.add(resumeBtn);

    const restartBtn = createHoverButton(
      config.scene,
      0,
      20,
      { ...btnConfig, color: 0x666622, label: "RESTART" },
      () => {
        this.onRestart();
      },
    ).setScrollFactor(0);
    this.panel.add(restartBtn);

    const settingsBtn = createHoverButton(
      config.scene,
      0,
      100,
      { ...btnConfig, color: 0x224466, label: "SETTINGS" },
      () => {
        this.onSettings();
      },
    ).setScrollFactor(0);
    this.panel.add(settingsBtn);

    const quitBtn = createHoverButton(
      config.scene,
      0,
      180,
      { ...btnConfig, color: 0x662222, label: "QUIT TO MENU" },
      () => {
        showConfirmDialog({
          scene: config.scene,
          message: "Quit to menu? Battle progress will be lost.",
          onConfirm: () => this.onQuit(),
        });
      },
    ).setScrollFactor(0);
    this.panel.add(quitBtn);

    // Set depth and scroll factor
    this.setDepth(2000);
    this.setScrollFactor(0);
    this.panel.setScrollFactor(0);

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
