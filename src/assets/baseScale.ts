/**
 * baseScale — the un-squashed scale of a ship image. Banking multiplies a
 * base scale every frame; when a placeholder texture is swapped for its art
 * the base changes with it, so it lives on the image (not on a copy taken at
 * creation, which went stale and drew swapped sprites far too large).
 *
 * Pure apart from the image's data store: no Phaser import.
 */

/** The slice of Phaser.GameObjects.Image this module touches. */
export interface ScalableImage {
  readonly width: number;
  readonly height: number;
  scaleX: number;
  scaleY: number;
  getData(key: string): unknown;
  setData(key: string, value: unknown): unknown;
}

/** An x / y scale pair. */
export interface ScalePair {
  readonly x: number;
  readonly y: number;
}

/** Data key under which the base scale is stored. */
const BASE_SCALE_KEY = "baseScale";

/**
 * Remember the image's current scale as its un-squashed base.
 * @param image - The image, at rest (not mid-squash).
 */
export function recordBaseScale(image: ScalableImage): void {
  image.setData(BASE_SCALE_KEY, { x: image.scaleX, y: image.scaleY });
}

/**
 * @param image - The image.
 * @returns Its recorded base scale (the current scale when none was recorded).
 */
export function imageBaseScale(image: ScalableImage): ScalePair {
  const stored = image.getData(BASE_SCALE_KEY) as ScalePair | undefined;
  return stored ?? { x: image.scaleX, y: image.scaleY };
}

/**
 * @param image - The image.
 * @returns The size it shows at rest: texture size times the base scale.
 */
export function baseDisplaySize(image: ScalableImage): {
  width: number;
  height: number;
} {
  const base = imageBaseScale(image);
  return { width: image.width * base.x, height: image.height * base.y };
}
