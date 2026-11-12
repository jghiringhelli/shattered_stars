/**
 * RenderPoseTracker - what the screen draws for each ship, kept apart from
 * the simulation (render only: sim state, lockstep hashes and snapshots are
 * never touched).
 *
 *  - Interpolation: remembers the poses of the last two simulation steps and
 *    draws the point `alpha` of the way between them (shortest way for
 *    angles, shortest way across the arena seam for positions).
 *  - Dash glide: a boost / barrel roll moves the sim pose far more than one
 *    step of flight allows. Instead of drawing a teleport, the tracker keeps
 *    an offset equal to minus the jump that decays with ease-out, so the ship
 *    glides to its new place. A jump beyond `teleportJumpPx` (respawn,
 *    debug teleport) is not a dash and never glides; snapshot restores call
 *    {@link reset}.
 */

import { torusAxisDelta } from "../../core/Torus";
import {
  easeOutQuad,
  lerpAngleDegrees,
  lerpTorusAxis,
  shortestAngleDelta,
  wrapIntoArena,
} from "./poseMath";

/** Anything with a sim pose (a ship record). */
export interface PoseSource {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly angle: number;
}

/** A pose to draw (mutable result object, reused between calls). */
export interface RenderPose {
  x: number;
  y: number;
  angle: number;
}

/** Tuning of {@link RenderPoseTracker}. */
export interface RenderPoseTrackerOptions {
  /** Arena edge length. */
  readonly worldSize: number;
  /** Duration of a dash glide (ms). Default 180. */
  readonly dashGlideMs?: number;
  /** Smallest step (px) that can count as a dash. Default 48. */
  readonly dashMinJumpPx?: number;
  /** A step this many times longer than the flown step is a dash. Default 4. */
  readonly dashSpeedFactor?: number;
  /** A step beyond this (px) is a teleport: no glide, no interpolation. Default 400. */
  readonly teleportJumpPx?: number;
}

const DEFAULT_GLIDE_MS = 180;
const DEFAULT_DASH_MIN_JUMP_PX = 48;
const DEFAULT_DASH_SPEED_FACTOR = 4;
const DEFAULT_TELEPORT_JUMP_PX = 400;
/** Weight of the newest step in the running average of flown speed. */
const SPEED_AVERAGE_WEIGHT = 0.2;
const MS_PER_SECOND = 1000;

interface Entry {
  prevX: number;
  prevY: number;
  prevAngle: number;
  curX: number;
  curY: number;
  curAngle: number;
  /** Flown velocity of the last ordinary step (px/s). */
  vx: number;
  vy: number;
  /** Running average of flown speed (px/ms), the yardstick for "too far". */
  speedPxPerMs: number;
  glideX: number;
  glideY: number;
  glideAgeMs: number;
  readonly render: RenderPose;
}

export class RenderPoseTracker {
  private readonly entries = new Map<string, Entry>();
  private readonly glideMs: number;
  private readonly dashMinJumpPx: number;
  private readonly dashSpeedFactor: number;
  private readonly teleportJumpPx: number;
  private alpha = 1;

  /** @param options - Arena size and dash tuning. */
  constructor(private readonly options: RenderPoseTrackerOptions) {
    this.glideMs = options.dashGlideMs ?? DEFAULT_GLIDE_MS;
    this.dashMinJumpPx = options.dashMinJumpPx ?? DEFAULT_DASH_MIN_JUMP_PX;
    this.dashSpeedFactor = options.dashSpeedFactor ?? DEFAULT_DASH_SPEED_FACTOR;
    this.teleportJumpPx = options.teleportJumpPx ?? DEFAULT_TELEPORT_JUMP_PX;
  }

  /**
   * Record a ship's pose after one simulation step.
   *
   * @param source - The ship, already stepped.
   * @param stepMs - Simulation time of the step (ms): the fixed tick, or the
   *   frame time in scenes that step once per frame.
   */
  capture(source: PoseSource, stepMs: number): void {
    const entry = this.entries.get(source.id);
    if (!entry) {
      this.entries.set(source.id, seedEntry(source));
      return;
    }
    const { worldSize } = this.options;
    const dx = torusAxisDelta(entry.curX, source.x, worldSize);
    const dy = torusAxisDelta(entry.curY, source.y, worldSize);
    const jump = Math.hypot(dx, dy);
    if (jump > this.teleportJumpPx) {
      placeAt(entry, source);
      return;
    }
    const expected = entry.speedPxPerMs * stepMs;
    if (jump > this.dashMinJumpPx && jump > this.dashSpeedFactor * expected) {
      this.startGlide(entry, dx, dy);
      entry.curX = source.x;
      entry.curY = source.y;
      entry.curAngle = source.angle;
      entry.prevX = source.x;
      entry.prevY = source.y;
      entry.prevAngle = source.angle;
      return;
    }
    this.advanceStep(entry, source, dx, dy, stepMs);
  }

