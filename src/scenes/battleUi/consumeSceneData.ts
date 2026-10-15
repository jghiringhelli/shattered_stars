/**
 * consumeSceneData — Phaser keeps a scene's start data when the scene is
 * started or restarted WITHOUT data, so a one-shot flag such as `rematch`
 * would fire again on the next plain entry. Call this from `init` after
 * reading the flag.
 */

import type Phaser from "phaser";

/**
 * Forget the scene's start data.
 *
 * @param scene - The scene whose `init` just read its data.
 */
export function consumeSceneData(scene: Phaser.Scene): void {
  scene.sys.settings.data = {};
}
