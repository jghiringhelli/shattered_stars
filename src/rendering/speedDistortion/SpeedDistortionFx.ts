/**
 * SpeedDistortionFx — a faint bow wave and a barely visible lengthening
 * around the player's ship while it flies at the maximum speed of its current
 * maneuver: 1–3 thin translucent compression arcs just ahead of the nose that
 * drift back along the hull, and a soft lens stretched along the heading.
 *
 * Render-only (driven by the control state's target intensity, clocked by the
 * scene time, never touching the simulation). Plain Graphics, one pooled
 * object, so it works in WebGL and Canvas; hidden and free when idle. With
 * Reduce Motion it is a static faint lens (no drifting arcs).
 */

import Phaser from "phaser";
import { isMotionReduced } from "../../ui/settings/motionComfort";
import { HOLO_DEPTH } from "../../ui/theme/HoloTheme";
import {
  bowArcsAt,
  createBowArcs,
  smoothSpeedDistortion,
} from "./speedDistortionMath";

/** Hull radius used until the scene says otherwise (world px). */
const DEFAULT_RADIUS = 32;
/** Longest frame step the fade honours (a paused tab must not skip it). */
const MAX_STEP_MS = 100;
/** Below this shown intensity the effect is hidden. */
const HIDDEN_BELOW = 0.004;
const WAVE_COLOR = 0xcfeaff;
const WAVE_ALPHA = 0.34;
const HAZE_ALPHA = 0.1;
const LENS_ALPHA = 0.09;
/** Reduce Motion: the lens stays at this fraction of its animated alpha. */
const STATIC_LENS_SCALE = 0.7;
const WAVE_WIDTH_PX = 1.5;
const HAZE_WIDTH_PX = 4;

/** Pose of the ship the effect follows. */
export interface SpeedDistortionPose {
  readonly x: number;
  readonly y: number;
  /** Degrees, 0 = up, clockwise. */
  readonly angle: number;
}

/** World-space speed distortion for the player ship. */
export class SpeedDistortionFx {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly arcs = createBowArcs();
  private readonly radius: number;
  private shown = 0;
  private lastNowMs = Number.NaN;

  /**
   * @param scene - Owning scene.
   * @param radius - Hull radius in world px.
   */
  constructor(scene: Phaser.Scene, radius: number = DEFAULT_RADIUS) {
    this.radius = radius;
    this.graphics = scene.add
      .graphics()
      .setDepth(HOLO_DEPTH.worldOverlay - 1)
      .setVisible(false);
  }

  /** @returns The intensity currently drawn (0..1). */
  get intensity(): number {
    return this.shown;
  }

  /**
   * Fade toward `target` and redraw around the ship.
   *
   * @param target - Wanted intensity 0..1 (0 when the ship is gone).
   * @param pose - The ship's pose; ignored while the effect is idle.
   * @param zoom - Camera zoom (stroke compensation).
   * @param nowMs - Scene clock in ms.
   */
  update(
    target: number,
    pose: SpeedDistortionPose | null,
    zoom: number,
    nowMs: number,
  ): void {
    const step = Number.isNaN(this.lastNowMs)
      ? 0
      : Math.min(MAX_STEP_MS, Math.max(0, nowMs - this.lastNowMs));
    this.lastNowMs = nowMs;
    this.shown = smoothSpeedDistortion(
      this.shown,
      pose === null ? 0 : target,
      step,
    );
    if (this.shown < HIDDEN_BELOW || pose === null) {
      this.hide();
      return;
    }
    this.draw(pose, zoom > 0 ? 1 / zoom : 1, nowMs / 1000);
  }

  /** Hide the effect (idle, ship gone, or the HUD hidden). */
  hide(): void {
    if (!this.graphics.visible) return;
    this.graphics.clear();
    this.graphics.setVisible(false);
  }

  /** Destroy the Graphics. */
  destroy(): void {
    this.graphics.destroy();
  }

  private draw(pose: SpeedDistortionPose, px: number, seconds: number): void {
    const g = this.graphics;
    const r = this.radius;
    const level = this.shown;
    g.clear();
    g.setVisible(true);
    g.setPosition(pose.x, pose.y).setAngle(pose.angle);
    const reduced = isMotionReduced();
    // The lens: a soft ellipse stretched along the heading (nose is -y).
    g.fillStyle(
      WAVE_COLOR,
      LENS_ALPHA * level * (reduced ? STATIC_LENS_SCALE : 1),
    );
    g.fillEllipse(0, -r * 0.2, r * 1.1, r * 3);
    if (reduced) return;
    bowArcsAt(seconds, this.arcs);
    for (const arc of this.arcs) {
      const alpha = level * arc.fade;
      if (alpha <= 0.002) continue;
      const centre = -Math.PI / 2;
      const radius = r * (1 + arc.ahead);
      g.lineStyle(HAZE_WIDTH_PX * px, WAVE_COLOR, HAZE_ALPHA * alpha);
      this.strokeBow(radius, centre, arc.halfWidth);
      g.lineStyle(WAVE_WIDTH_PX * px, WAVE_COLOR, WAVE_ALPHA * alpha);
      this.strokeBow(radius, centre, arc.halfWidth);
    }
  }

  private strokeBow(radius: number, centre: number, halfWidth: number): void {
    const g = this.graphics;
    g.beginPath();
    g.arc(0, 0, radius, centre - halfWidth, centre + halfWidth, false);
    g.strokePath();
  }
}
