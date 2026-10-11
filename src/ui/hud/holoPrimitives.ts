/**
 * Shared Phaser primitives for holographic UI: themed text and screen pinning.
 */

import Phaser from "phaser";
import {
  HOLO_PALETTE,
  HOLO_TYPE_SCALE,
  holoTextStyle,
  type HoloTypeRole,
} from "../theme/HoloTheme";

/**
 * Create a text object in the holo type scale.
 *
 * @param scene - Owning scene.
 * @param x - Local x.
 * @param y - Local y.
 * @param content - Initial text.
 * @param role - Type-scale role.
 * @param color - Text colour; defaults to primary text.
 * @returns The text, origin (0.5, 0.5), not yet parented.
 */
export function createHoloText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  role: HoloTypeRole,
  color: number = HOLO_PALETTE.textPrimary,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, content, holoTextStyle(role, color))
    .setLetterSpacing(HOLO_TYPE_SCALE[role].letterSpacing)
    .setOrigin(0.5);
}

/** Any game object that can opt out of camera scroll. */
type ScrollPinnable = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.ScrollFactor;

/**
 * Add children to a screen-space container, pinning each to the screen.
 * Phaser applies a child's own scrollFactor when rendering through a
 * container, so every child needs scrollFactor 0, not just the parent.
 *
 * @param container - Screen-space parent.
 * @param children - Objects to add.
 */
export function addPinned(
  container: Phaser.GameObjects.Container,
  ...children: ReadonlyArray<ScrollPinnable>
): void {
  for (const child of children) {
    child.setScrollFactor(0);
    container.add(child);
  }
}

/**
 * Create an empty screen-space container (scrollFactor 0).
 *
 * @param scene - Owning scene.
 * @returns A container on the scene display list.
 */
export function createScreenContainer(
  scene: Phaser.Scene,
): Phaser.GameObjects.Container {
  return scene.add.container(0, 0).setScrollFactor(0, 0, true);
}
