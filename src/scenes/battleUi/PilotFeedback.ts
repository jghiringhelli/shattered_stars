/**
 * PilotFeedback — short holo labels flashed above the player's ship when
 * the game refuses something (FIRE_SECONDARY without a lock, a Knife
 * Roll while stressed, a boost the ship has no action for…), so a refused
 * key never feels like a dropped input. The latest label is kept for e2e.
 */

import Phaser from "phaser";
import { HOLO_PALETTE } from "../../ui/theme/HoloTheme";

/** How long a label stays up (ms). */
const LABEL_MS = 900;
/** The same label is not repeated within this window (ms). */
const REPEAT_GUARD_MS = 600;
/** Label offset above the ship (px). */
const LABEL_OFFSET_Y = 46;
/** Drift upward while fading (px). */
const LABEL_RISE_PX = 18;
const LABEL_DEPTH = 40;
const LABEL_FONT_PX = 13;

export class PilotFeedback {
  private lastShown = new Map<string, number>();
  private latest: string | null = null;

  /** @param scene - The battle scene. */
  constructor(private readonly scene: Phaser.Scene) {}

  /** The latest label shown (e2e), or null. */
  get lastLabel(): string | null {
    return this.latest;
  }

  /**
   * Flash a label above a world position.
   *
   * @param label - What to say.
   * @param x - World x of the ship.
   * @param y - World y of the ship.
   * @param nowMs - Scene time (repeat guard).
   */
  show(label: string, x: number, y: number, nowMs: number): void {
    this.latest = label;
    const last = this.lastShown.get(label) ?? -Infinity;
    if (nowMs - last < REPEAT_GUARD_MS) return;
    this.lastShown.set(label, nowMs);
    const text = this.scene.add
      .text(x, y - LABEL_OFFSET_Y, label, {
        fontFamily: "monospace",
        fontSize: `${LABEL_FONT_PX}px`,
        color: `#${HOLO_PALETTE.warning.toString(16).padStart(6, "0")}`,
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(LABEL_DEPTH);
    this.scene.tweens.add({
      targets: text,
      y: text.y - LABEL_RISE_PX,
      alpha: 0,
      duration: LABEL_MS,
      onComplete: () => text.destroy(),
    });
  }

  /** Forget the repeat guard (new battle). */
  reset(): void {
    this.lastShown = new Map();
    this.latest = null;
  }
}
