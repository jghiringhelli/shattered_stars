/**
 * TorusViewRig — makes the wrapping arena look seamless and layers the
 * backdrop behind the world, using extra cameras (render only; the
 * simulation is never touched).
 *
 * Cameras, in draw order:
 *  1. backdrop camera — draws only the registered background objects
 *     (parallax layers, decor) and owns the sky colour;
 *  2. copy cameras — one per piece of the view past an arena seam, each
 *     drawing the real world displaced by ±arena size inside its viewport;
 *  3. the scene's main camera (moved last) — draws the world and the HUD.
 *
 * Which camera draws an object is decided every frame (PRE_RENDER) by
 * setting `cameraFilter` bits: background objects only reach the backdrop
 * camera, screen-pinned objects (HUD) only the main one, and world objects
 * reach a copy camera only when they are near its region.
 */

import Phaser from "phaser";
import {
  computeSeamRegions,
  createRegionCamera,
  createSeamRegions,
  MAX_SEAM_REGIONS,
  placeRegionCamera,
  regionNeedsObject,
  type SeamView,
} from "./seamRegions";

/** Name of the camera that draws the background. */
export const BACKDROP_CAMERA_NAME = "space_backdrop";
/** Prefix of the copy cameras' names (suffix = index). */
export const COPY_CAMERA_PREFIX = "torus_copy_";
/** Largest half-extent (px) of any world object, for region culling. */
export const DEFAULT_OBJECT_PADDING = 1200;

/** Options of {@link TorusViewRig}. */
export interface TorusViewRigOptions {
  /** Arena edge length. */
  readonly worldSize: number;
  /** Colour behind every layer. */
  readonly skyColor: number;
  /** Culling slack for big world objects. Default: DEFAULT_OBJECT_PADDING. */
  readonly objectPadding?: number;
}

/** The parts of a game object the sweep reads and writes. */
interface SweptObject extends Phaser.GameObjects.GameObject {
  x?: number;
  y?: number;
  scrollFactorX?: number;
  scrollFactorY?: number;
}

export class TorusViewRig {
  private readonly main: Phaser.Cameras.Scene2D.Camera;
  private readonly backdrop: Phaser.Cameras.Scene2D.Camera;
  private readonly copies: Phaser.Cameras.Scene2D.Camera[] = [];
  private readonly regions = createSeamRegions();
  private readonly placement = createRegionCamera();
  private readonly view: { -readonly [K in keyof SeamView]: number } = {
    centerX: 0,
    centerY: 0,
    halfWidth: 0,
    halfHeight: 0,
  };
  private readonly screen = { width: 0, height: 0 };
  private readonly background = new WeakSet<object>();
  private readonly padding: number;
  private copyMask = 0;
  private activeCopies = 0;

  /**
   * @param scene - Battle scene (its main camera must not use bounds).
   * @param options - Arena size and sky colour.
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: TorusViewRigOptions,
  ) {
    this.padding = options.objectPadding ?? DEFAULT_OBJECT_PADDING;
    this.main = scene.cameras.main;
    this.backdrop = scene.cameras.add(
      0,
      0,
      this.main.width,
      this.main.height,
      false,
      BACKDROP_CAMERA_NAME,
    );
    this.backdrop.setBackgroundColor(options.skyColor);
    this.main.setBackgroundColor();
    this.keepMainLast();
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.onPreRender, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** Number of copy cameras currently drawing (for tests and diagnostics). */
  get visibleCopies(): number {
    return this.activeCopies;
  }

  /**
   * Draw `object` through the backdrop camera only (below the world).
   *
   * @param object - A game object already added to the scene.
   */
  registerBackground(object: Phaser.GameObjects.GameObject): void {
    this.background.add(object);
  }

  /** Stop managing the scene (also runs on scene shutdown). */
  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.onPreRender, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private keepMainLast(): void {
    const cameras = this.scene.cameras.cameras;
    const index = cameras.indexOf(this.main);
    if (index === cameras.length - 1) return;
    cameras.splice(index, 1);
    cameras.push(this.main);
  }

  private copyCamera(index: number): Phaser.Cameras.Scene2D.Camera {
    let camera = this.copies[index];
    if (camera) return camera;
    camera = this.scene.cameras.add(
      0,
      0,
      this.main.width,
      this.main.height,
      false,
      `${COPY_CAMERA_PREFIX}${index}`,
    );
    this.copies[index] = camera;
    this.copyMask |= camera.id;
    this.keepMainLast();
    return camera;
  }

  private onPreRender(): void {
    const { main } = this;
    const zoom = main.zoom;
    this.screen.width = main.width;
    this.screen.height = main.height;
    this.view.centerX = main.scrollX + main.width / 2;
    this.view.centerY = main.scrollY + main.height / 2;
    this.view.halfWidth = main.width / (2 * zoom);
    this.view.halfHeight = main.height / (2 * zoom);
    this.syncBackdrop(zoom);
    this.placeCopies(zoom);
    this.sweep();
  }

  private syncBackdrop(zoom: number): void {
    const { backdrop, main } = this;
    if (backdrop.width !== main.width || backdrop.height !== main.height) {
      backdrop.setSize(main.width, main.height);
    }
    backdrop.setZoom(zoom);
  }

  private placeCopies(zoom: number): void {
    const count = computeSeamRegions(
      this.view,
      this.options.worldSize,
      this.regions,
    );
    let used = 0;
    for (let i = 0; i < count && used < MAX_SEAM_REGIONS; i++) {
      const placed = placeRegionCamera(
        this.regions[i]!,
        this.view,
        zoom,
        this.screen,
        this.placement,
      );
      if (!placed) continue;
      const camera = this.copyCamera(used);
      const slot = this.placement;
      camera.setViewport(slot.x, slot.y, slot.width, slot.height);
      camera.setZoom(zoom);
      camera.setScroll(slot.scrollX, slot.scrollY);
      camera.setVisible(true);
      const spare = this.regions[used]!;
      this.regions[used] = this.regions[i]!;
      this.regions[i] = spare;
      used++;
    }
    for (let i = used; i < this.copies.length; i++) {
      this.copies[i]!.setVisible(false);
    }
    this.activeCopies = used;
  }

  private sweep(): void {
    const list = this.scene.children.list as SweptObject[];
    const backdropBit = this.backdrop.id;
    const managed = backdropBit | this.copyMask;
    const worldOnly = this.copyMask | this.main.id;
    for (let i = 0; i < list.length; i++) {
      const child = list[i]!;
      if (this.background.has(child)) {
        child.cameraFilter = worldOnly;
        continue;
      }
      child.cameraFilter =
        (child.cameraFilter & ~managed) |
        backdropBit |
        this.copyFilterFor(child);
    }
  }

  private copyFilterFor(child: SweptObject): number {
    const pinned = child.scrollFactorX !== 1 || child.scrollFactorY !== 1;
    if (pinned || this.activeCopies === 0) return this.copyMask;
    const x = typeof child.x === "number" ? child.x : 0;
    const y = typeof child.y === "number" ? child.y : 0;
    let filter = 0;
    for (let k = 0; k < this.copies.length; k++) {
      const needed =
        k < this.activeCopies &&
        regionNeedsObject(x, y, this.regions[k]!, this.padding);
      if (!needed) filter |= this.copies[k]!.id;
    }
    return filter;
  }
}
