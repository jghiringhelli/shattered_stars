/**
 * ManeuverCueFx — a small glyph and label beside the player's ship for ~1 s
 * after it performs a Snap Turn, Hook Loop, Knife Roll, Boost or Barrel Roll
 * (SNAP / HOOK / KNIFE / BOOST / ROLL, with a side arrow for hook, knife and
 * roll), plus 2–3 faint afterimages and a short streak along the displacement
 * for ~250 ms.
 *
 * Render-only: events are read from the control state of consecutive frames
 * (see maneuverCueMath), clocked by the scene time, never touching the
 * simulation. One pooled Graphics and one Text, idle and free when no cue
 * runs. With Reduce Motion it shows the static glyph and label only.
 */

import Phaser from "phaser";
import { isMotionReduced } from "../../ui/settings/motionComfort";
import { toCssColor } from "../../ui/theme/colorMath";
import { HOLO_DEPTH, HOLO_PALETTE } from "../../ui/theme/HoloTheme";
import { holoFont } from "../../ui/theme/holoFont";
import {
  CUE_TOTAL_MS,
  GHOST_COUNT,
  GHOST_LIFE_MS,
  cueAlpha,
  cueGlyph,
  cueLabel,
  cueUsesSide,
  detectManeuverEvent,
  ghostAlpha,
  type ManeuverCueKind,
  type ManeuverCueSide,
  type ManeuverSignals,
  type MotionPose,
} from "./maneuverCueMath";
import { drawCueGlyph } from "./maneuverGlyphs";
import { PoseTrail, type PoseSample } from "./poseTrail";

/** Hull radius used until the scene says otherwise (world px). */
const DEFAULT_RADIUS = 32;
/** Glyph half-extent in screen px. */
const GLYPH_HALF_PX = 9;
const LINE_PX = 2;
const STREAK_PX = 3;
const LABEL_SIZE_PX = 12;
/** Label starts this far right of the glyph's edge (screen px). */
const LABEL_GAP_PX = 5;
const SIDE_ARROW_PX = 5;
/** Gap between the status ring and the glyph (screen px). */
const RING_GAP_PX = 13;
/** Afterimages of a special maneuver follow the ship this far apart (ms). */
const TRAIL_SPACING_MS = 70;
const TRAIL_CAPACITY = 40;
/** Afterimages and streaks further than this from the ship wrapped across the seam (world px). */
const MAX_GHOST_REACH_PX = 500;
const GHOST_HULL_UNITS = 0.8;
const GHOST_LINE_PX = 1.5;

const KIND_COLORS: Readonly<Record<ManeuverCueKind, () => number>> = {
  snap: () => HOLO_PALETTE.accent,
  hook: () => HOLO_PALETTE.shield,
  knife: () => HOLO_PALETTE.warning,
  boost: () => HOLO_PALETTE.success,
  roll: () => HOLO_PALETTE.textPrimary,
};

/** One frame of what the cue needs. */
export interface ManeuverCueFrame {
  /** The player's control signals; null when no ship flies. */
  readonly signals: ManeuverSignals | null;
  readonly pose: MotionPose | null;
  /** Torus side length (<= 0 for an unwrapped plane). */
  readonly worldSize: number;
  readonly zoom: number;
  /** Scene clock in ms. */
  readonly nowMs: number;
}

/** World-space maneuver cue for the player ship. */
export class ManeuverCueFx {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly radius: number;
  private readonly trail = new PoseTrail(TRAIL_CAPACITY);
  private readonly sample: PoseSample = { x: 0, y: 0, angle: 0 };
  private readonly previousPose: PoseSample = { x: 0, y: 0, angle: 0 };
  private readonly dashFrom: PoseSample = { x: 0, y: 0, angle: 0 };
  private readonly dashTo: PoseSample = { x: 0, y: 0, angle: 0 };
  private previousSignals: ManeuverSignals | null = null;
  private kind: ManeuverCueKind | null = null;
  private side: ManeuverCueSide = null;
  private startMs = 0;
  private sequence = 0;

