/**
 * Texture loading helpers on top of the asset manifest: queue only what is
 * missing from the texture cache, load a texture on demand after `create()`,
 * and swap a placeholder image to the real texture once it arrives.
 *
 * On-demand loads use the calling scene's loader and listen for the global
 * texture manager's `addtexture-<key>` event, so they work for images and
 * atlases alike and resolve even if another scene loads the same key.
 */

import { baseDisplaySize, recordBaseScale } from "./baseScale";
import type Phaser from "phaser";
import type { AssetEntry } from "./assetManifest";

/** Phaser event names (strings, so this module stays node-testable). */
const TEXTURE_ADDED_PREFIX = "addtexture-"; // Phaser.Textures.Events.ADD_KEY
const LOAD_ERROR = "loaderror"; // LOAD_ERROR
const SCENE_SHUTDOWN = "shutdown"; // SCENE_SHUTDOWN

/** Box an image is fitted into after its real texture arrives. */
export type SwapFit =
  "stretch" | { readonly maxWidth: number; readonly maxHeight: number };

/**
 * Queue every entry whose key is not cached yet (call from `preload`, or
 * follow with `load.start()`).
 *
 * @param scene - Scene whose loader to use.
 * @param entries - Wanted textures.
 * @returns How many entries were queued.
 */
export function queueAssets(
  scene: Phaser.Scene,
  entries: readonly AssetEntry[],
): number {
  let queued = 0;
  for (const entry of entries) {
    if (scene.textures.exists(entry.key)) continue;
    if (entry.kind === "atlas")
      scene.load.atlas(entry.key, entry.url, entry.atlasUrl);
    else scene.load.image(entry.key, entry.url);
    queued++;
  }
  return queued;
}

/**
 * Load one texture now (outside `preload`) and call back when it is cached.
 * Already-cached textures call back synchronously. Pending callbacks are
 * dropped when the scene shuts down.
 *
 * @param scene - Requesting scene.
 * @param entry - Texture to load.
 * @param onReady - Called once the texture exists.
 * @param onFailed - Called if the file fails to load (404, decode error).
 */
export function requestTexture(
  scene: Phaser.Scene,
  entry: AssetEntry,
  onReady: () => void,
  onFailed?: () => void,
): void {
  if (scene.textures.exists(entry.key)) {
    onReady();
    return;
  }
  const readyEvent = `${TEXTURE_ADDED_PREFIX}${entry.key}`;
  const onError = (file: Phaser.Loader.File): void => {
    if (file.key !== entry.key) return;
    cleanup();
    onFailed?.();
  };
  const onAdded = (): void => {
    cleanup();
    onReady();
  };
  const cleanup = (): void => {
    scene.textures.off(readyEvent, onAdded);
    scene.load.off(LOAD_ERROR, onError);
    scene.events.off(SCENE_SHUTDOWN, cleanup);
  };
  scene.textures.once(readyEvent, onAdded);
  scene.load.on(LOAD_ERROR, onError);
  scene.events.once(SCENE_SHUTDOWN, cleanup);
  queueAssets(scene, [entry]);
  if (!scene.load.isLoading()) scene.load.start();
}

/**
 * Show `image` with whatever placeholder it has now and switch it to
 * `entry`'s texture once loaded, keeping its on-screen footprint.
 *
 * @param scene - Owning scene.
 * @param image - Image currently showing a placeholder texture.
 * @param entry - The real texture.
 * @param fit - "stretch" keeps the current display size; a box contains the
 *   new texture inside it (aspect preserved).
 */
export function swapWhenLoaded(
  scene: Phaser.Scene,
  image: Phaser.GameObjects.Image,
  entry: AssetEntry,
  fit: SwapFit,
): void {
  if (image.texture.key === entry.key) return;
  requestTexture(scene, entry, () => {
    if (!image.active) return;
    // The rest size, not displayWidth: a banking squash must not leak in.
    const { width, height } = baseDisplaySize(image);
    image.setTexture(entry.key);
    if (fit === "stretch") {
      image.setDisplaySize(width, height);
    } else {
      image.setScale(
        Math.min(fit.maxWidth / image.width, fit.maxHeight / image.height),
      );
    }
    recordBaseScale(image);
  });
}
