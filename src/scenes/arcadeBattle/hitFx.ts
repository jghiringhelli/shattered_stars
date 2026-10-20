/**
 * hitFx — cheap feedback for a bolt that struck a ship still immune to its
 * attacker this cycle (tabletop round tempo): a small ring that pops and fades.
 */

import Phaser from "phaser";
import { HOLO_PALETTE } from "../../ui/theme/HoloTheme";

/** Ring radius at spawn (px). */
const DEFLECT_RADIUS_PX = 6;
/** How much the ring grows while fading. */
const DEFLECT_GROWTH = 2.2;
/** Fade duration (ms). */
const DEFLECT_FADE_MS = 160;
/** Above ships (10–20), below the HUD. */
const DEFLECT_DEPTH = 30;

/**
 * Spawn a deflect flash at a world position; it destroys itself.
 *
 * @param scene - The battle scene.
 * @param x - World x of the impact.
 * @param y - World y of the impact.
 */
export function spawnDeflectFlash(
  scene: Phaser.Scene,
  x: number,
  y: number,
): void {
  const ring = scene.add.graphics().setPosition(x, y).setDepth(DEFLECT_DEPTH);
  ring.lineStyle(1.5, HOLO_PALETTE.shield, 1);
  ring.strokeCircle(0, 0, DEFLECT_RADIUS_PX);
  scene.tweens.add({
    targets: ring,
    alpha: 0,
    scale: DEFLECT_GROWTH,
    duration: DEFLECT_FADE_MS,
    onComplete: () => ring.destroy(),
  });
}
