/**
 * Starfield rendering utility
 *
 * Shared across all battle scenes to avoid duplicating the background
 * star/nebula drawing logic.
 */

import Phaser from 'phaser';

/** A single nebula patch specification for {@link renderMenuStarfield}. */
export interface NebulaSpec {
  readonly x: number;
  readonly y: number;
  readonly color: number;
  readonly radius: number;
  /** Fill alpha. Default: 0.05. */
  readonly alpha?: number;
}

/** Options for {@link renderMenuStarfield}. */
export interface MenuStarfieldOptions {
  /** Number of stars. Default: 200. */
  readonly starCount?: number;
  /**
   * Pixel bounds for star placement.
   * Default: full scene width/height (0 to scene.scale.width/height).
   */
  readonly bounds?: { minX: number; maxX: number; minY: number; maxY: number };
  /** Optional nebula patches to draw over the stars. Default: none. */
  readonly nebulae?: ReadonlyArray<NebulaSpec>;
  /** Star radius range [min, max] in pixels. Default: [0.5, 2]. */
  readonly starSizeRange?: readonly [number, number];
  /** Star fill alpha range [min, max]. Default: [0.2, 0.8]. */
  readonly alphaRange?: readonly [number, number];
}

/**
 * Draw a static starfield for menu/narrative scenes and return the Graphics object.
 * Unlike {@link renderBattleStarfield}, this function accepts freely positioned bounds
 * and explicit nebula patch specs, making it suitable for MainMenu, Campaign,
 * Credits, and other non-arena screens.
 *
 * @param scene   - The Phaser scene to draw into.
 * @param options - Configures star count, coordinate bounds, and nebula patches.
 */
export function renderMenuStarfield(
  scene: Phaser.Scene,
  options: MenuStarfieldOptions = {},
): Phaser.GameObjects.Graphics {
  const { width, height } = scene.scale;
  const {
    starCount = 200,
    bounds = { minX: 0, maxX: width, minY: 0, maxY: height },
    nebulae = [],
    starSizeRange = [0.5, 2],
    alphaRange = [0.2, 0.8],
  } = options;

  const graphics = scene.add.graphics();

  for (let i = 0; i < starCount; i++) {
    const x = Phaser.Math.Between(bounds.minX, bounds.maxX);
    const y = Phaser.Math.Between(bounds.minY, bounds.maxY);
    const size = Phaser.Math.FloatBetween(starSizeRange[0], starSizeRange[1]);
    graphics.fillStyle(0xffffff, Phaser.Math.FloatBetween(alphaRange[0], alphaRange[1]));
    graphics.fillCircle(x, y, size);
  }

  for (const neb of nebulae) {
    graphics.fillStyle(neb.color, neb.alpha ?? 0.05);
    graphics.fillCircle(neb.x, neb.y, neb.radius);
  }

  return graphics;
}


export interface StarfieldOptions {
  /** Number of star points to draw. Default: 400. */
  readonly starCount?: number;
  /** Whether to draw nebula cloud patches. Default: true. */
  readonly includeNebula?: boolean;
}

/**
 * Draw a static starfield across the battlefield area and return the
 * Graphics object so callers can set depth or destroy it later.
 *
 * @param scene - The Phaser scene to draw into.
 * @param fieldSize - Width and height of the square battlefield.
 * @param options - Optional overrides for star count / nebula patches.
 */
export function renderBattleStarfield(
  scene: Phaser.Scene,
  fieldSize: number,
  options: StarfieldOptions = {}
): Phaser.GameObjects.Graphics {
  const { starCount = 400, includeNebula = true } = options;

  const graphics = scene.add.graphics();

  for (let i = 0; i < starCount; i++) {
    const x = Phaser.Math.Between(0, fieldSize);
    const y = Phaser.Math.Between(0, fieldSize);
    const size = Phaser.Math.FloatBetween(0.5, 2);
    const alpha = Phaser.Math.FloatBetween(0.2, 0.8);
    graphics.fillStyle(0xffffff, alpha);
    graphics.fillCircle(x, y, size);
  }

  if (includeNebula) {
    const nebulaColors = [0x4422aa, 0x2244aa, 0x224466, 0x442266];
    for (let i = 0; i < 5; i++) {
      const x = Phaser.Math.Between(200, fieldSize - 200);
      const y = Phaser.Math.Between(200, fieldSize - 200);
      const color = Phaser.Math.RND.pick(nebulaColors);
      graphics.fillStyle(color, 0.1);
      graphics.fillCircle(x, y, Phaser.Math.Between(100, 300));
    }
  }

  return graphics;
}
