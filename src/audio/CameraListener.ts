/**
 * Adapter between a Phaser camera and the audio listener.
 *
 * Kept out of `AudioManager` so the manager stays free of Phaser: the mixer
 * only ever deals in world coordinates, and this is the one place that knows
 * a camera exists.
 */

import { audioManager } from "./AudioManager";

/**
 * How far past the edge of the screen a sound is still audible.
 *
 * Above 1 so a firefight fades in as it approaches the viewport rather than
 * snapping on the moment it crosses the boundary.
 */
const AUDIBLE_SCREENS = 1.6;

/** Just what this module needs from a camera, so tests need no Phaser. */
interface CameraLike {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
  readonly worldView?: { readonly centerX: number; readonly centerY: number };
}

/**
 * Point the listener at whatever the camera is showing.
 *
 * Call once per frame from a battle scene's `update`. Without it the listener
 * stays at the world origin and every sound is mixed as though the player were
 * parked in the corner of the map.
 *
 * @param camera - The scene's active camera.
 */
export function syncListenerToCamera(camera: CameraLike): void {
  const visibleWidth = camera.width / camera.zoom;
  const visibleHeight = camera.height / camera.zoom;
  const centerX =
    camera.worldView?.centerX ?? camera.scrollX + visibleWidth / 2;
  const centerY =
    camera.worldView?.centerY ?? camera.scrollY + visibleHeight / 2;

  audioManager.setListener(centerX, centerY);

  const halfWidth = visibleWidth / 2;
  audioManager.setListeningField(
    Math.hypot(halfWidth, visibleHeight / 2) * AUDIBLE_SCREENS,
    halfWidth,
  );
}