  /**
   * @param scene - Owning scene.
   * @param radius - Status ring radius in world px (the cue sits outside it).
   */
  constructor(scene: Phaser.Scene, radius: number = DEFAULT_RADIUS) {
    this.radius = radius;
    const depth = HOLO_DEPTH.worldOverlay + 1;
    this.graphics = scene.add.graphics().setDepth(depth).setVisible(false);
    this.label = scene.add
      .text(0, 0, "", { ...holoFont(LABEL_SIZE_PX, "700") })
      .setOrigin(0, 0.5)
      .setDepth(depth)
      .setVisible(false);
  }

  /** @returns How many cues have started (test / debug). */
  get cueCount(): number {
    return this.sequence;
  }

  /** @returns True while a cue is on screen. */
  get isShowing(): boolean {
    return this.graphics.visible;
  }

  /**
   * Notice a new event and redraw the running cue.
   *
   * @param frame - Control signals, pose, world size, zoom and clock.
   */
  update(frame: ManeuverCueFrame): void {
    const { signals, pose } = frame;
    if (signals === null || pose === null) {
      this.reset();
      return;
    }
    if (this.previousSignals === null) this.copyPose(this.previousPose, pose);
    const event = detectManeuverEvent({
      prev: this.previousSignals,
      next: signals,
      prevPose: this.previousPose,
      nextPose: pose,
      worldSize: frame.worldSize,
    });
    if (event !== null) this.start(event, frame);
    this.previousSignals = signals;
    this.copyPose(this.previousPose, pose);
    this.trail.push(frame.nowMs, pose);
    this.draw(frame);
  }

  /** Hide the cue and forget the running event. */
  hide(): void {
    this.reset();
  }

  /** Destroy the game objects. */
  destroy(): void {
    this.graphics.destroy();
    this.label.destroy();
  }

  private reset(): void {
    this.previousSignals = null;
    this.kind = null;
    this.trail.clear();
    this.hideObjects();
  }

  private hideObjects(): void {
    if (!this.graphics.visible) return;
    this.graphics.clear();
    this.graphics.setVisible(false);
    this.label.setVisible(false);
  }

  private start(
    event: { readonly kind: ManeuverCueKind; readonly side: ManeuverCueSide },
    frame: ManeuverCueFrame,
  ): void {
    this.kind = event.kind;
    this.side = event.side;
    this.startMs = frame.nowMs;
    this.sequence += 1;
    this.copyPose(this.dashFrom, this.previousPose);
    this.copyPose(this.dashTo, frame.pose!);
    this.label.setText(cueLabel(event.kind));
    this.label.setColor(toCssColor(KIND_COLORS[event.kind]()));
  }

  private copyPose(target: PoseSample, source: MotionPose): void {
    target.x = source.x;
    target.y = source.y;
    target.angle = source.angle;
  }

  private draw(frame: ManeuverCueFrame): void {
    const age = frame.nowMs - this.startMs;
    if (this.kind === null || age >= CUE_TOTAL_MS) {
      this.kind = null;
      this.hideObjects();
      return;
    }
    const px = frame.zoom > 0 ? 1 / frame.zoom : 1;
    const pose = frame.pose!;
    const g = this.graphics;
    g.clear();
    g.setVisible(true);
    this.label.setVisible(true);
    if (!isMotionReduced() && age < GHOST_LIFE_MS) this.drawGhosts(frame, age, px);
    this.drawGlyphAndLabel(pose, cueAlpha(age), px);
  }

