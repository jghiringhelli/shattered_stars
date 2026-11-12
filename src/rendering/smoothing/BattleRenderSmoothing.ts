/**
 * BattleRenderSmoothing - the one render-smoothing layer of every battle
 * scene that follows a ship: pose interpolation + dash glide for the sprites
 * ({@link RenderPoseTracker}) and the frame-rate independent camera follow
 * with speed-based zoom ({@link CameraFollowFilter}).
 *
 * Per scene: build one in `create()`, call {@link capture} after each sim
 * step, {@link beginFrame} at the start of the render part of a frame, draw
 * ships at {@link poseOf} (or {@link place}), and call {@link stepCamera}
 * before anything that projects world positions to the screen (HUD, radar,
 * overlays).
 */

import {
  CameraFollowFilter,
  type CameraFollowOptions,
} from "./CameraFollowFilter";
import {
  RenderPoseTracker,
  type PoseSource,
  type RenderPose,
  type RenderPoseTrackerOptions,
} from "./RenderPoseTracker";

/** The parts of a Phaser camera the follow drives. */
export interface FollowCamera {
  readonly zoom: number;
  centerOn(x: number, y: number): unknown;
  setZoom(zoom: number): unknown;
}

/** What the camera looks at: a ship (by id, so it is smoothed) or a bare point. */
export interface CameraFocus {
  readonly id?: string | undefined;
  readonly x: number;
  readonly y: number;
}

/** Per-frame camera options. */
export interface StepCameraOptions {
  /** Zoom to ease toward (slowly), or omitted to leave the zoom to the scene. */
  readonly zoomTarget?: number;
  /** Simulation seconds per real second (debug fast-forward). Default 1. */
  readonly simSpeed?: number;
}

/** Optional tuning of the whole layer. */
export interface BattleRenderSmoothingTuning {
  readonly pose?: Omit<RenderPoseTrackerOptions, "worldSize">;
  readonly camera?: Omit<CameraFollowOptions, "worldSize">;
}

/** A game object that can be moved (a health bar, a label). */
export interface Movable {
  setPosition(x: number, y: number): unknown;
}

/** A game object that can be moved and turned (a ship sprite). */
export interface Turnable extends Movable {
  setAngle(degrees: number): unknown;
}

export class BattleRenderSmoothing {
  private readonly poses: RenderPoseTracker;
  private readonly follow: CameraFollowFilter;
  private readonly sample = { x: 0, y: 0, vx: 0, vy: 0 };

  /**
   * @param camera - The scene's main camera.
   * @param worldSize - Arena edge length.
   * @param tuning - Optional dash-glide and follow tuning.
   */
  constructor(
    private readonly camera: FollowCamera,
    worldSize: number,
    tuning: BattleRenderSmoothingTuning = {},
  ) {
    this.poses = new RenderPoseTracker({ worldSize, ...tuning.pose });
    this.follow = new CameraFollowFilter({ worldSize, ...tuning.camera });
  }

  /**
   * @param ship - A ship after one simulation step.
   * @param stepMs - Simulation time of that step (ms).
   */
  capture(ship: PoseSource, stepMs: number): void {
    this.poses.capture(ship, stepMs);
  }

  /**
   * @param ships - Every ship after one simulation step.
   * @param stepMs - Simulation time of that step (ms).
   */
  captureAll(ships: Iterable<PoseSource>, stepMs: number): void {
    this.poses.captureAll(ships, stepMs);
  }

  /**
   * @param frameMs - Real time since the last frame (ms).
   * @param alpha - Fraction of the current step the frame is into (1 when
   *   the sim steps once per frame, so it already sits at render time).
   */
  beginFrame(frameMs: number, alpha = 1): void {
    this.poses.beginFrame(frameMs, alpha);
  }

  /**
   * @param ship - A ship.
   * @returns The pose to draw it at (interpolated, dash glide applied).
   */
  poseOf(ship: PoseSource): RenderPose {
    return this.poses.poseOf(ship);
  }

  /**
   * Draw a ship: move its sprite to the pose and an overlay above it.
   *
   * @param ship - The ship.
   * @param sprite - Its sprite (nothing when it has none).
   * @param overlay - A bar or label that follows the ship.
   * @param overlayOffsetY - Where the overlay sits relative to the ship (px).
   * @returns The pose drawn.
   */
  place(
    ship: PoseSource,
    sprite: Turnable | undefined,
    overlay?: Movable,
    overlayOffsetY = 0,
  ): RenderPose {
    const pose = this.poses.poseOf(ship);
    if (sprite) {
      sprite.setPosition(pose.x, pose.y);
      sprite.setAngle(pose.angle);
    }
    overlay?.setPosition(pose.x, pose.y + overlayOffsetY);
    return pose;
  }

  /**
   * Move the camera one frame toward the focus.
   *
   * @param frameMs - Real time since the last frame (ms).
   * @param focus - What to look at; null holds the camera.
   * @param options - Zoom target and sim speed.
   */
  stepCamera(
    frameMs: number,
    focus: CameraFocus | null,
    options: StepCameraOptions = {},
  ): void {
    if (!focus) return;
    const { sample, follow, camera } = this;
    const tracked = focus.id !== undefined;
    const pose = tracked
      ? this.poses.poseOf({ id: focus.id!, x: focus.x, y: focus.y, angle: 0 })
      : focus;
    const velocity = tracked ? this.poses.velocityOf(focus.id!) : null;
    const simSpeed = options.simSpeed ?? 1;
    sample.x = pose.x;
    sample.y = pose.y;
    sample.vx = (velocity?.vx ?? 0) * simSpeed;
    sample.vy = (velocity?.vy ?? 0) * simSpeed;
    follow.zoom = camera.zoom;
    follow.step(sample, frameMs, options.zoomTarget ?? null);
    if (options.zoomTarget !== undefined) camera.setZoom(follow.zoom);
    camera.centerOn(follow.x, follow.y);
  }

  /**
   * A discontinuity (snapshot restore, resync, scene start): nothing glides
   * and the camera jumps to its focus on the next step.
   */
  reset(): void {
    this.poses.reset();
    this.follow.snapNext();
  }

  /** @param shipId - A ship that respawned: it must not glide from its old place. */
  forget(shipId: string): void {
    this.poses.forget(shipId);
  }
}