  /**
   * @param sources - Every ship, already stepped.
   * @param stepMs - Simulation time of the step (ms).
   */
  captureAll(sources: Iterable<PoseSource>, stepMs: number): void {
    for (const source of sources) this.capture(source, stepMs);
  }

  /**
   * Start of a rendered frame: age the dash glides and fix the blend.
   *
   * @param frameMs - Real time since the last frame (ms).
   * @param alpha - How far this frame is into the current step, 0..1 (1 for
   *   scenes whose sim already sits at render time).
   */
  beginFrame(frameMs: number, alpha: number): void {
    this.alpha = Math.min(1, Math.max(0, alpha));
    for (const entry of this.entries.values()) {
      if (entry.glideX !== 0 || entry.glideY !== 0) entry.glideAgeMs += frameMs;
      if (entry.glideAgeMs >= this.glideMs) clearGlide(entry);
    }
  }

  /**
   * @param source - A ship.
   * @returns What to draw for it this frame (a per-ship object reused by
   *   every call). Unknown ships draw their sim pose.
   */
  poseOf(source: PoseSource): RenderPose {
    const entry = this.entries.get(source.id);
    if (!entry) return { x: source.x, y: source.y, angle: source.angle };
    const { worldSize } = this.options;
    const { render } = entry;
    const { alpha } = this;
    const remaining = 1 - easeOutQuad(entry.glideAgeMs / this.glideMs);
    render.x = wrapIntoArena(
      lerpTorusAxis(entry.prevX, entry.curX, alpha, worldSize) +
        entry.glideX * remaining,
      worldSize,
    );
    render.y = wrapIntoArena(
      lerpTorusAxis(entry.prevY, entry.curY, alpha, worldSize) +
        entry.glideY * remaining,
      worldSize,
    );
    render.angle = lerpAngleDegrees(entry.prevAngle, entry.curAngle, alpha);
    return render;
  }

  /**
   * @param id - A ship id.
   * @returns Its flown velocity in px/s (dashes excluded), or null when unknown.
   */
  velocityOf(id: string): { readonly vx: number; readonly vy: number } | null {
    return this.entries.get(id) ?? null;
  }

  /** Forget everything (snapshot restore, resync, scene start): nothing glides afterwards. */
  reset(): void {
    this.entries.clear();
  }

  /** @param id - A ship that respawned or was moved on purpose: no glide for it. */
  forget(id: string): void {
    this.entries.delete(id);
  }

  private startGlide(entry: Entry, jumpX: number, jumpY: number): void {
    const remaining = 1 - easeOutQuad(entry.glideAgeMs / this.glideMs);
    entry.glideX = entry.glideX * remaining - jumpX;
    entry.glideY = entry.glideY * remaining - jumpY;
    entry.glideAgeMs = 0;
  }

  private advanceStep(
    entry: Entry,
    source: PoseSource,
    dx: number,
    dy: number,
    stepMs: number,
  ): void {
    entry.prevX = entry.curX;
    entry.prevY = entry.curY;
    entry.prevAngle = entry.curAngle;
    entry.curX = source.x;
    entry.curY = source.y;
    entry.curAngle =
      entry.prevAngle + shortestAngleDelta(entry.prevAngle, source.angle);
    if (stepMs <= 0) return;
    entry.vx = (dx / stepMs) * MS_PER_SECOND;
    entry.vy = (dy / stepMs) * MS_PER_SECOND;
    entry.speedPxPerMs +=
      (Math.hypot(dx, dy) / stepMs - entry.speedPxPerMs) * SPEED_AVERAGE_WEIGHT;
  }
}

function seedEntry(source: PoseSource): Entry {
  return {
    prevX: source.x,
    prevY: source.y,
    prevAngle: source.angle,
    curX: source.x,
    curY: source.y,
    curAngle: source.angle,
    vx: 0,
    vy: 0,
    speedPxPerMs: 0,
    glideX: 0,
    glideY: 0,
    glideAgeMs: 0,
    render: { x: source.x, y: source.y, angle: source.angle },
  };
}

function placeAt(entry: Entry, source: PoseSource): void {
  entry.prevX = entry.curX = source.x;
  entry.prevY = entry.curY = source.y;
  entry.prevAngle = entry.curAngle = source.angle;
  clearGlide(entry);
}

function clearGlide(entry: Entry): void {
  entry.glideX = 0;
  entry.glideY = 0;
  entry.glideAgeMs = 0;
}
