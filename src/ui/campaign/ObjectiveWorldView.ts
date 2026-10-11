/**
 * ObjectiveWorldView — draws mission objective markers (capture zones with
 * control colour and hold progress, waypoints, extraction exits, salvage
 * crates and drop zones, sensor sentries) and hazards (ion storms, asteroid
 * belts, mines, flare fronts) in world space under the ships. Redrawn every
 * frame from plain data; a short label backs each colour.
 */

import Phaser from "phaser";
import type {
  MarkerController,
  ObjectiveMarker,
} from "../../arcade/objectives";
import type { HazardVisual } from "../../campaign/hazards/hazardTypes";
import { HOLO_PALETTE, SIDE_COLORS } from "../theme/HoloTheme";
import { toCssColor } from "../theme/colorMath";

/** Depth under ships (ships draw at 10+). */
const WORLD_DEPTH = 4;
/** Labels shown per marker kind. */
const LABELS: Readonly<Record<ObjectiveMarker["kind"], string>> = {
  zone: "HOLD",
  waypoint: "NAV",
  exit: "EXIT",
  crate: "CARGO",
  dropzone: "DROP",
  sentry: "SENSOR",
};
/** Ion storm / belt / flare colours. */
const ION_COLOR = 0x8a5cff;
const ROCK_COLOR = 0x9b7a55;
const FLARE_COLOR = 0xff7a1a;
/** Width of the drawn flare band behind its front (px). */
const FLARE_BAND = 4000;
/** Max labels pooled. */
const MAX_LABELS = 24;

/**
 * @param controller - Who holds a marker.
 * @returns Its colour.
 */
function controllerColor(controller: MarkerController): number {
  if (controller === "player") return SIDE_COLORS.ally;
  if (controller === "enemy") return HOLO_PALETTE.danger;
  if (controller === "contested") return HOLO_PALETTE.warning;
  return HOLO_PALETTE.accent;
}

export class ObjectiveWorldView {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];

  /** @param scene - Battle scene. */
  constructor(private readonly scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(WORLD_DEPTH);
  }

  /**
   * @param markers - Objective markers.
   * @param hazards - Hazard shapes.
   */
  draw(
    markers: readonly ObjectiveMarker[],
    hazards: readonly HazardVisual[],
  ): void {
    this.gfx.clear();
    for (const h of hazards) this.drawHazard(h);
    for (const m of markers) this.drawMarker(m);
    this.drawLabels(markers);
  }

  /** @param visible - Visibility. */
  setVisible(visible: boolean): void {
    this.gfx.setVisible(visible);
    for (const l of this.labels) l.setVisible(visible && l.text !== "");
  }

  /** Destroy the view. */
  destroy(): void {
    this.gfx.destroy();
    for (const l of this.labels) l.destroy();
  }

  private drawMarker(m: ObjectiveMarker): void {
    const color = controllerColor(m.controller);
    const g = this.gfx;
    if (m.kind === "crate") {
      g.fillStyle(HOLO_PALETTE.warning, 0.9).fillRect(
        m.x - 10,
        m.y - 10,
        20,
        20,
      );
      return;
    }
    const fill = m.kind === "sentry" ? 0.06 + 0.2 * m.progress : 0.1;
    g.fillStyle(
      m.kind === "sentry" ? HOLO_PALETTE.danger : color,
      fill,
    ).fillCircle(m.x, m.y, m.radius);
    g.lineStyle(
      2,
      m.kind === "sentry" ? HOLO_PALETTE.danger : color,
      0.85,
    ).strokeCircle(m.x, m.y, m.radius);
    if (m.kind === "exit") g.strokeCircle(m.x, m.y, m.radius * 0.6);
    if (m.progress > 0 && m.kind !== "sentry") {
      g.lineStyle(6, color, 1)
        .beginPath()
        .arc(
          m.x,
          m.y,
          m.radius + 8,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * m.progress,
        )
        .strokePath();
    }
  }

  private drawHazard(h: HazardVisual): void {
    const g = this.gfx;
    switch (h.kind) {
      case "ion_storm":
        g.fillStyle(ION_COLOR, 0.12).fillCircle(h.x, h.y, h.radius);
        g.lineStyle(2, ION_COLOR, 0.6).strokeCircle(h.x, h.y, h.radius);
        return;
      case "asteroid_belt":
        g.fillStyle(ROCK_COLOR, 0.1).fillCircle(h.x, h.y, h.radius);
        g.lineStyle(3, ROCK_COLOR, 0.5).strokeCircle(h.x, h.y, h.radius);
        return;
      case "mine":
        g.fillStyle(
          h.harms === "enemy" ? SIDE_COLORS.ally : HOLO_PALETTE.danger,
          0.9,
        ).fillCircle(h.x, h.y, 6);
        g.lineStyle(1, HOLO_PALETTE.danger, 0.35).strokeCircle(
          h.x,
          h.y,
          h.radius,
        );
        return;
      case "flare_wall": {
        g.fillStyle(FLARE_COLOR, 0.18);
        const behind = h.direction > 0 ? h.position - FLARE_BAND : h.position;
        if (h.axis === "x")
          g.fillRect(behind, -FLARE_BAND, FLARE_BAND, FLARE_BAND * 4);
        else g.fillRect(-FLARE_BAND, behind, FLARE_BAND * 4, FLARE_BAND);
        return;
      }
    }
  }

  private drawLabels(markers: readonly ObjectiveMarker[]): void {
    const shown = markers.slice(0, MAX_LABELS);
    while (this.labels.length < shown.length) {
      this.labels.push(
        this.scene.add
          .text(0, 0, "", { fontFamily: "monospace", fontSize: "12px" })
          .setOrigin(0.5)
          .setDepth(WORLD_DEPTH),
      );
    }
    this.labels.forEach((label, i) => {
      const m = shown[i];
      if (!m) return void label.setText("").setVisible(false);
      label
        .setText(LABELS[m.kind])
        .setPosition(m.x, m.y - m.radius - 14)
        .setColor(toCssColor(controllerColor(m.controller)))
        .setVisible(true);
    });
  }
}
