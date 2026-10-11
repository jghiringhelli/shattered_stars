/**
 * ArcadeHudAlerts — transient HUD call-outs for the Skirmish scene: the
 * pulsing STRESSED label under the player's status ring, the flee warning
 * with its arrow toward the nearest enemy, and the one-line controls hint.
 */

import Phaser from "phaser";
import { addPinned, createHoloText } from "../../ui/hud/holoPrimitives";
import { HOLO_PALETTE, HOLO_SPACING } from "../../ui/theme/HoloTheme";

/** Text of the stress call-out. */
export const STRESSED_LABEL = "STRESSED";
/** Period of the stress pulse (ms). */
const STRESS_PULSE_PERIOD_MS = 700;
/** Lowest alpha of the pulse — the label stays legible throughout. */
const STRESS_MIN_ALPHA = 0.6;
/** Stress label distance below screen centre — just under the status ring. */
const STRESS_ALERT_BELOW_CENTER = 84;
/** Flee warning sits this far below the top-centre clock panel. */
const FLEE_TOP = 92;
/** Gap between the flee text and its arrow. */
const FLEE_ARROW_GAP = 34;
/** Arrow triangle (nose, tail half-width, tail depth) in px. */
const FLEE_ARROW = { nose: 18, halfWidth: 10, depth: 12 } as const;
/** Bottom-left controls hint. */
export const CONTROLS_HINT = "ESC  PAUSE · CONTROLS";

/** Pulsing "STRESSED" label under the player's status ring. */
export class StressAlert {
  private readonly text: Phaser.GameObjects.Text;

  /**
   * @param scene - Owning scene.
   * @param parent - Screen-space HUD root.
   */
  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container) {
    this.text = createHoloText(
      scene,
      0,
      0,
      "",
      "heading",
      HOLO_PALETTE.danger,
    ).setStroke("#000000", 3);
    addPinned(parent, this.text);
  }

  /** "STRESSED" while the pilot is stressed, else "". */
  get label(): string {
    return this.text.text;
  }

  /**
   * Centre the label just below the player's status ring (the camera keeps
   * the player at screen centre), clear of the edge arrows.
   *
   * @param width - Screen width.
   * @param height - Screen height.
   */
  layout(width: number, height: number): void {
    this.text.setPosition(width / 2, height / 2 + STRESS_ALERT_BELOW_CENTER);
  }

  /**
   * @param isStressed - Latched stressed flag.
   * @param nowMs - Scene time, drives the pulse.
   */
  update(isStressed: boolean, nowMs: number): void {
    const label = isStressed ? STRESSED_LABEL : "";
    if (this.text.text !== label) this.text.setText(label);
    const wave = Math.abs(Math.sin((Math.PI * nowMs) / STRESS_PULSE_PERIOD_MS));
    this.text.setAlpha(STRESS_MIN_ALPHA + (1 - STRESS_MIN_ALPHA) * wave);
  }
}

/** "Return to combat" countdown with an arrow toward the nearest enemy. */
export class FleeWarning {
  /** The warning text (read by e2e wiring checks). */
  readonly text: Phaser.GameObjects.Text;
  private readonly arrow: Phaser.GameObjects.Graphics;

  /**
   * @param scene - Owning scene.
   * @param parent - Screen-space HUD root.
   */
  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container) {
    this.text = createHoloText(scene, 0, 0, "", "heading", HOLO_PALETTE.danger)
      .setOrigin(0.5, 0)
      .setStroke("#000000", 3)
      .setVisible(false);
    this.arrow = scene.add.graphics().setVisible(false);
    this.arrow.fillStyle(HOLO_PALETTE.danger, 1);
    this.arrow.lineStyle(1.5, HOLO_PALETTE.panelFill, 1);
    this.arrow.beginPath();
    this.arrow.moveTo(FLEE_ARROW.nose, 0);
    this.arrow.lineTo(-FLEE_ARROW.depth, -FLEE_ARROW.halfWidth);
    this.arrow.lineTo(-FLEE_ARROW.depth, FLEE_ARROW.halfWidth);
    this.arrow.closePath();
    this.arrow.fillPath();
    this.arrow.strokePath();
    addPinned(parent, this.text, this.arrow);
  }

  /**
   * @param width - Screen width.
   */
  layout(width: number): void {
    this.text.setPosition(width / 2, FLEE_TOP);
    this.arrow.setPosition(
      width / 2,
      FLEE_TOP + FLEE_ARROW_GAP + HOLO_SPACING.md,
    );
  }

  /**
   * Show the countdown.
   *
   * @param secondsLeft - Time until the battle ends as a retreat.
   * @param bearingRad - Screen direction to the nearest enemy, or null.
   */
  show(secondsLeft: number, bearingRad: number | null): void {
    this.text
      .setText(`⚠ RETURN TO COMBAT — battle ends in ${secondsLeft.toFixed(1)}s`)
      .setVisible(true);
    this.arrow.setVisible(bearingRad !== null);
    if (bearingRad !== null) this.arrow.setRotation(bearingRad);
  }

  /** Hide text and arrow. */
  hide(): void {
    this.text.setVisible(false);
    this.arrow.setVisible(false);
  }
}

/**
 * One-line controls hint, bottom left.
 *
 * @param scene - Owning scene.
 * @param parent - Screen-space HUD root.
 * @returns The hint text (origin bottom-left); position it with `setPosition`.
 */
export function createControlsHint(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
): Phaser.GameObjects.Text {
  const hint = createHoloText(
    scene,
    0,
    0,
    CONTROLS_HINT,
    "caption",
    HOLO_PALETTE.textMuted,
  ).setOrigin(0, 1);
  addPinned(parent, hint);
  return hint;
}
