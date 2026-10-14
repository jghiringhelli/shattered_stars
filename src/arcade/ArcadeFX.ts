/**
 * ArcadeFX — Visual effects for special maneuvers.
 *
 * Pure Phaser-side helpers; called from ArcadeBattleScene when gestures fire.
 * Each function is self-contained: it creates, tweens, and destroys its own
 * graphics objects — the caller doesn't need to manage cleanup.
 */

import { BOOST_DISTANCE_PX } from "./ArcadeInputGestures";
import type { FlightEvent } from "./systems/PilotFlightTypes";
import { FACTION_COLORS, SHIP_SIZES, type FactionId } from "../config";
import { getShipDefinition } from "../data/ShipDefinitions";

/** Sprite radius (px) when a ship's size class is unknown. */
const FALLBACK_FX_SIZE_PX = 18;
/** Zoom-out factor of the boost speed pulse. */
const BOOST_ZOOM_PULSE = 0.88;

// ============================================
// Internal helpers
// ============================================

/**
 * Draws a translucent ship-silhouette ghost that fades out over `durationMs`.
 * Used as the base primitive for trails and afterimages.
 *
 * @param scene      - Active Phaser scene.
 * @param x          - World X.
 * @param y          - World Y.
 * @param angle      - Rotation in degrees (matches ship.angle convention).
 * @param size       - Sprite radius in pixels (from SHIP_SIZES lookup).
 * @param color      - Faction hex color.
 * @param alpha      - Starting alpha (0–1).
 * @param durationMs - Fade duration before the object is destroyed.
 */
function spawnGhost(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: number,
  alpha: number,
  durationMs: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(0, -size * 0.55);
  g.lineTo(-size * 0.3, size * 0.45);
  g.lineTo(0, size * 0.25);
  g.lineTo(size * 0.3, size * 0.45);
  g.closePath();
  g.fillPath();
  g.setPosition(x, y);
  g.setAngle(angle);
  g.setAlpha(alpha);
  g.setDepth(8);
  scene.tweens.add({
    targets: g,
    alpha: 0,
    duration: durationMs,
    ease: "Power2",
    onComplete: () => g.destroy(),
  });
}

// ============================================
// Public effects
// ============================================

/**
 * Spawns a boost trail: three ghost silhouettes placed behind the ship along the
 * boost vector, plus a thruster flare burst at the departure point.
 * Call this BEFORE applying the boost position offset so the ghosts appear at the
 * original position and trail backward.
 *
 * @param scene         - Active Phaser scene.
 * @param x             - Ship X before the boost.
 * @param y             - Ship Y before the boost.
 * @param angle         - Ship heading in degrees.
 * @param size          - Ship sprite radius.
 * @param color         - Faction hex color.
 * @param boostDistance - Boost dash distance in pixels.
 */
export function spawnBoostTrail(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: number,
  boostDistance: number,
): void {
  const rad = (angle - 90) * (Math.PI / 180);

  // Three ghost silhouettes spaced along the backward path
  for (let i = 1; i <= 3; i++) {
    const t = i / 3;
    const gx = x - Math.cos(rad) * boostDistance * t * 0.7;
    const gy = y - Math.sin(rad) * boostDistance * t * 0.7;
    spawnGhost(
      scene,
      gx,
      gy,
      angle,
      size,
      color,
      0.55 - t * 0.12,
      250 + i * 70,
    );
  }

  // Thruster flare burst — expanding blaze at the ship rear
  const flare = scene.add.graphics();
  flare.fillStyle(0xff7700, 1);
  flare.fillCircle(0, 0, size * 0.9);
  flare.fillStyle(0xffdd44, 0.8);
  flare.fillCircle(0, 0, size * 0.45);
  const rearX = x - Math.cos(rad) * size * 0.5;
  const rearY = y - Math.sin(rad) * size * 0.5;
  flare.setPosition(rearX, rearY);
  flare.setDepth(9);
  scene.tweens.add({
    targets: flare,
    alpha: 0,
    scaleX: 3.0,
    scaleY: 3.0,
    duration: 300,
    ease: "Power3",
    onComplete: () => flare.destroy(),
  });
}

