/**
 * HealthBar — the per-ship hull/shield overlay (holographic HUD style).
 *
 * Shields read as discrete segments (one per X-Wing shield token) above a
 * hull bar ticked per miniature hull point. Damage flashes white and leaves
 * a draining ghost trail; repair sweeps a shimmer along the restored bar's
 * edge with a "+" glyph. Player / ally / enemy differ by marker SHAPE
 * (chevron / diamond / reticle brackets) as well as colour, and the bar
 * scales with ship size. Full-health, untargeted enemies are hidden.
 *
 * Thin Phaser view: segment math and cue timing live in ./hud/overlay
 * (pure, unit-tested). Callers keep the old API: construct, `update(hull,
 * shields)`, `setPosition`, `destroy`.
 */

import Phaser from "phaser";
import type { FactionId, ShipSize } from "../config";
import { HOLO_DEPTH, type HoloSide } from "./theme/HoloTheme";
import {
  createChannel,
  flashStrength,
  isChannelAnimating,
  setChannelValue,
  shimmerStrength,
  stepChannel,
  triggerShimmer,
  type ChannelAnimation,
} from "./hud/overlay/overlayAnimator";
import { drawShipOverlay } from "./hud/overlay/overlayDraw";
import {
  hullTickCount,
  layoutOverlayRows,
  overlayVisible,
  segmentFill,
  shieldSegmentCount,
  type OverlayGeometry,
  type OverlayRowLayout,
} from "./hud/overlay/overlayLayout";
import {
  fractionOf,
  overlayGeometryFor,
  type OverlayRepairNote,
  type ShipOverlayState,
} from "./hud/overlay/overlayState";

export type {
  OverlayRepairNote,
  ShipOverlayState,
} from "./hud/overlay/overlayState";

export interface HealthBarConfig {
  scene: Phaser.Scene;
  x: number;
  y: number;
  /** Overrides the size-based bar width. */
  width?: number;
  /** Overrides the size-based hull bar height. */
  height?: number;
  faction: FactionId;
  maxHull: number;
  maxShields: number;
  currentHull: number;
  currentShields: number;
  /** Allegiance relative to the local player (default neutral: hidden at full). */
  side?: HoloSide;
  /** Hull size class; defaults to the definition's size. */
  size?: ShipSize;
  /** Ship definition id, used to look up the size class. */
  definitionId?: string;
}

export class HealthBar extends Phaser.GameObjects.Container {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly geometry: OverlayGeometry;
  private readonly layout: OverlayRowLayout;
  private side: HoloSide;
  private readonly segmentCount: number;
  private readonly hullTicks: number;
  private readonly maxHull: number;
  private readonly maxShields: number;
  private readonly shieldChannel: ChannelAnimation;
  private readonly hullChannel: ChannelAnimation;
  private currentHull: number;
  private currentShields: number;
  private targeted = false;
  private dirty = true;
  private lastRepair: OverlayRepairNote | null = null;
  private repairCount = 0;

  constructor(config: HealthBarConfig) {
    super(config.scene, config.x, config.y);
    this.geometry = overlayGeometryFor(config);
    this.side = config.side ?? "neutral";
    this.maxHull = config.maxHull;
    this.maxShields = config.maxShields;
    this.currentHull = config.currentHull;
    this.currentShields = config.currentShields;
    this.segmentCount = shieldSegmentCount(config.maxShields);
    this.hullTicks = hullTickCount(config.maxHull);
    this.layout = layoutOverlayRows(this.geometry, this.segmentCount > 0);
    this.shieldChannel = createChannel(
      fractionOf(config.currentShields, config.maxShields),
    );
    this.hullChannel = createChannel(
      fractionOf(config.currentHull, config.maxHull),
    );
    this.graphics = config.scene.add.graphics();
    this.add(this.graphics);
    this.setDepth(HOLO_DEPTH.worldOverlay);
    config.scene.add.existing(this);
    this.redraw();
  }

