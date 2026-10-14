/**
 * ManeuverButton — the on-screen MANEUVER button of the touch flight
 * controls (the touch twin of the keyboard's Z / the gamepad's LT):
 *
 *   tap                       → Snap Turn
 *   press + drag ← / →        → Hook Loop
 *   tap, then press + drag ← / → → Knife Roll
 *
 * It only reports "held" and a drag side; ManeuverKey decides what they
 * mean, exactly as for the other devices. Hit-testing is manual against raw
 * pointer coordinates (see TouchFlightControls for why). Also draws the
 * recharge ring other touch widgets share.
 */

import Phaser from "phaser";
import { MinHoldLatch } from "./touchLatch";

/** Button radius (px). */
export const MANEUVER_BUTTON_RADIUS = 42;
/** Horizontal drag past this (px) counts as a side. */
const DRAG_SIDE_PX = 24;
const RING_WIDTH = 6;
const RING_COLOR = 0xffcc44;
const RING_ALPHA = 0.85;

/**
 * A recharge ring around a circle: an arc that shrinks as the recharge ends.
 */
export class CooldownRing {
  private readonly graphics: Phaser.GameObjects.Graphics;

  /**
   * @param scene - Owning scene.
   * @param center - Ring centre (screen px).
   * @param radius - Ring radius (px).
   */
  constructor(
    scene: Phaser.Scene,
    private readonly center: { readonly x: number; readonly y: number },
    private readonly radius: number,
  ) {
    this.graphics = scene.add.graphics().setScrollFactor(0);
  }

  /** @returns The graphics object, to add to a container. */
  get object(): Phaser.GameObjects.Graphics {
    return this.graphics;
  }

  /**
   * @param fractionLeft - 0 = ready (no ring), 1 = just used (full ring).
   */
  draw(fractionLeft: number): void {
    this.graphics.clear();
    if (fractionLeft <= 0) return;
    this.graphics.lineStyle(RING_WIDTH, RING_COLOR, RING_ALPHA);
    this.graphics.beginPath();
    const start = -Math.PI / 2;
    this.graphics.arc(
      this.center.x,
      this.center.y,
      this.radius,
      start,
      start + Math.PI * 2 * fractionLeft,
      false,
    );
    this.graphics.strokePath();
  }
}

export class ManeuverButton {
  readonly objects: Phaser.GameObjects.GameObject[];
  private readonly ring: CooldownRing;
  private readonly held = new MinHoldLatch();
  private pointerId: number | null = null;
  private dragSide = 0;

  /**
   * @param scene - Owning scene.
   * @param center - Button centre (screen px).
   */
  constructor(
    scene: Phaser.Scene,
    private readonly center: { readonly x: number; readonly y: number },
  ) {
    const disc = scene.add
      .circle(center.x, center.y, MANEUVER_BUTTON_RADIUS, 0x335544, 0.5)
      .setStrokeStyle(2, 0x88cc99, 0.8)
      .setScrollFactor(0);
    const label = scene.add
      .text(center.x, center.y, "MNVR", {
        font: "bold 13px Arial",
        color: "#ccffdd",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.ring = new CooldownRing(scene, center, MANEUVER_BUTTON_RADIUS + 5);
    this.objects = [disc, label, this.ring.object];
  }

  /**
   * @param pointer - A pointer that just went down.
   * @param nowMs - Time (ms).
   * @returns Whether the button took it.
   */
  tryPress(pointer: Phaser.Input.Pointer, nowMs: number): boolean {
    if (this.pointerId !== null) return false;
    const dist = Phaser.Math.Distance.Between(
      pointer.x,
      pointer.y,
      this.center.x,
      this.center.y,
    );
    if (dist > MANEUVER_BUTTON_RADIUS) return false;
    this.pointerId = pointer.id;
    this.dragSide = 0;
    this.held.press(1, nowMs);
    return true;
  }

  /** @param pointer - A moving pointer (ignored unless it holds the button). */
  move(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    const dx = pointer.x - this.center.x;
    this.dragSide = dx <= -DRAG_SIDE_PX ? -1 : dx >= DRAG_SIDE_PX ? 1 : 0;
  }

  /**
   * @param pointer - A pointer that lifted.
   * @returns Whether it was the button's finger.
   */
  release(pointer: Phaser.Input.Pointer): boolean {
    if (pointer.id !== this.pointerId) return false;
    this.pointerId = null;
    this.dragSide = 0;
    this.held.release();
    return true;
  }

  /** @param nowMs - Time (ms). @returns Whether the key counts as held (taps are stretched). */
  isHeld(nowMs: number): boolean {
    return this.held.read(nowMs) !== 0;
  }

  /** @returns -1 / 0 / 1: the side the finger is dragged to. */
  steer(): number {
    return this.dragSide;
  }

  /** @param fractionLeft - Snap-turn recharge left, 0–1. */
  showCooldown(fractionLeft: number): void {
    this.ring.draw(fractionLeft);
  }
}