/**
 * Plays a barrel-roll lean on a ship sprite container: the sprite's scaleX
 * sweeps 1 → −1 → 1, giving the illusion of a lateral 3-D coin-flip.
 * Any in-progress lean tween is cancelled first to prevent overlap.
 *
 * @param scene      - Active Phaser scene.
 * @param sprite     - The ship's container sprite.
 * @param durationMs - Total lean duration in ms (default 500 to match maneuver).
 */
export function playBarrelRollLean(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Container,
  durationMs = 500,
): void {
  scene.tweens.killTweensOf(sprite);
  sprite.setScale(1, 1);

  scene.tweens.add({
    targets: sprite,
    scaleX: -1,
    duration: durationMs * 0.5,
    ease: "Sine.easeInOut",
    yoyo: true,
    onComplete: () => sprite.setScale(1, 1),
  });
}

/**
 * Spawns a Snap turn afterimage: one ghost at the flip origin pointing the old
 * heading, plus an expanding ghost-ring suggesting the 180° arc of the turn.
 *
 * @param scene - Active Phaser scene.
 * @param x     - Flip origin X.
 * @param y     - Flip origin Y.
 * @param angle - Ship heading *before* the Snap turn.
 * @param size  - Ship sprite radius.
 * @param color - Faction hex color.
 */
export function spawnKturnAfterimage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: number,
): void {
  // Ghost silhouette pointing the old direction
  spawnGhost(scene, x, y, angle, size, color, 0.7, 600);

  // Expanding arc ring at the flip point
  const ring = scene.add.graphics();
  ring.lineStyle(2, color, 0.9);
  ring.strokeCircle(0, 0, size * 1.2);
  ring.setPosition(x, y);
  ring.setDepth(8);
  scene.tweens.add({
    targets: ring,
    alpha: 0,
    scaleX: 2.8,
    scaleY: 2.8,
    duration: 500,
    ease: "Power2",
    onComplete: () => ring.destroy(),
  });
}

/** What {@link playFlightEventFx} needs to know about the acting ship. */
export interface FlightEventFxInput {
  readonly event: FlightEvent;
  /** Pose before the action (trails and afterimages start here). */
  readonly origin: {
    readonly x: number;
    readonly y: number;
    readonly angle: number;
  };
  readonly definitionId: string;
  readonly faction: string;
  /** The ship's sprite, for the barrel-roll lean. */
  readonly sprite: Phaser.GameObjects.Container | undefined;
  /** Shake the camera on a boost (player ship, shake setting on). */
  readonly cameraShake: boolean;
  /** Zoom-pulse the camera on a boost for speed sensation (player ship). */
  readonly zoomPulse: boolean;
}

/**
 * Visual feedback for a flight event (Snap turn/Hook/Knife afterimage,
 * barrel-roll lean, boost trail). Shared by every cycle-engine scene.
 *
 * @param scene - Active Phaser scene.
 * @param input - The event and the ship that performed it.
 */
export function playFlightEventFx(
  scene: Phaser.Scene,
  input: FlightEventFxInput,
): void {
  const { event, origin } = input;
  const size =
    SHIP_SIZES[
      getShipDefinition(input.definitionId)?.baseStats.size ?? "small"
    ] ?? FALLBACK_FX_SIZE_PX;
  const color = FACTION_COLORS[input.faction as FactionId] ?? 0xffffff;
  if (event === "kturn" || event === "segnor" || event === "tallon") {
    spawnKturnAfterimage(scene, origin.x, origin.y, origin.angle, size, color);
  } else if (event === "barrel_roll") {
    if (input.sprite) playBarrelRollLean(scene, input.sprite);
  } else if (event === "boost") {
    spawnBoostTrail(
      scene,
      origin.x,
      origin.y,
      origin.angle,
      size,
      color,
      BOOST_DISTANCE_PX,
    );
    const camera = scene.cameras.main;
    if (input.cameraShake) camera.shake(80, 0.008);
    if (!input.zoomPulse) return;
    scene.tweens.add({
      targets: camera,
      zoom: camera.zoom * BOOST_ZOOM_PULSE,
      duration: 120,
      ease: "Power2.easeIn",
      yoyo: true,
    });
  }
}
