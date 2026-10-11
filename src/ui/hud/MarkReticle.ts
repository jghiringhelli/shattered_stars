/**
 * MarkReticle — the squad mark in the world: a red bracket-and-crosshair
 * reticle around every live marked ship, drawn at the ship's torus image
 * nearest the camera so it sits on the ship the player sees. The reticle
 * hugs the ship (world radius) but never shrinks below a readable size on
 * screen; strokes are divided by zoom so they keep their on-screen width.
 * One Graphics, cleared and redrawn per update.
 */

import Phaser from "phaser";
import { HOLO_DEPTH } from "../theme/HoloTheme";
import { drawMarkReticle } from "./markGlyphs";
import {
  markedContacts,
  markReticleWorldRadius,
  nearestImage,
} from "./markMath";
import type { CameraViewSnapshot, ContactHudState } from "./types";

/** Reticle stroke width in screen px. */
const LINE_SCREEN_PX = 2;

/** MarkReticle options. */
export interface MarkReticleConfig {
  /** Torus side length (<= 0 for an unwrapped plane). */
  readonly worldSize: number;
  /** Display depth. Default: HOLO_DEPTH.worldOverlay. */
  readonly depth?: number | undefined;
}

/** World-space reticles on marked ships. */
export class MarkReticle {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly worldSize: number;
  private count = 0;

  /**
   * @param scene - Owning scene.
   * @param config - World size and depth.
   */
  constructor(scene: Phaser.Scene, config: MarkReticleConfig) {
    this.worldSize = config.worldSize;
    this.graphics = scene.add
      .graphics()
      .setDepth(config.depth ?? HOLO_DEPTH.worldOverlay);
  }

  /** Number of reticles drawn by the last update. */
  get activeCount(): number {
    return this.count;
  }

  /**
   * Redraw a reticle on every live marked contact.
   *
   * @param camera - Camera view (centre picks the torus image, zoom the size).
   * @param contacts - HUD contacts.
   */
  update(
    camera: CameraViewSnapshot,
    contacts: ReadonlyArray<ContactHudState>,
  ): void {
    const g = this.graphics;
    g.clear();
    const marked = markedContacts(contacts);
    const anchor = { x: camera.centerX, y: camera.centerY };
    for (const contact of marked) {
      const at = nearestImage(anchor, contact.pose, this.worldSize);
      const radius = markReticleWorldRadius(contact.sizeClass, camera.zoom);
      drawMarkReticle(g, at.x, at.y, radius, LINE_SCREEN_PX / camera.zoom);
    }
    this.count = marked.length;
  }

  /**
   * @param visible - Visibility.
   */
  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  /** Destroy the reticle graphics. */
  destroy(): void {
    this.graphics.destroy();
  }
}
