/**
 * hitArea — hit shapes for Containers. Phaser hit-tests a sized Container in
 * 0..width space measured from its CENTRE, so a container positioned at its
 * top-left corner needs the rectangle shifted by half its size.
 */

import Phaser from "phaser";

/**
 * @param width - Container width.
 * @param height - Container height.
 * @returns A hit rectangle covering a container placed at its top-left corner.
 */
export function topLeftHitArea(width: number, height: number): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(width / 2, height / 2, width, height);
}
