/**
 * Tileable layer textures of the space backdrop: stars, nebula wisps, dust
 * and the mirrored painted backdrop. Every texture wraps around its edges
 * (shapes are drawn again across the seam), so a TileSprite repeats them
 * with no visible join. Drawn from a seeded stream: same seed, same sky.
 */

import Phaser from "phaser";
import type { RandomGenerator } from "../../utils/random";
import { blendSeamless, drawWrapped, rgba, softBlob } from "./canvasDraw";

/** Edge of every layer tile (px). */
export const LAYER_TILE_PX = 1024;
/** Painted backdrops are 1024×576; this much of the middle is used (square crop). */
const BACKDROP_CROP_PX = 576;
/** Specks drawn at dust amount 1. */
const DUST_SPECKS_AT_FULL = 260;
/** Dust streaks slant by this angle (rad), like wind in a storm. */
const DUST_SLANT = -0.35;

/** Star layer recipe. */
export interface StarLayerSpec {
  readonly count: number;
  readonly minRadius: number;
  readonly maxRadius: number;
  readonly minAlpha: number;
  readonly maxAlpha: number;
  readonly tints: readonly number[];
}

function makeCanvas(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
): { texture: Phaser.Textures.CanvasTexture; ctx: CanvasRenderingContext2D } {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const texture = scene.textures.createCanvas(key, width, height)!;
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return { texture, ctx: texture.getContext() };
}

/**
 * Draw a tileable star field texture.
 *
 * @param scene - Owning scene.
 * @param key - Texture key to create (replaced if present).
 * @param rng - Seeded random stream.
 * @param spec - Star count, size, brightness and colours.
 */
export function createStarTexture(
  scene: Phaser.Scene,
  key: string,
  rng: RandomGenerator,
  spec: StarLayerSpec,
): void {
  const { texture, ctx } = makeCanvas(scene, key, LAYER_TILE_PX, LAYER_TILE_PX);
  for (let i = 0; i < spec.count; i++) {
    const radius =
      spec.minRadius + (spec.maxRadius - spec.minRadius) * rng.next() ** 2;
    const alpha = spec.minAlpha + (spec.maxAlpha - spec.minAlpha) * rng.next();
    const tint = spec.tints[Math.floor(rng.next() * spec.tints.length)] ?? 0xffffff;
    const x = rng.next() * LAYER_TILE_PX;
    const y = rng.next() * LAYER_TILE_PX;
    const reach = radius * 3;
    drawWrapped(LAYER_TILE_PX, x, y, reach, (cx, cy) => {
      if (radius > 1.1) softBlob(ctx, cx, cy, reach, tint, alpha * 0.35);
      ctx.fillStyle = rgba(tint, alpha);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  texture.refresh();
}

/** Nebula wisp recipe. */
export interface WispSpec {
  readonly count: number;
  readonly colors: readonly number[];
  /** Peak alpha of one wisp. */
  readonly alpha: number;
}

/**
 * Paint soft elongated nebula wisps onto a tile-sized canvas (wrapping at the
 * edges). Use with additive blending or `lighter` compositing.
 *
 * @param ctx - Context of a LAYER_TILE_PX square canvas.
 * @param rng - Seeded random stream.
 * @param spec - Count, colours and strength.
 */
export function paintWisps(
  ctx: CanvasRenderingContext2D,
  rng: RandomGenerator,
  spec: WispSpec,
): void {
  for (let i = 0; i < spec.count; i++) {
    const radius = 140 + rng.next() * 260;
    const x = rng.next() * LAYER_TILE_PX;
    const y = rng.next() * LAYER_TILE_PX;
    const color = spec.colors[Math.floor(rng.next() * spec.colors.length)] ?? 0x4422aa;
    const angle = rng.next() * Math.PI;
    const stretch = 0.35 + rng.next() * 0.4;
    drawWrapped(LAYER_TILE_PX, x, y, radius, (cx, cy) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.scale(1, stretch);
      softBlob(ctx, 0, 0, radius, color, spec.alpha);
      ctx.restore();
    });
  }
}

/**
 * Create a stand-alone wisp texture (for themes without a painted backdrop).
 *
 * @param scene - Owning scene.
 * @param key - Texture key to create.
 * @param rng - Seeded random stream.
 * @param spec - Count, colours and strength.
 */
export function createWispTexture(
  scene: Phaser.Scene,
  key: string,
  rng: RandomGenerator,
  spec: WispSpec,
): void {
  const { texture, ctx } = makeCanvas(scene, key, LAYER_TILE_PX, LAYER_TILE_PX);
  paintWisps(ctx, rng, spec);
  texture.refresh();
}

/**
 * Draw dust: fine specks and short slanted streaks.
 *
 * @param scene - Owning scene.
 * @param key - Texture key to create.
 * @param rng - Seeded random stream.
 * @param amount - 0..1 (1 = dust storm).
 * @param color - Dust colour.
 */
export function createDustTexture(
  scene: Phaser.Scene,
  key: string,
  rng: RandomGenerator,
  amount: number,
  color: number,
): void {
  const { texture, ctx } = makeCanvas(scene, key, LAYER_TILE_PX, LAYER_TILE_PX);
  const specks = Math.round(DUST_SPECKS_AT_FULL * amount);
  for (let i = 0; i < specks; i++) {
    const x = rng.next() * LAYER_TILE_PX;
    const y = rng.next() * LAYER_TILE_PX;
    const length = rng.chance(0.35) ? 6 + rng.next() * 18 : 0;
    const alpha = 0.12 + rng.next() * 0.3;
    const lineWidth = 1 + rng.next() * 0.6;
    drawWrapped(LAYER_TILE_PX, x, y, length + 2, (cx, cy) => {
      ctx.strokeStyle = rgba(color, alpha);
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(DUST_SLANT) * length, cy + Math.sin(DUST_SLANT) * length);
      ctx.stroke();
    });
  }
  texture.refresh();
}

/**
 * Build a seamless backdrop tile from a painted backdrop: the image's
 * centre square is cross-blended with itself (see {@link blendSeamless}).
 * Nebula wisps can be baked in (added with `lighter`).
 *
 * @param scene - Owning scene.
 * @param key - Texture key to create.
 * @param sourceKey - Key of the loaded painted backdrop.
 * @param wisps - Optional wisps painted over the backdrop (rng + spec).
 * @returns False when the source texture is missing.
 */
export function createSeamlessBackdropTile(
  scene: Phaser.Scene,
  key: string,
  sourceKey: string,
  wisps?: { readonly rng: RandomGenerator; readonly spec: WispSpec },
): boolean {
  if (!scene.textures.exists(sourceKey)) return false;
  const image = scene.textures.get(sourceKey).getSourceImage() as CanvasImageSource;
  const { texture, ctx } = makeCanvas(scene, key, LAYER_TILE_PX, LAYER_TILE_PX);
  const cropX = (1024 - BACKDROP_CROP_PX) / 2;
  ctx.drawImage(image, cropX, 0, BACKDROP_CROP_PX, BACKDROP_CROP_PX, 0, 0, LAYER_TILE_PX, LAYER_TILE_PX);
  const pixels = ctx.getImageData(0, 0, LAYER_TILE_PX, LAYER_TILE_PX);
  const blended = ctx.createImageData(LAYER_TILE_PX, LAYER_TILE_PX);
  blendSeamless(pixels.data, LAYER_TILE_PX, blended.data);
  ctx.putImageData(blended, 0, 0);
  if (wisps) {
    ctx.globalCompositeOperation = "lighter";
    paintWisps(ctx, wisps.rng, wisps.spec);
  }
  texture.refresh();
  return true;
}