  private drawGlyphAndLabel(pose: MotionPose, alpha: number, px: number): void {
    const kind = this.kind!;
    const color = KIND_COLORS[kind]();
    const size = GLYPH_HALF_PX * px;
    const cx = pose.x + this.radius * 0.75 + (RING_GAP_PX + GLYPH_HALF_PX) * px;
    const cy = pose.y - this.radius * 0.75 - 3 * px;
    drawCueGlyph(this.graphics, {
      glyph: cueGlyph(kind),
      side: this.side,
      x: cx,
      y: cy,
      size,
      color,
      alpha,
      lineWidth: LINE_PX * px,
    });
    const labelX = cx + size + LABEL_GAP_PX * px;
    this.label.setScale(px).setAlpha(alpha).setPosition(labelX, cy);
    if (cueUsesSide(kind) && this.side !== null) {
      this.drawSideArrow({ x: labelX + this.label.width * px, y: cy }, color, alpha, px);
    }
  }

  private drawSideArrow(
    from: { readonly x: number; readonly y: number },
    color: number,
    alpha: number,
    px: number,
  ): void {
    const left = this.side === "left";
    const half = SIDE_ARROW_PX * px;
    const baseX = from.x + 4 * px;
    const tipX = left ? baseX : baseX + 2 * half;
    const backX = left ? baseX + 2 * half : baseX;
    const g = this.graphics;
    g.fillStyle(color, alpha);
    g.fillTriangle(tipX, from.y, backX, from.y - half, backX, from.y + half);
  }

  private drawGhosts(frame: ManeuverCueFrame, age: number, px: number): void {
    const pose = frame.pose!;
    const dash = this.kind === "boost" || this.kind === "roll";
    if (dash) this.drawStreak(age, px);
    for (let i = 0; i < GHOST_COUNT; i++) {
      const known = dash
        ? this.dashSample(i)
        : this.trail.sampleAt(frame.nowMs - (i + 1) * TRAIL_SPACING_MS, this.sample);
      if (!known) continue;
      if (Math.hypot(this.sample.x - pose.x, this.sample.y - pose.y) > MAX_GHOST_REACH_PX) continue;
      this.drawGhost(ghostAlpha(age, i), px);
    }
  }

  /** Afterimage i of a dash: evenly spaced along the displacement, nearest the ship first. */
  private dashSample(i: number): boolean {
    const f = 1 - (i + 1) / (GHOST_COUNT + 1);
    this.sample.x = this.dashFrom.x + (this.dashTo.x - this.dashFrom.x) * f;
    this.sample.y = this.dashFrom.y + (this.dashTo.y - this.dashFrom.y) * f;
    this.sample.angle = this.dashTo.angle;
    return true;
  }

  private drawStreak(age: number, px: number): void {
    const { dashFrom, dashTo } = this;
    if (Math.hypot(dashTo.x - dashFrom.x, dashTo.y - dashFrom.y) > MAX_GHOST_REACH_PX) return;
    const g = this.graphics;
    g.lineStyle(STREAK_PX * px, KIND_COLORS[this.kind!](), ghostAlpha(age, 0));
    g.beginPath();
    g.moveTo(dashFrom.x, dashFrom.y);
    g.lineTo(dashTo.x, dashTo.y);
    g.strokePath();
  }

  /** A faint hull outline (nose, right wing, tail notch, left wing) at `this.sample`. */
  private drawGhost(alpha: number, px: number): void {
    const { x, y, angle } = this.sample;
    const r = this.radius * GHOST_HULL_UNITS;
    const a = (angle * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const g = this.graphics;
    g.lineStyle(GHOST_LINE_PX * px, KIND_COLORS[this.kind!](), alpha);
    g.beginPath();
    g.moveTo(x + sin * r, y - cos * r);
    g.lineTo(x + (cos * 0.5 - sin * 0.6) * r, y + (sin * 0.5 + cos * 0.6) * r);
    g.lineTo(x - sin * 0.3 * r, y + cos * 0.3 * r);
    g.lineTo(x + (-cos * 0.5 - sin * 0.6) * r, y + (-sin * 0.5 + cos * 0.6) * r);
    g.closePath();
    g.strokePath();
  }
}
