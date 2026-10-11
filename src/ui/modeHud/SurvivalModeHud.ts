/**
 * SurvivalModeHud — Survival's mode readouts in the holographic style: wave
 * counter (top left), score (top right), controls hint (top centre) and the
 * wave announcement banner. Flight, radar and weapons live in BattleHud;
 * this covers only what is specific to Survival. Zoom-independent.
 */

import Phaser from "phaser";
import type { FactionId } from "../../config";
import { HOLO_DEPTH, HOLO_SPACING, factionAccent } from "../theme/HoloTheme";
import { createControlsHint } from "./controlsHint";
import { HoloBanner } from "./HoloBanner";
import { HoloStatPanel } from "./HoloStatPanel";
import { cancelCameraZoom, pinTree, type ZoomCameraLike } from "./screenSpace";

/** Wave / score panel size (px). */
const PANEL_WIDTH = 190;
const PANEL_HEIGHT = 92;

/** Survival's wave/score readouts and banner. */
export class SurvivalModeHud {
  private readonly root: Phaser.GameObjects.Container;
  private readonly wavePanel: HoloStatPanel;
  private readonly scorePanel: HoloStatPanel;
  private readonly banner: HoloBanner;

  /**
   * @param scene - The Survival scene.
   * @param faction - Player faction (panel accents).
   */
  constructor(scene: Phaser.Scene, faction: FactionId) {
    const margin = HOLO_SPACING.lg;
    const y = margin + PANEL_HEIGHT / 2;
    const size = { width: PANEL_WIDTH, height: PANEL_HEIGHT, faction };
    this.wavePanel = new HoloStatPanel(scene, margin + PANEL_WIDTH / 2, y, {
      ...size,
      title: "Wave",
      align: "left",
    });
    this.scorePanel = new HoloStatPanel(
      scene,
      scene.scale.width - margin - PANEL_WIDTH / 2,
      y,
      { ...size, title: "Score", align: "right" },
    );
    const hint = createControlsHint(scene);
    this.banner = new HoloBanner(scene, factionAccent(faction));
    this.root = scene.add
      .container(0, 0, [
        this.wavePanel.panel,
        this.scorePanel.panel,
        hint,
        this.banner.container,
      ])
      .setDepth(HOLO_DEPTH.hud);
    pinTree(this.root);
    this.setWave(0, "");
    this.setScore(0);
  }

  /** The wave counter text shown. */
  get waveText(): string {
    return this.wavePanel.valueText;
  }

  /** The score text shown. */
  get scoreText(): string {
    return this.scorePanel.valueText;
  }

  /** The banner's current text. */
  get messageText(): string {
    return this.banner.text;
  }

  /**
   * @param wave - Wave number.
   * @param label - Wave type, e.g. "Basic Fighters".
   */
  setWave(wave: number, label: string): void {
    this.wavePanel.set(String(wave), label);
  }

  /**
   * @param score - Run score.
   * @param detail - Secondary line, e.g. the wing size.
   */
  setScore(score: number, detail = ""): void {
    this.scorePanel.set(score.toLocaleString("en-US"), detail);
  }

  /**
   * Announce something in the centre banner.
   *
   * @param title - Main line.
   * @param subtitle - Second line.
   */
  showMessage(title: string, subtitle: string): void {
    this.banner.show(title, subtitle);
  }

  /**
   * Show or hide every readout (hidden under the game-over overlay).
   *
   * @param visible - Visibility.
   */
  setVisible(visible: boolean): void {
    if (!visible) this.banner.hide();
    this.root.setVisible(visible);
  }

  /**
   * Keep the readouts 1:1 on screen under the current camera zoom.
   *
   * @param camera - The scene camera.
   */
  sync(camera: ZoomCameraLike): void {
    cancelCameraZoom(this.root, camera);
  }

  /** Destroy every readout. */
  destroy(): void {
    this.root.destroy();
  }
}
