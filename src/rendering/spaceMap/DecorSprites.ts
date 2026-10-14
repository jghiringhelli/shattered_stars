/**
 * DecorSprites — the drifting rocks, debris and shards of a map theme plus
 * its planet limb. Screen-pinned images placed each frame from the camera's
 * unwrapped travel (see parallaxMath); only the ones in view are shown.
 */

import Phaser from "phaser";
import {
  decorFrame,
  DECOR_ATLAS_KEY,
  DECOR_CELL_PX,
  PLANET_TEXTURE_PX,
} from "./decorAtlas";
import {
  DECOR_FIELD_PERIOD,
  placeDecor,
  PLANET_FACTOR,
  wrapSymmetric,
  type DecorItem,
  type DecorOffset,
} from "./parallaxMath";

/** Half of the planet texture edge: its visual reach at scale 1 (px). */
const PLANET_RADIUS_AT_SCALE_ONE = PLANET_TEXTURE_PX / 2;
/** Extra px beyond a sprite's half-size before it is hidden. */
const CULL_MARGIN_PX = 40;

/** The visible window in parallax space. */
export interface DecorView {
  readonly travelX: number;
  readonly travelY: number;
  readonly seconds: number;
  /** Half of the visible width / height in world units. */
  readonly halfWidth: number;
  readonly halfHeight: number;
}

interface Placed {
  readonly item: Pick<DecorItem, "x" | "y" | "factor" | "driftX" | "driftY" | "rotation" | "spin">;
  readonly image: Phaser.GameObjects.Image;
  readonly halfSize: number;
}

export class DecorSprites {
  private readonly decor: Placed[] = [];
  private planet: Placed | null = null;
  private readonly offset: DecorOffset = { x: 0, y: 0 };
  private readonly centerX: number;
  private readonly centerY: number;

  /**
   * @param scene - Owning scene.
   * @param adopt - Registers each created image as background (and owns it).
   */
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly adopt: <T extends Phaser.GameObjects.GameObject>(object: T) => T,
  ) {
    this.centerX = scene.scale.width / 2;
    this.centerY = scene.scale.height / 2;
  }

  /** @returns How many rocks / debris / shards exist (planet excluded). */
  get count(): number {
    return this.decor.length;
  }

  /**
   * Create the sprites of a decor field.
   *
   * @param items - Items from generateDecorField (far → near).
   * @param firstDepth - Depth of the first (farthest) sprite; later ones sit above.
   * @returns The next free depth.
   */
  addField(items: ReadonlyArray<DecorItem>, firstDepth: number): number {
    let depth = firstDepth;
    for (const item of items) {
      const image = this.adopt(
        this.scene.add
          .image(0, 0, DECOR_ATLAS_KEY, decorFrame(item.kind, item.variant))
          .setScrollFactor(0)
          .setDepth(depth++)
          .setScale(item.scale)
          .setTint(item.tint)
          .setAlpha(item.alpha)
          .setVisible(false),
      );
      this.decor.push({ item, image, halfSize: (DECOR_CELL_PX * item.scale) / 2 });
    }
    return depth;
  }

  /**
   * Add the planet limb.
   *
   * @param textureKey - Planet texture.
   * @param scale - Display scale.
   * @param start - Start position in parallax space.
   * @param depth - Draw depth.
   */
  addPlanet(
    textureKey: string,
    scale: number,
    start: { readonly x: number; readonly y: number },
    depth: number,
  ): void {
    const image = this.adopt(
      this.scene.add.image(0, 0, textureKey).setScrollFactor(0).setDepth(depth).setScale(scale),
    );
    const item = { ...start, factor: PLANET_FACTOR, driftX: 0, driftY: 0, rotation: 0, spin: 0 };
    this.planet = { item, image, halfSize: PLANET_RADIUS_AT_SCALE_ONE * scale };
  }

  /**
   * Re-place everything for this frame.
   *
   * @param view - Camera travel, time and visible size.
   * @param showDecor - False hides the rocks/debris/shards (low quality).
   * @param showPlanet - False hides the planet.
   */
  update(view: DecorView, showDecor: boolean, showPlanet: boolean): void {
    for (const sprite of this.decor) {
      if (!showDecor) {
        if (sprite.image.visible) sprite.image.setVisible(false);
        continue;
      }
      this.placeDrifting(sprite, view);
    }
    if (this.planet) this.placePlanet(this.planet, view, showPlanet);
  }

  private placeDrifting(sprite: Placed, view: DecorView): void {
    const { item, image, halfSize } = sprite;
    placeDecor(item, view.travelX, view.travelY, view.seconds, this.offset);
    if (!this.inView(this.offset.x, this.offset.y, halfSize, view)) {
      if (image.visible) image.setVisible(false);
      return;
    }
    if (!image.visible) image.setVisible(true);
    image.setPosition(this.centerX + this.offset.x, this.centerY + this.offset.y);
    image.setRotation(item.rotation + item.spin * view.seconds);
  }

  private placePlanet(sprite: Placed, view: DecorView, allowed: boolean): void {
    const { item, image, halfSize } = sprite;
    const x = wrapSymmetric(item.x - view.travelX * PLANET_FACTOR, DECOR_FIELD_PERIOD);
    const y = wrapSymmetric(item.y - view.travelY * PLANET_FACTOR, DECOR_FIELD_PERIOD);
    const visible = allowed && this.inView(x, y, halfSize, view);
    if (image.visible !== visible) image.setVisible(visible);
    if (visible) image.setPosition(this.centerX + x, this.centerY + y);
  }

  private inView(x: number, y: number, halfSize: number, view: DecorView): boolean {
    const reach = halfSize + CULL_MARGIN_PX;
    return Math.abs(x) < view.halfWidth + reach && Math.abs(y) < view.halfHeight + reach;
  }
}
