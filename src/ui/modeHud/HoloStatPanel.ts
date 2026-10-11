/**
 * HoloStatPanel — a small holographic readout: a captioned header strip, a
 * large value and an optional secondary line (e.g. WAVE / 3 / Basic
 * Fighters, SCORE / 1200).
 */

import Phaser from "phaser";
import type { FactionId } from "../../config";
import { HOLO_PALETTE, HOLO_SPACING } from "../theme/HoloTheme";
import { createHoloText } from "../hud/holoPrimitives";
import { HoloPanel } from "../hud/HoloPanel";

/** HoloStatPanel layout options. */
export interface HoloStatPanelConfig {
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly faction?: FactionId;
  /** Which edge the content hugs. */
  readonly align: "left" | "right";
}

/** Captioned value readout on a holo panel. */
export class HoloStatPanel {
  /** The panel (origin at its centre). */
  readonly panel: HoloPanel;
  private readonly value: Phaser.GameObjects.Text;
  private readonly detail: Phaser.GameObjects.Text;

  /**
   * @param scene - Owning scene.
   * @param x - Centre x.
   * @param y - Centre y.
   * @param config - Title, size, accent and alignment.
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    config: HoloStatPanelConfig,
  ) {
    const panelConfig = {
      width: config.width,
      height: config.height,
      title: config.title,
      ...(config.faction !== undefined ? { faction: config.faction } : {}),
    };
    this.panel = new HoloPanel(scene, x, y, panelConfig);
    scene.add.existing(this.panel);
    const originX = config.align === "left" ? 0 : 1;
    const edgeX =
      config.align === "left"
        ? -config.width / 2 + HOLO_SPACING.md
        : config.width / 2 - HOLO_SPACING.md;
    const top = this.panel.contentTop;
    this.value = createHoloText(scene, edgeX, top, "", "title").setOrigin(
      originX,
      0,
    );
    this.detail = createHoloText(
      scene,
      edgeX,
      config.height / 2 - HOLO_SPACING.sm,
      "",
      "caption",
      HOLO_PALETTE.textSecondary,
    ).setOrigin(originX, 1);
    this.panel.add([this.value, this.detail]);
  }

  /** The value text shown. */
  get valueText(): string {
    return this.value.text;
  }

  /**
   * @param value - Main value.
   * @param detail - Secondary line ("" for none).
   */
  set(value: string, detail = ""): void {
    this.value.setText(value);
    this.detail.setText(detail.toUpperCase());
  }
}
