/**
 * UIJuice — small reusable tween-based "juice" effects (punchy hover/press
 * feedback, shake-on-error, breathing selection glow) shared by every menu
 * button and picker across the game, so motion feels consistent everywhere.
 */

import Phaser from "phaser";

const PULSE_TWEEN_KEY = "_juicePulseTween";

/**
 * Smoothly tweens a target's scale to `scale` (replaces an instant `setScale`
 * hover/select snap with a springy ease-out).
 */
export function tweenScale(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Components.Transform,
  scale: number,
  durationMs = 120,
): void {
  scene.tweens.killTweensOf(target);
  scene.tweens.add({
    targets: target,
    scaleX: scale,
    scaleY: scale,
    duration: durationMs,
    ease: "Back.Out",
  });
}

/**
 * Quick "punch" bounce — scales up past the target then settles back down.
 * Use as click/confirm feedback (ship added, loadout picked, battle launched).
 */
export function punch(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Components.Transform,
  opts: { scale?: number; durationMs?: number } = {},
): void {
  const { scale = 1.18, durationMs = 220 } = opts;
  scene.tweens.killTweensOf(target);
  scene.tweens.add({
    targets: target,
    scaleX: scale,
    scaleY: scale,
    duration: durationMs / 2,
    ease: "Sine.Out",
    yoyo: true,
  });
}

/**
 * Short horizontal shake — feedback for a blocked/invalid action (e.g. START
 * BATTLE with an empty squad). Restores the original position when done.
 */
export function shake(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Components.Transform & { x: number },
  opts: { intensity?: number; durationMs?: number } = {},
): void {
  const { intensity = 8, durationMs = 300 } = opts;
  const originX = target.x;
  scene.tweens.killTweensOf(target);
  scene.tweens.add({
    targets: target,
    x: { from: originX - intensity, to: originX + intensity },
    duration: durationMs / 6,
    ease: "Sine.InOut",
    yoyo: true,
    repeat: 5,
    onComplete: () => {
      target.x = originX;
    },
  });
}

/**
 * Starts a slow breathing scale pulse (yoyo, infinite repeat) — used to draw
 * the eye to the currently-selected menu item without being static/dead.
 * Returns the tween so the caller can stop it via {@link stopPulse}.
 */
export function pulse(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Components.Transform,
  opts: { scale?: number; durationMs?: number } = {},
): Phaser.Tweens.Tween {
  const { scale = 1.06, durationMs = 700 } = opts;
  const existing = (target as unknown as Record<string, unknown>)[
    PULSE_TWEEN_KEY
  ] as Phaser.Tweens.Tween | undefined;
  existing?.stop();
  const tween = scene.tweens.add({
    targets: target,
    scaleX: scale,
    scaleY: scale,
    duration: durationMs,
    ease: "Sine.InOut",
    yoyo: true,
    repeat: -1,
  });
  (target as unknown as Record<string, unknown>)[PULSE_TWEEN_KEY] = tween;
  return tween;
}

/** Stops a pulse started by {@link pulse} and resets scale to 1. */
export function stopPulse(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Components.Transform,
): void {
  const tween = (target as unknown as Record<string, unknown>)[
    PULSE_TWEEN_KEY
  ] as Phaser.Tweens.Tween | undefined;
  tween?.stop();
  scene.tweens.killTweensOf(target);
  target.setScale(1);
}