  /**
   * Feed the ship's current hull and shields. Losses start the damage
   * cues, gains the repair shimmer.
   * @param currentHull - Current hull.
   * @param currentShields - Current shields.
   */
  update(currentHull: number, currentShields: number): void {
    this.currentHull = currentHull;
    this.currentShields = currentShields;
    const shieldChange = setChannelValue(
      this.shieldChannel,
      fractionOf(currentShields, this.maxShields),
    );
    const hullChange = setChannelValue(
      this.hullChannel,
      fractionOf(currentHull, this.maxHull),
    );
    if (shieldChange !== "none" || hullChange !== "none") this.dirty = true;
    this.refreshVisibility();
  }

  /**
   * Show a repair delivered by the repair event channel (shimmer + "+").
   * @param repair - What was restored and by whom.
   */
  showRepair(repair: OverlayRepairNote): void {
    triggerShimmer(
      repair.kind === "hull" ? this.hullChannel : this.shieldChannel,
    );
    this.lastRepair = { kind: repair.kind, sourceKind: repair.sourceKind };
    this.repairCount++;
    this.dirty = true;
    this.refreshVisibility();
  }

  /**
   * Mark or unmark the ship as the player's target (amber brackets; keeps
   * a full-health enemy's overlay visible).
   * @param targeted - Whether it is targeted.
   */
  setTargeted(targeted: boolean): void {
    if (this.targeted === targeted) return;
    this.targeted = targeted;
    this.dirty = true;
    this.refreshVisibility();
  }

  /**
   * Change the overlay's allegiance (e.g. the player took over another ship).
   * @param side - New side.
   */
  setSide(side: HoloSide): void {
    if (this.side === side) return;
    this.side = side;
    this.dirty = true;
    this.refreshVisibility();
  }

  /**
   * Phaser update-list hook: advance the cues and redraw while animating.
   * @param _time - Scene time (unused).
   * @param delta - Frame length (ms).
   */
  preUpdate(_time: number, delta: number): void {
    const wasAnimating = this.isAnimating();
    stepChannel(this.shieldChannel, delta);
    stepChannel(this.hullChannel, delta);
    if (wasAnimating || this.dirty) this.redraw();
    if (wasAnimating) this.refreshVisibility();
  }

  /**
   * Snapshot of the overlay for specs and debugging.
   * @returns Current overlay state.
   */
  getOverlayState(): ShipOverlayState {
    const fill = segmentFill(
      this.currentShields,
      this.maxShields,
      this.segmentCount,
    );
    return {
      side: this.side,
      visible: this.visible,
      targeted: this.targeted,
      width: this.geometry.width,
      segmentCount: this.segmentCount,
      litSegments: fill.lit,
      partialSegment: fill.partial,
      hullFraction: this.hullChannel.value,
      hullTicks: this.hullTicks,
      damageFlash:
        flashStrength(this.shieldChannel) > 0 ||
        flashStrength(this.hullChannel) > 0,
      shieldShimmer: shimmerStrength(this.shieldChannel) > 0,
      hullShimmer: shimmerStrength(this.hullChannel) > 0,
      lastRepair: this.lastRepair,
      repairCount: this.repairCount,
    };
  }

  /**
   * Whether any cue is playing on either channel.
   * @returns True while flashing, shimmering or draining a ghost.
   */
  private isAnimating(): boolean {
    return (
      isChannelAnimating(this.shieldChannel) ||
      isChannelAnimating(this.hullChannel)
    );
  }

  /** Apply the visibility rule (side, full health, target, animation). */
  private refreshVisibility(): void {
    const atFull =
      this.currentHull >= this.maxHull &&
      this.currentShields >= this.maxShields;
    this.setVisible(
      overlayVisible({
        side: this.side,
        atFull,
        targeted: this.targeted,
        animating: this.isAnimating(),
      }),
    );
  }

  /** Redraw the overlay graphics from the current state. */
  private redraw(): void {
    this.dirty = false;
    drawShipOverlay(this.graphics, {
      geometry: this.geometry,
      layout: this.layout,
      side: this.side,
      targeted: this.targeted,
      segmentCount: this.segmentCount,
      shieldFill: segmentFill(
        this.currentShields,
        this.maxShields,
        this.segmentCount,
      ),
      hullTicks: this.hullTicks,
      shield: this.shieldChannel,
      hull: this.hullChannel,
    });
  }
}
