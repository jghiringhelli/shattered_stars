/**
 * RepairDroneView — draws every in-flight repair drone into ONE Graphics
 * object (a single draw call, nothing created per frame). Procedural art:
 * a small glowing body, a faint welding beam to the repaired hull while
 * orbiting, and flickering sparks at the weld point.
 */

import type Phaser from "phaser";
import { HOLO_DEPTH, HOLO_PALETTE } from "../../ui/theme/HoloTheme";
import type { DroneSlot } from "./RepairDronePool";

/** Drawn just under the ship overlays, above the ships. */
export const DRONE_DEPTH = HOLO_DEPTH.worldOverlay - 1;

/** Drone body radius (world px). */
const BODY_RADIUS = 2.2;
/** Glow halo radius around the body. */
const HALO_RADIUS = 4;
/** Halo opacity. */
const HALO_ALPHA = 0.25;
/** Welding beam opacity. */
const BEAM_ALPHA = 0.35;
/** Spark flicker period (ms): sparks show for half of each period. */
const SPARK_PERIOD_MS = 90;
/** Spark arm length. */
const SPARK_SIZE = 2.5;
/** Where along the drone→hull line the weld point sits (0 drone, 1 hull). */
const WELD_POINT = 0.6;

/** Draws the drone pool's active slots. */
export class RepairDroneView {
  private readonly graphics: Phaser.GameObjects.Graphics;

  /**
   * @param scene - The battle scene.
   */
  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(DRONE_DEPTH);
  }

  /**
   * Redraw every active drone.
   * @param slots - The pool's slots (inactive ones are skipped).
   */
  render(slots: ReadonlyArray<DroneSlot>): void {
    const g = this.graphics;
    g.clear();
    for (const slot of slots) {
      if (!slot.active || !slot.positioned) continue;
      if (slot.phase === "orbit") this.drawWeld(slot);
      g.fillStyle(HOLO_PALETTE.accent, HALO_ALPHA);
      g.fillCircle(slot.x, slot.y, HALO_RADIUS);
      g.fillStyle(HOLO_PALETTE.textPrimary, 1);
      g.fillCircle(slot.x, slot.y, BODY_RADIUS);
    }
  }

  /** Destroy the graphics object. */
  destroy(): void {
    this.graphics.destroy();
  }

  /**
   * Welding beam to the hull and flickering sparks at the weld point.
   * @param slot - An orbiting drone.
   */
  private drawWeld(slot: DroneSlot): void {
    const g = this.graphics;
    g.lineStyle(1, HOLO_PALETTE.success, BEAM_ALPHA);
    g.lineBetween(slot.x, slot.y, slot.target.x, slot.target.y);
    const flickerOn =
      Math.floor(slot.elapsedMs / (SPARK_PERIOD_MS / 2)) % 2 === 0;
    if (!flickerOn) return;
    const wx = slot.x + (slot.target.x - slot.x) * WELD_POINT;
    const wy = slot.y + (slot.target.y - slot.y) * WELD_POINT;
    g.lineStyle(1, HOLO_PALETTE.warning, 1);
    g.lineBetween(wx - SPARK_SIZE, wy, wx + SPARK_SIZE, wy);
    g.lineBetween(wx, wy - SPARK_SIZE, wx, wy + SPARK_SIZE);
  }
}
