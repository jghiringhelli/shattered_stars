/**
 * Screen-space helpers for mode HUD widgets (wave counters, objective
 * trackers, banners): pin a whole display tree to the screen and cancel the
 * camera zoom so widgets stay pixel-stable while the battle camera zooms.
 */

import type Phaser from "phaser";
import { hudRootTransform } from "../hud/hudMath";

/** A display object that may hold children and opt out of camera scroll. */
interface PinnableNode {
  setScrollFactor?: (x: number, y?: number) => unknown;
  list?: readonly unknown[];
}

/**
 * Pin an object and every descendant to the screen (scrollFactor 0).
 * Phaser applies each child's own scrollFactor when rendering through a
 * container, so pinning only the parent is not enough.
 *
 * @param root - Object or container to pin.
 */
export function pinTree(root: Phaser.GameObjects.GameObject): void {
  const visit = (node: PinnableNode): void => {
    node.setScrollFactor?.(0, 0);
    for (const child of node.list ?? []) visit(child as PinnableNode);
  };
  visit(root as unknown as PinnableNode);
}

/** The camera fields the zoom cancel reads. */
export interface ZoomCameraLike {
  readonly zoom: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Counter-scale a screen-space container so it renders at 1:1 under any
 * camera zoom (Phaser zooms scrollFactor-0 objects around the view centre).
 *
 * @param container - Screen-space root.
 * @param camera - The scene camera.
 */
export function cancelCameraZoom(
  container: Phaser.GameObjects.Container,
  camera: ZoomCameraLike,
): void {
  const t = hudRootTransform(camera.zoom, camera.width, camera.height);
  container.setPosition(t.x, t.y).setScale(t.scale);
}
