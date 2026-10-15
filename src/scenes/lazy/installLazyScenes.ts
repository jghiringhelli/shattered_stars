import type Phaser from "phaser";
import { installScenePreloadGates } from "../../assets/scenePreloadGate";
import { LazySceneRegistry, type SceneManagerLike } from "./LazySceneRegistry";
import { createLazySceneNotice } from "./LazySceneNotice";
import { LAZY_SCENES } from "./lazySceneManifest";

/**
 * Makes every scene of {@link LAZY_SCENES} start transparently: call right after
 * `new Phaser.Game(...)` (before it boots). Late-registered scenes get the same
 * asset preload gate BootScene installs for eager scenes.
 *
 * @param game - A freshly constructed game.
 * @returns The registry (`ensureScene(key)` loads a scene without starting it).
 */
export function installLazyScenes(game: Phaser.Game): LazySceneRegistry {
  const notice = createLazySceneNotice(document);
  const registry = new LazySceneRegistry(game.scene as unknown as SceneManagerLike, LAZY_SCENES, {
    onLoadStart: notice.begin,
    onLoadEnd: notice.end,
    onSceneAdded: (key) => {
      const scene = game.scene.getScene(key);
      if (scene) installScenePreloadGates([scene]);
    },
    onError: (key, error) => {
      console.error(`Could not load scene ${key}`, error);
      notice.fail();
    },
  });
  registry.install();
  return registry;
}
