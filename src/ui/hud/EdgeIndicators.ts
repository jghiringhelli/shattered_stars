/**
 * EdgeIndicators — an arrow on the screen edge for every ship outside the
 * camera view, pointing at it. Colour = side; size and alpha grow as the
 * ship gets closer to the visible area; beyond a max distance arrows hide
 * (the locked target never hides). The locked target uses a distinct
 * bracketed glyph.
 *
 * Pooled: one Graphics per arrow, created only when the number of
 * simultaneous arrows exceeds the pool, never per frame. Each Graphics
 * holds its glyph at the origin and is aimed with position/rotation/scale;
 * the glyph is re-drawn only when its colour or target flag changes.
 *
 * Arrows never cover registered HUD widgets (`setObstacles`): an arrow that
 * would land on one slides inward along its own ray until it clears it.
 */

import Phaser from "phaser";
import { HOLO_PALETTE, SIDE_COLORS } from "../theme/HoloTheme";
import { addPinned, createScreenContainer } from "./holoPrimitives";
import { drawArrowGlyph, drawTargetArrowGlyph } from "./HudIcons";
import { placeEdgeArrow, type EdgeInsets } from "./hudMath";
import { closenessStyle, type ClosenessOptions } from "./hudStyleMath";
import { inflateRect, pullOutOfRect, type ScreenRect } from "./screenRect";
import type { CameraViewSnapshot, ContactHudState, HudPoint } from "./types";

const DEFAULT_ARROW_SIZE = 11;
const DEFAULT_INSET = 26;
/** Default insets: uniform margin from every screen edge. */
export const DEFAULT_EDGE_INSETS: EdgeInsets = {
  top: DEFAULT_INSET,
  right: DEFAULT_INSET,
  bottom: DEFAULT_INSET,
  left: DEFAULT_INSET,
};
/** Default closeness mapping on distance past the visible edge (world px). */
export const DEFAULT_EDGE_CLOSENESS: ClosenessOptions = {
  nearDistance: 0,
  farDistance: 2400,
  minScale: 0.55,
  maxScale: 1.3,
  minAlpha: 0.3,
  maxAlpha: 1,
};
/** Glyph cache key: no glyph drawn yet. */
const NO_GLYPH = -1;
/** Multiplier applied to the side colour to form a glyph cache key. */
const KEY_STRIDE = 2;
/** Obstacle clearance in arrow-size units — covers the target ring at max scale. */
const OBSTACLE_CLEARANCE = 1.5;

/** EdgeIndicators options. */
export interface EdgeIndicatorsConfig {
  /** Torus side length (<= 0 for an unwrapped plane). */
  readonly worldSize: number;
  /** Arrow track insets. Default: 26 px on every side. */
  readonly insets?: EdgeInsets | undefined;
  /** Distance → size/alpha mapping. Default: {@link DEFAULT_EDGE_CLOSENESS}. */
  readonly closeness?: ClosenessOptions | undefined;
  /** Arrow size in px at scale 1. Default: 11. */
  readonly arrowSize?: number | undefined;
}

interface PooledArrow {
  readonly graphics: Phaser.GameObjects.Graphics;
  glyphKey: number;
}

/** Pooled off-screen ship arrows. */
export class EdgeIndicators {
  /** Screen-space container (scrollFactor 0). */
  readonly container: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly pool: PooledArrow[] = [];
  private readonly worldSize: number;
  private readonly insets: EdgeInsets;
  private readonly closeness: ClosenessOptions;
  private readonly arrowSize: number;
  private obstacles: ReadonlyArray<ScreenRect> = [];
  private active = 0;

