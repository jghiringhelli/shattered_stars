/**
 * creatureTextures — a creature's textures on demand. The first frame draws
 * a procedural placeholder (so a creature is never invisible and no art is
 * needed at boot); the real PNG (public/assets/creatures/) is requested from
 * the scene's loader and swapped in when it arrives. Placeholder keys differ
 * from the art keys, so the real texture still loads cleanly.
 */

import type Phaser from "phaser";
import { creatureSpriteAsset } from "../../assets/assetManifest";
import { swapWhenLoaded } from "../../assets/textureLoading";

/** Which part of a creature a texture draws. */
export type CreatureTextureRole = "body" | "segment" | "pod";

const PLACEHOLDER_SIZE_PX = 128;
const PLACEHOLDER_SUFFIX = "__placeholder";
/** Ring count and line widths of the procedural placeholder body. */
const PLACEHOLDER_RINGS = 3;

/**
 * @param scene - Scene owning the texture manager.
 * @param key - The real texture key.
 * @param role - What it draws.
 * @returns The key of a procedural placeholder (created once).
 */
export function ensurePlaceholderTexture(
  scene: Phaser.Scene,
  key: string,
  role: CreatureTextureRole,
): string {
  const placeholderKey = `${key}${PLACEHOLDER_SUFFIX}`;
  if (scene.textures.exists(placeholderKey)) return placeholderKey;
  const half = PLACEHOLDER_SIZE_PX / 2;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(role === "pod" ? 0xb8a030 : 0x5a3a6a, 1);
  g.fillCircle(half, half, half * (role === "body" ? 0.9 : 0.7));
  g.lineStyle(4, 0xe8d8ff, 0.9);
  for (let ring = 1; ring <= PLACEHOLDER_RINGS; ring++)
    g.strokeCircle(half, half, (half * ring) / (PLACEHOLDER_RINGS + 0.5));
  if (role === "body") {
    g.fillStyle(0xffe08a, 1);
    g.fillTriangle(half, 6, half - 14, 34, half + 14, 34);
  }
  g.generateTexture(placeholderKey, PLACEHOLDER_SIZE_PX, PLACEHOLDER_SIZE_PX);
  g.destroy();
  return placeholderKey;
}

/**
 * Makes an image show the creature's art: the placeholder now, the PNG once
 * loaded (aspect preserved inside the box).
 *
 * @param scene - The battle scene (its loader fetches the PNG).
 * @param image - The image (created with any texture).
 * @param key - The real texture key.
 * @param role - What it draws.
 * @param boxPx - Side of the square box the art is fitted into.
 */
export function showCreatureArt(
  scene: Phaser.Scene,
  image: Phaser.GameObjects.Image,
  key: string,
  role: CreatureTextureRole,
  boxPx: number,
): void {
  if (scene.textures.exists(key)) {
    image.setTexture(key);
    image.setScale(boxPx / Math.max(image.width, image.height));
    return;
  }
  image.setTexture(ensurePlaceholderTexture(scene, key, role));
  image.setScale(boxPx / PLACEHOLDER_SIZE_PX);
  swapWhenLoaded(scene, image, creatureSpriteAsset(key), {
    maxWidth: boxPx,
    maxHeight: boxPx,
  });
}
