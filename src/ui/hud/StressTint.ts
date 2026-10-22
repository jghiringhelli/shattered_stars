/**
 * StressTint — a subtle red screen-edge glow under the HUD panels that
 * follows the stress state (see stressTintMath). Render only; hidden (and
 * free) when calm. No pulse: the opacity eases monotonically to its target,
 * or steps there under Reduce Motion.
 *
 * Origin: children live in the HUD root's screen-pixel space (0,0 = top-left).
 */

import Phaser from "phaser";
import { isMotionReduced } from "../settings/motionComfort";
import { HOLO_PALETTE } from "../theme/HoloTheme";
import type { StressTrack } from "./stressState";
import {
  EDGE_BAND_COUNT,
  edgeBandAlpha,
  smoothTintAlpha,
  stressTintAlpha,
} from "./stressTintMath";

/** Depth of the glow from each screen edge, in px. */
const EDGE_DEPTH = 110;
/** Opacity change worth a redraw. */
const REDRAW_STEP = 0.004;

/** Screen-edge stress glow. */
export class StressTint {
  /** Add to the HUD root BEFORE the panels so it draws beneath them. */
  readonly graphics: Phaser.GameObjects.Graphics;
  private alpha = 0;
  private drawnAlpha = -1;
  private width = 0;
  private height = 0;

  /** @param scene - Owning scene. */
  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setScrollFactor(0).setVisible(false);
  }

  /**
   * Resize to the screen.
   *
   * @param width - Screen width in px.
   * @param height - Screen height in px.
   */
  setSize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.drawnAlpha = -1;
  }

  /** Current drawn opacity (tests and debug hooks). */
  get currentAlpha(): number {
    return this.alpha;
  }

  /**
   * Follow the stress state.
   *
   * @param track - Stress state.
   * @param level - Stress level 0..1.
   */
  update(track: StressTrack, level: number): void {
    const reduced = isMotionReduced();
    const target = stressTintAlpha(track, level, reduced);
    this.alpha = smoothTintAlpha(this.alpha, target, reduced);
    if (this.alpha <= 0) {
      if (this.graphics.visible) this.graphics.setVisible(false).clear();
      this.drawnAlpha = -1;
      return;
    }
    this.graphics.setVisible(true);
    if (Math.abs(this.alpha - this.drawnAlpha) >= REDRAW_STEP) this.redraw();
  }

  private redraw(): void {
    this.drawnAlpha = this.alpha;
    const g = this.graphics;
    g.clear();
    const step = EDGE_DEPTH / EDGE_BAND_COUNT;
    const { width: w, height: h } = this;
    for (let i = 0; i < EDGE_BAND_COUNT; i++) {
      g.fillStyle(HOLO_PALETTE.danger, edgeBandAlpha(i, this.alpha));
      const d = i * step;
      g.fillRect(0, d, w, step);
      g.fillRect(0, h - d - step, w, step);
      g.fillRect(d, 0, step, h);
      g.fillRect(w - d - step, 0, step, h);
    }
  }
}