  /**
   * @param scene - Owning scene.
   * @param config - World size, insets, closeness mapping, arrow size.
   */
  constructor(scene: Phaser.Scene, config: EdgeIndicatorsConfig) {
    this.scene = scene;
    this.worldSize = config.worldSize;
    this.insets = config.insets ?? DEFAULT_EDGE_INSETS;
    this.closeness = config.closeness ?? DEFAULT_EDGE_CLOSENESS;
    this.arrowSize = config.arrowSize ?? DEFAULT_ARROW_SIZE;
    this.container = createScreenContainer(scene);
  }

  /** Number of arrows shown after the last update. */
  get activeCount(): number {
    return this.active;
  }

  /** Number of pooled arrow objects ever created. */
  get poolSize(): number {
    return this.pool.length;
  }

  /**
   * Screen positions of the arrows shown after the last update (query; allocates).
   *
   * @returns One point per visible arrow.
   */
  activeArrowPositions(): HudPoint[] {
    return this.pool
      .slice(0, this.active)
      .map(({ graphics }) => ({ x: graphics.x, y: graphics.y }));
  }

  /**
   * Register HUD widgets the arrows must not cover. An arrow landing on one
   * slides back along its own ray until it clears it (plus the arrow's size).
   *
   * @param rects - Widget bounds in screen px.
   */
  setObstacles(rects: ReadonlyArray<ScreenRect>): void {
    const clearance =
      this.arrowSize * this.closeness.maxScale * OBSTACLE_CLEARANCE;
    this.obstacles = rects.map((rect) => inflateRect(rect, clearance));
  }

  /**
   * Place arrows for every live off-screen contact.
   *
   * @param view - Camera view snapshot.
   * @param contacts - Contacts (dead ones are skipped).
   */
  update(
    view: CameraViewSnapshot,
    contacts: ReadonlyArray<ContactHudState>,
  ): void {
    const center = { x: view.width / 2, y: view.height / 2 };
    let used = 0;
    for (const contact of contacts) {
      if (!contact.alive) continue;
      const placement = placeEdgeArrow(
        view,
        contact.pose,
        this.insets,
        this.worldSize,
      );
      if (placement === null) continue;
      const style = closenessStyle(
        placement.beyondEdgeDistance,
        this.closeness,
      );
      if (!style.visible && !contact.isTarget) continue;
      const position = this.avoidObstacles(center, placement);
      const arrow = this.acquire(used++);
      this.ensureGlyph(arrow, SIDE_COLORS[contact.side], contact.isTarget);
      arrow.graphics
        .setPosition(position.x, position.y)
        .setRotation(placement.angle)
        .setScale(style.visible ? style.scale : this.closeness.minScale)
        .setAlpha(style.visible ? style.alpha : this.closeness.minAlpha)
        .setVisible(true);
    }
    for (let i = used; i < this.active; i++)
      this.pool[i]?.graphics.setVisible(false);
    this.active = used;
  }

  /** Destroy all pooled objects. */
  destroy(): void {
    this.container.destroy();
    this.pool.length = 0;
  }

  private avoidObstacles(center: HudPoint, point: HudPoint): HudPoint {
    let position = point;
    for (const obstacle of this.obstacles)
      position = pullOutOfRect(center, position, obstacle);
    return position;
  }

  private acquire(index: number): PooledArrow {
    const existing = this.pool[index];
    if (existing !== undefined) return existing;
    const graphics = this.scene.add.graphics();
    addPinned(this.container, graphics);
    const created: PooledArrow = { graphics, glyphKey: NO_GLYPH };
    this.pool.push(created);
    return created;
  }

  private ensureGlyph(
    arrow: PooledArrow,
    color: number,
    isTarget: boolean,
  ): void {
    const key = color * KEY_STRIDE + (isTarget ? 1 : 0);
    if (arrow.glyphKey === key) return;
    arrow.glyphKey = key;
    arrow.graphics.clear();
    if (isTarget)
      drawTargetArrowGlyph(
        arrow.graphics,
        this.arrowSize,
        color,
        HOLO_PALETTE.target,
      );
    else drawArrowGlyph(arrow.graphics, this.arrowSize, color);
  }
}
