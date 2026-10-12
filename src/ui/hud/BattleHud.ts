/**
 * BattleHud — facade over the holographic battle HUD.
 *
 * A scene creates one BattleHud and calls `update(snapshot)` every frame with
 * plain data ({@link BattleHudSnapshot}); it never touches component
 * internals. The facade owns layout (radar bottom centre, flight readout to
 * its left, weapon bar to its right, edge arrows around the screen, status
 * ring around the player ship, squad-mark reticles on marked ships) and
 * cancels camera zoom for screen-space
 * widgets, so the HUD is pixel-stable at any zoom. Nothing is interactive.
 */

import Phaser from "phaser";
import { HOLO_DEPTH, HOLO_SPACING } from "../theme/HoloTheme";
import { EdgeIndicators } from "./EdgeIndicators";
import { FlightReadout } from "./FlightReadout";
import { createScreenContainer } from "./holoPrimitives";
import { hudRootTransform, type EdgeInsets } from "./hudMath";
import type { ClosenessOptions } from "./hudStyleMath";
import { MarkReticle } from "./MarkReticle";
import { Radar } from "./Radar";
import type { ScreenRect } from "./screenRect";
import { ShipStatusRing } from "./ShipStatusRing";
import type { BattleHudSnapshot, CameraViewSnapshot, HudPoint } from "./types";
import { WeaponBar } from "./WeaponBar";

/** Gap between the bottom cluster and the screen bottom. */
const BOTTOM_MARGIN = HOLO_SPACING.lg;
/** Gap between the radar and its side panels. */
const CLUSTER_GAP = HOLO_SPACING.lg;

/** BattleHud options. Optional fields fall back to each component's default. */
export interface BattleHudConfig {
  /** Torus side length (BATTLEFIELD_SIZE); <= 0 for an unwrapped plane. */
  readonly worldSize: number;
  /** World distance at the radar rim. */
  readonly radarRangePx?: number | undefined;
  /** Radar radius in screen px. */
  readonly radarRadius?: number | undefined;
  /** Status ring radius in world px. */
  readonly playerRingRadius?: number | undefined;
  /** Edge-arrow track insets. */
  readonly edgeInsets?: EdgeInsets | undefined;
  /** Edge-arrow distance → size/alpha mapping. */
  readonly edgeCloseness?: ClosenessOptions | undefined;
  /** Weapon slot size in px. */
  readonly weaponSlotSize?: number | undefined;
}

/** Facade over every battle HUD component. */
export class BattleHud {
  private readonly root: Phaser.GameObjects.Container;
  private readonly ring: ShipStatusRing;
  private readonly radar: Radar;
  private readonly weapons: WeaponBar;
  private readonly readout: FlightReadout;
  private readonly edges: EdgeIndicators;
  private readonly marks: MarkReticle;
  private lastZoom = Number.NaN;
  private lastWidth = Number.NaN;
  private lastHeight = Number.NaN;
  private lastWeaponWidth = Number.NaN;
  private visible = true;

  /**
   * @param scene - Battle scene that owns the HUD.
   * @param config - World size and optional tuning.
   */
  constructor(scene: Phaser.Scene, config: BattleHudConfig) {
    this.ring = new ShipStatusRing(scene, { radius: config.playerRingRadius });
    this.radar = new Radar(scene, {
      worldSize: config.worldSize,
      rangePx: config.radarRangePx,
      radius: config.radarRadius,
    });
    this.weapons = new WeaponBar(scene, { slotSize: config.weaponSlotSize });
    this.readout = new FlightReadout(scene);
    this.edges = new EdgeIndicators(scene, {
      worldSize: config.worldSize,
      insets: config.edgeInsets,
      closeness: config.edgeCloseness,
    });
    this.marks = new MarkReticle(scene, { worldSize: config.worldSize });
    this.root = createScreenContainer(scene).setDepth(HOLO_DEPTH.hud);
    this.root.add([
      this.radar.container,
      this.weapons.container,
      this.readout.container,
    ]);
    this.edges.container.setDepth(HOLO_DEPTH.hudIndicators);
  }

  /** Number of edge arrows currently shown. */
  get edgeArrowCount(): number {
    return this.edges.activeCount;
  }

  /** Number of in-world squad-mark reticles drawn by the last update. */
  get markReticleCount(): number {
    return this.marks.activeCount;
  }

  /**
   * Screen positions of the edge arrows shown after the last update.
   *
   * @returns One point per visible arrow, in screen px.
   */
  edgeArrowPositions(): HudPoint[] {
    return this.edges.activeArrowPositions();
  }

  /**
   * Refresh every component from one snapshot.
   *
   * @param snapshot - Player, contacts, weapons and camera view for this frame.
   */
  update(snapshot: BattleHudSnapshot): void {
    if (!this.visible) return;
    this.applyCamera(snapshot.camera);
    const { player } = snapshot;
    this.ring.setVisible(player !== null);
    if (player !== null) this.ring.update(player, snapshot.camera.zoom);
    this.radar.update(
      player?.pose ?? null,
      snapshot.contacts,
      snapshot.boundary ?? null,
    );
    this.weapons.update(snapshot.weapons);
    if (this.weapons.width !== this.lastWeaponWidth) this.refreshObstacles();
    this.readout.update(player);
    this.edges.update(snapshot.camera, snapshot.contacts);
    this.marks.update(snapshot.camera, snapshot.contacts);
  }

  /**
   * Show or hide the whole HUD (e.g. under a pause or game-over overlay).
   *
   * @param visible - Visibility.
   */
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.setVisible(visible);
    this.edges.container.setVisible(visible);
    this.ring.setVisible(visible);
    this.marks.setVisible(visible);
  }

  /** Destroy every HUD game object. */
  destroy(): void {
    this.ring.destroy();
    this.marks.destroy();
    this.edges.destroy();
    this.root.destroy();
  }

  private applyCamera(camera: CameraViewSnapshot): void {
    if (
      camera.zoom === this.lastZoom &&
      camera.width === this.lastWidth &&
      camera.height === this.lastHeight
    )
      return;
    this.lastZoom = camera.zoom;
    this.lastWidth = camera.width;
    this.lastHeight = camera.height;
    const t = hudRootTransform(camera.zoom, camera.width, camera.height);
    for (const container of [this.root, this.edges.container]) {
      container.setPosition(t.x, t.y).setScale(t.scale);
    }
    this.layout(camera.width, camera.height);
  }

  private layout(width: number, height: number): void {
    const centerX = width / 2;
    const radius = this.radar.radiusPx;
    this.radar.setPosition(centerX, height - BOTTOM_MARGIN - radius);
    this.weapons.setPosition(
      centerX + radius + CLUSTER_GAP,
      height - BOTTOM_MARGIN - this.weapons.height / 2,
    );
    this.readout.setPosition(
      centerX - radius - CLUSTER_GAP,
      height - BOTTOM_MARGIN - this.weapons.height / 2,
    );
    this.refreshObstacles();
  }

  private refreshObstacles(): void {
    this.lastWeaponWidth = this.weapons.width;
    this.edges.setObstacles(this.clusterBounds());
  }

  /**
   * Screen bounds of the bottom HUD cluster widgets (readout, radar, weapons).
   *
   * @returns Widget rects in screen px; the weapon bar is omitted when empty.
   */
  clusterBounds(): ScreenRect[] {
    const rects = [this.readout.bounds(), this.radar.bounds()];
    if (this.weapons.width > 0) rects.push(this.weapons.bounds());
    return rects;
  }
}
