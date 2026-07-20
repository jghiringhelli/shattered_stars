/**
 * textFlash — Lightweight tween-based text feedback for Phaser Text objects.
 * Temporarily replaces text content and color, then reverts after a pulse animation.
 */

import Phaser from "phaser";

const FLASH_TWEEN_KEY = "_flashTween";

/**
 * Flash a Phaser text element with a temporary message and color pulse.
 * Cancels any in-flight flash on the same element before starting.
 *
 * @param scene      - Active Phaser scene (provides tweens).
 * @param text       - Text object to flash.
 * @param opts       - Flash configuration.
 * @param opts.message    - Temporary message (omit to keep current text).
 * @param opts.color      - Pulse color (default "#ff8844").
 * @param opts.durationMs - Total flash duration in ms (default 1500).
 */
export function flashText(
  scene: Phaser.Scene,
  text: Phaser.GameObjects.Text,
  opts: {
    message?: string;
    color?: string;
    durationMs?: number;
  },
): void {
  const prev = text.getData(FLASH_TWEEN_KEY) as Phaser.Tweens.Tween | null;
  if (prev?.isPlaying()) prev.stop();

  const origText = text.text;
  const origColor = text.style.color as string;

  if (opts.message) text.setText(opts.message);
  text.setColor(opts.color ?? "#ff8844");

  const tween = scene.tweens.add({
    targets: text,
    alpha: { from: 1, to: 0.3 },
    yoyo: true,
    repeat: 1,
    duration: (opts.durationMs ?? 1500) / 4,
    onComplete: () => {
      text.setText(origText);
      text.setColor(origColor);
      text.setAlpha(1);
    },
  });

  text.setData(FLASH_TWEEN_KEY, tween);
}
