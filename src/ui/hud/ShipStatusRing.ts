/**
 * ShipStatusRing — subtle gauges drawn around the player ship in world
 * space: shields (left, one segment per shield point), hull (right),
 * stress (bottom, calm → stressed colour ramp) and speed (top, thin).
 *
 * The ring hugs the ship (radius in world px) while stroke widths are
 * divided by camera zoom so lines stay the same on-screen thickness at any
 * zoom. One Graphics, cleared and redrawn per update.
 */

import Phaser from "phaser";
import { STRESS_HIGH } from "../../arcade/ArcadeStress";
import { HOLO_DEPTH, HOLO_PALETTE } from "../theme/HoloTheme";
import { mixColorStops } from "../theme/colorMath";
import {
  gaugeArc,
  gaugeFraction,
  hullStatus,
  segmentArcs,
  segmentFill,
  stressBlend,
  type ArcSpan,
} from "./hudStyleMath";
import type { PlayerHudState } from "./types";

/** Gauge placement in degrees (0 = right, 90 = down) and screen-px stroke width. */
const GAUGES = {
  shield: { centerDeg: 180, sweepDeg: 110, width: 3, segmentGapDeg: 5 },
  hull: { centerDeg: 0, sweepDeg: 110, width: 3 },
  stress: { centerDeg: 90, sweepDeg: 56, width: 2.5, stressedWidthScale: 1.5 },
  speed: { centerDeg: 270, sweepDeg: 50, width: 1.5 },
} as const;
/** Above this many shield points the shield gauge is continuous. */
const MAX_SHIELD_SEGMENTS = 10;
/** Calm → building → stressed colour ramp (live tokens). */
function stressRamp(): readonly number[] {
  return [
    HOLO_PALETTE.textSecondary,
    HOLO_PALETTE.warning,
    HOLO_PALETTE.danger,
  ];
}
/** Hull status colours (live tokens). */
function hullColor(status: "healthy" | "damaged" | "critical"): number {
  if (status === "healthy") return HOLO_PALETTE.success;
  return status === "damaged" ? HOLO_PALETTE.warning : HOLO_PALETTE.danger;
}
/**
 * Critical hull blinks (a non-colour backup for colourblind players):
 * the hull gauge alternates between full and dimmed alpha at this period.
 */
const CRITICAL_BLINK_MS = 500;
const CRITICAL_BLINK_DIM_ALPHA = 0.35;
/** Default ring radius in world px. */
const DEFAULT_RADIUS = 32;
/** Gauge opacity — subtle overlay on the ship. */
const GAUGE_ALPHA = 0.9;
/** Shield segment opacity when empty (beyond the track). */
const EMPTY_SEGMENT_ALPHA = 0.1;

/** Ring options. */
export interface ShipStatusRingConfig {
  /** Ring radius in world px. Default: 32. */
  readonly radius?: number | undefined;
  /** Display depth. Default: HOLO_DEPTH.worldOverlay. */
  readonly depth?: number | undefined;
}

/** Player fields the ring reads. */
export type ShipStatusRingState = Pick<
  PlayerHudState,
  | "pose"
  | "hull"
  | "maxHull"
  | "shields"
  | "maxShields"
  | "stress"
  | "isStressed"
  | "speed"
  | "maxSpeed"
>;

/** World-space status ring that follows the player ship. */
export class ShipStatusRing {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private radius: number;
  private shieldSegments: ArcSpan[] = [];
  private shieldSegmentCount = -1;

  /**
   * @param scene - Owning scene.
   * @param config - Radius and depth.
   */
  constructor(scene: Phaser.Scene, config: ShipStatusRingConfig = {}) {
    this.radius = config.radius ?? DEFAULT_RADIUS;
    this.graphics = scene.add
      .graphics()
      .setDepth(config.depth ?? HOLO_DEPTH.worldOverlay);
  }

  /**
   * Set the ring radius (world px), e.g. when the player changes ship size.
   *
   * @param radius - New radius.
   */
  setRadius(radius: number): void {
    this.radius = radius;
  }

  /**
   * Show or hide the ring.
   *
   * @param visible - Visibility.
   */
  setVisible(visible: boolean): void {
    this.graphics.setVisible(visible);
  }

