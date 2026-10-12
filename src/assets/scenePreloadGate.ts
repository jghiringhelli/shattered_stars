/**
 * Scene preload gate — wraps each planned scene's `preload` so it first
 * queues the textures its {@link resolveSceneAssets} plan needs (skipping
 * cached ones) and shows a progress bar while they download. Installed once
 * from BootScene, so scenes need no per-scene loading code and BootScene
 * itself only loads what the main menu draws.
 */

import type Phaser from "phaser";
import { SCENE_ASSET_PLANS, resolveSceneAssets } from "./sceneAssetPlan";
import { queueAssets } from "./textureLoading";
import { createBootLoadingView } from "../ui/menu/BootLoadingView";

/** A scene viewed as having an optional `preload` hook. */
type PreloadableScene = Phaser.Scene & { preload?: () => void };

/** Scenes already wrapped (installing twice must not double-wrap). */
const gatedScenes = new WeakSet<Phaser.Scene>();

/**
 * @param scene - A scene in `preload` with files queued.
 */
function showProgress(scene: Phaser.Scene): void {
  const view = createBootLoadingView(scene, { paintBackground: false });
  const onProgress = (value: number): void => view.setProgress(value);
  scene.load.on("progress", onProgress);
  scene.load.once("complete", () => {
    scene.load.off("progress", onProgress);
    view.destroy();
  });
}

/**
 * @param scene - Scene to wrap.
 * @param sceneKey - Its key (selects the plan).
 */
function gateScene(scene: PreloadableScene, sceneKey: string): void {
  const original = scene.preload;
  scene.preload = function gatedPreload(this: PreloadableScene): void {
    original?.call(this);
    queueAssets(
      this,
      resolveSceneAssets(sceneKey, startDataOf(this, sceneKey)),
    );
    if (this.load.list.size > 0) showProgress(this);
  };
  gatedScenes.add(scene);
}

/**
 * @param scene - A starting scene.
 * @param sceneKey - Its key.
 * @returns The data its ships are named in: the start data, plus the
 *   registry's battle config for scenes launched from the squad builder.
 */
function startDataOf(scene: Phaser.Scene, sceneKey: string): unknown {
  const data: unknown = scene.sys.settings.data;
  if (!SCENE_ASSET_PLANS[sceneKey]?.battleConfig) return data;
  return [data, scene.registry.get("battleConfig") as unknown];
}

/**
 * Wrap every planned scene's preload (call once all scenes exist, e.g. from
 * BootScene.create).
 *
 * @param scenes - Every scene registered with the game.
 */
export function installScenePreloadGates(
  scenes: readonly Phaser.Scene[],
): void {
  for (const scene of scenes) {
    const key = scene.sys.settings.key;
    if (!SCENE_ASSET_PLANS[key] || gatedScenes.has(scene)) continue;
    gateScene(scene, key);
  }
}
