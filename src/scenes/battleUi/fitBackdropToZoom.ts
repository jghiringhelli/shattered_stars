/**
 * fitBackdropToZoom — grow a scene's screen-pinned painted backdrop
 * (addPaintedSpaceBackground) so it still fills the view when the camera
 * zooms out: Phaser scales scrollFactor(0) objects about the viewport centre
 * by the zoom, so a screen-sized image shrinks into a framed rectangle.
 */

import Phaser from "phaser";

/**
 * @param scene - Scene that added the backdrop.
 * @param textureId - The backdrop's texture id (as passed to addPaintedSpaceBackground).
 * @param minZoom - The smallest camera zoom the scene allows.
 */
export function fitBackdropToZoom(
  scene: Phaser.Scene,
  textureId: string,
  minZoom: number,
): void {
  const key = `bg_${textureId}`;
  const backdrop = scene.children.list.find(
    (child): child is Phaser.GameObjects.Image =>
      child instanceof Phaser.GameObjects.Image && child.texture.key === key,
  );
  if (!backdrop || !(minZoom > 0)) return;
  backdrop.setDisplaySize(
    scene.scale.width / minZoom,
    scene.scale.height / minZoom,
  );
}