  /**
   * Move to the ship and redraw every gauge.
   *
   * @param state - Player status.
   * @param zoom - Current camera zoom (stroke compensation).
   */
  update(state: ShipStatusRingState, zoom: number): void {
    const px = zoom > 0 ? 1 / zoom : 1;
    const g = this.graphics;
    g.clear();
    g.setPosition(state.pose.x, state.pose.y);
    this.drawShields(state, px);
    const hullFraction = gaugeFraction(state.hull, state.maxHull);
    const status = hullStatus(hullFraction);
    this.drawGauge(
      GAUGES.hull,
      hullFraction,
      { color: hullColor(status), alpha: this.hullAlpha(status) },
      GAUGES.hull.width * px,
      true,
    );
    const blend = stressBlend(state.stress, state.isStressed, STRESS_HIGH);
    const stressWidth =
      GAUGES.stress.width *
      px *
      (state.isStressed ? GAUGES.stress.stressedWidthScale : 1);
    this.drawGauge(
      GAUGES.stress,
      state.stress,
      { color: mixColorStops(stressRamp(), blend) },
      stressWidth,
      true,
    );
    this.drawGauge(
      GAUGES.speed,
      gaugeFraction(state.speed, state.maxSpeed),
      { color: HOLO_PALETTE.textSecondary },
      GAUGES.speed.width * px,
      false,
    );
  }

  /** Destroy the underlying Graphics. */
  destroy(): void {
    this.graphics.destroy();
  }

  /**
   * @param status - Hull status.
   * @returns Gauge alpha — critical hull blinks so it never relies on colour alone.
   */
  private hullAlpha(status: "healthy" | "damaged" | "critical"): number {
    if (status !== "critical") return GAUGE_ALPHA;
    const now = this.graphics.scene?.time?.now ?? 0;
    const lit = Math.floor(now / CRITICAL_BLINK_MS) % 2 === 0;
    return lit ? GAUGE_ALPHA : CRITICAL_BLINK_DIM_ALPHA;
  }

  private drawGauge(
    gauge: { readonly centerDeg: number; readonly sweepDeg: number },
    fill: number,
    style: { readonly color: number; readonly alpha?: number },
    width: number,
    fromEnd: boolean,
  ): void {
    this.strokeArc(
      gaugeArc(gauge.centerDeg, gauge.sweepDeg, 1),
      width,
      HOLO_PALETTE.track,
      HOLO_PALETTE.trackAlpha,
    );
    this.strokeArc(
      gaugeArc(gauge.centerDeg, gauge.sweepDeg, fill, fromEnd),
      width,
      style.color,
      style.alpha ?? GAUGE_ALPHA,
    );
  }

  private drawShields(state: ShipStatusRingState, px: number): void {
    const width = GAUGES.shield.width * px;
    const max = Math.max(0, Math.floor(state.maxShields));
    if (max === 0) return;
    if (max > MAX_SHIELD_SEGMENTS) {
      this.drawGauge(
        GAUGES.shield,
        gaugeFraction(state.shields, state.maxShields),
        { color: HOLO_PALETTE.shield },
        width,
        false,
      );
      return;
    }
    this.ensureShieldSegments(max);
    this.shieldSegments.forEach((span, i) => {
      const fill = segmentFill(i, state.shields);
      this.strokeArc(
        span,
        width,
        HOLO_PALETTE.track,
        HOLO_PALETTE.trackAlpha + EMPTY_SEGMENT_ALPHA * (1 - fill),
      );
      if (fill > 0) {
        this.strokeArc(
          {
            start: span.start,
            end: span.start + (span.end - span.start) * fill,
          },
          width,
          HOLO_PALETTE.shield,
          GAUGE_ALPHA,
        );
      }
    });
  }

  private ensureShieldSegments(count: number): void {
    if (count === this.shieldSegmentCount) return;
    this.shieldSegmentCount = count;
    this.shieldSegments = segmentArcs(
      count,
      GAUGES.shield.centerDeg,
      GAUGES.shield.sweepDeg,
      GAUGES.shield.segmentGapDeg,
    );
  }

  private strokeArc(
    span: ArcSpan,
    width: number,
    color: number,
    alpha: number,
  ): void {
    if (span.end - span.start <= 0) return;
    const g = this.graphics;
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.arc(0, 0, this.radius, span.start, span.end, false);
    g.strokePath();
  }
}
