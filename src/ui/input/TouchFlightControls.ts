/**
 * Dual-circle touch flight controls: a left analog movement stick (steer +
 * thrust combined, like a real joystick) and a right action zone (tap /
 * double-tap / hold gestures bound to ActionIntents).
 *
 * Hit-testing is done manually against raw pointer.x/y instead of Phaser's
 * setInteractive()/hit-area system: a scrollFactor(0) GameObject's hit-test
 * silently breaks when the camera zoom != 1.0 (found and fixed repeatedly
 * this session in DogfightScene/AceDuelScene/etc. setup screens and pause
 * menus) — since these controls are visible DURING gameplay while the
 * camera is actively zoomed, they'd hit that exact bug. Raw pointer
 * coordinates are always correct screen-space regardless of zoom, so a
 * manual distance check sidesteps the issue entirely.
 */

import Phaser from "phaser";
import type { ActionIntent, TouchBinding } from "../../input/InputTypes";
import type { FlightCooldowns } from "../../input/flightCooldowns";
import { CooldownRing, ManeuverButton } from "./ManeuverButton";
import { DoubleTapTracker, MinHoldLatch } from "./touchLatch";

export interface TouchFlightControlsConfig {
  readonly scene: Phaser.Scene;
  readonly touchBindings: readonly TouchBinding[];
}

const STICK_RADIUS = 70;
const STICK_ACTIVATION_RADIUS = STICK_RADIUS * 1.6;
const ACTION_ZONE_RADIUS = 55;
const DOUBLE_TAP_WINDOW_MS = 350;
const HOLD_THRESHOLD_MS = 400;
/** Stick push must be at least this dominant vertically (and not too much sideways) to count as an up/down tap for BOOST/KTURN. */
const VERTICAL_TAP_THRESHOLD = 0.6;
const VERTICAL_TAP_MAX_SIDEWAYS = 0.4;
const MANEUVER_BUTTON_OFFSET = { x: 250, y: 95 };

export class TouchFlightControls extends Phaser.GameObjects.Container {
  private readonly stickCenter = { x: 0, y: 0 };
  private readonly actionCenter = { x: 0, y: 0 };
  private stickKnob!: Phaser.GameObjects.Arc;
  private actionZone!: Phaser.GameObjects.Arc;

  private stickPointerId: number | null = null;
  private steerValue = 0;
  private thrustValue = 0;
  private stickPeakThrust = 0;
  private stickPeakSteer = 0;
  private readonly steerLatch = new MinHoldLatch();
  private readonly upTaps = new DoubleTapTracker();
  private readonly downTaps = new DoubleTapTracker();
  private maneuverButton!: ManeuverButton;
  private rollRing!: CooldownRing;

  private actionPointerId: number | null = null;
  private actionDownAt = 0;
  private actionHoldFired = false;
  private lastActionTapReleaseAt = 0;
  private pendingSingleTapTimer: Phaser.Time.TimerEvent | null = null;

  private pendingIntents: Array<{ intent: ActionIntent; value: number }> = [];

  constructor(private readonly touchConfig: TouchFlightControlsConfig) {
    super(touchConfig.scene, 0, 0);
    this.setScrollFactor(0).setDepth(3000);

    const { width, height } = touchConfig.scene.scale;
    this.stickCenter.x = 140;
    this.stickCenter.y = height - 150;
    this.actionCenter.x = width - 120;
    this.actionCenter.y = height - 150;

    this.buildStick();
    this.buildActionZone();
    this.buildManeuverButton(width, height);

    touchConfig.scene.add.existing(this);
    touchConfig.scene.input.on("pointerdown", this.onPointerDown, this);
    touchConfig.scene.input.on("pointermove", this.onPointerMove, this);
    touchConfig.scene.input.on("pointerup", this.onPointerUp, this);
    touchConfig.scene.input.on("pointerupoutside", this.onPointerUp, this);
  }

  private buildStick(): void {
    const base = this.scene.add.circle(
      this.stickCenter.x,
      this.stickCenter.y,
      STICK_RADIUS,
      0x333355,
      0.5,
    );
    base.setStrokeStyle(2, 0x8888cc, 0.8).setScrollFactor(0);
    this.stickKnob = this.scene.add.circle(
      this.stickCenter.x,
      this.stickCenter.y,
      STICK_RADIUS * 0.45,
      0x6688ff,
      0.8,
    );
    this.stickKnob.setScrollFactor(0);
    this.add([base, this.stickKnob]);
  }

  private buildManeuverButton(width: number, height: number): void {
    this.maneuverButton = new ManeuverButton(this.scene, {
      x: width - MANEUVER_BUTTON_OFFSET.x,
      y: height - MANEUVER_BUTTON_OFFSET.y,
    });
    this.rollRing = new CooldownRing(
      this.scene,
      this.stickCenter,
      STICK_RADIUS + 6,
    );
    this.add([...this.maneuverButton.objects, this.rollRing.object]);
  }

  /** @param cooldowns - Roll (ring on the stick) and Snap turn (ring on MANEUVER) recharge. */
  showCooldowns(cooldowns: FlightCooldowns): void {
    this.rollRing.draw(cooldowns.roll);
    this.maneuverButton.showCooldown(cooldowns.snap);
  }

  /** @returns Whether the MANEUVER button is down (a tap stays down briefly). */
  isManeuverHeld(): boolean {
    return this.maneuverButton.isHeld(this.scene.time.now);
  }

  /** @returns -1 / 0 / 1: the side the MANEUVER finger is dragged to. */
  getManeuverSteer(): number {
    return this.maneuverButton.steer();
  }

  private buildActionZone(): void {
    this.actionZone = this.scene.add.circle(
      this.actionCenter.x,
      this.actionCenter.y,
      ACTION_ZONE_RADIUS,
      0x553333,
      0.5,
    );
    this.actionZone.setStrokeStyle(2, 0xcc8888, 0.8).setScrollFactor(0);
    const label = this.scene.add
      .text(this.actionCenter.x, this.actionCenter.y, "FIRE", {
        font: "bold 14px Arial",
        color: "#ffcccc",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.add([this.actionZone, label]);
  }

  /** Called once per frame from TouchAdapter.poll() to check hold-threshold crossing. */
  update(time: number): void {
    if (
      this.actionPointerId !== null &&
      !this.actionHoldFired &&
      time - this.actionDownAt > HOLD_THRESHOLD_MS
    ) {
      this.actionHoldFired = true;
      this.queueBoundIntent("hold");
    }
  }

  /**
   * @returns The steer value. A tap on the left/right half of the stick is
   *   already a steer to that side (the touch lands off-centre), held at
   *   least a moment so a quick tap is never lost between polls — two of
   *   them are the barrel-roll double-tap, like ← ← / → → on a keyboard.
   */
  getSteerValue(): number {
    return this.steerLatch.read(this.scene.time.now);
  }

  getThrustValue(): number {
    return this.thrustValue;
  }

  /** Drains and returns all discrete (edge-triggered) intents queued since the last poll. */
  consumePendingIntents(): Array<{ intent: ActionIntent; value: number }> {
    const pending = this.pendingIntents;
    this.pendingIntents = [];
    return pending;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const distToStick = Phaser.Math.Distance.Between(
      pointer.x,
      pointer.y,
      this.stickCenter.x,
      this.stickCenter.y,
    );
    if (
      this.stickPointerId === null &&
      distToStick <= STICK_ACTIVATION_RADIUS
    ) {
      this.stickPointerId = pointer.id;
      this.stickPeakThrust = 0;
      this.stickPeakSteer = 0;
      this.updateStickFromPointer(pointer);
      return;
    }

    if (this.maneuverButton.tryPress(pointer, this.scene.time.now)) return;

    const distToAction = Phaser.Math.Distance.Between(
      pointer.x,
      pointer.y,
      this.actionCenter.x,
      this.actionCenter.y,
    );
    if (this.actionPointerId === null && distToAction <= ACTION_ZONE_RADIUS) {
      this.actionPointerId = pointer.id;
      this.actionDownAt = this.scene.time.now;
      this.actionHoldFired = false;
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.stickPointerId) {
      this.updateStickFromPointer(pointer);
    }
    this.maneuverButton.move(pointer);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.stickPointerId) {
      this.releaseStick();
      return;
    }
    if (this.maneuverButton.release(pointer)) return;
    if (pointer.id === this.actionPointerId) {
      this.releaseActionZone();
    }
  }

  private updateStickFromPointer(pointer: Phaser.Input.Pointer): void {
    let dx = pointer.x - this.stickCenter.x;
    let dy = pointer.y - this.stickCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > STICK_RADIUS) {
      dx = (dx / dist) * STICK_RADIUS;
      dy = (dy / dist) * STICK_RADIUS;
    }
    this.stickKnob.setPosition(
      this.stickCenter.x + dx,
      this.stickCenter.y + dy,
    );

    this.steerValue = Phaser.Math.Clamp(dx / STICK_RADIUS, -1, 1);
    this.steerLatch.press(this.steerValue, this.scene.time.now);
    this.thrustValue = Phaser.Math.Clamp(-dy / STICK_RADIUS, -1, 1);
    this.stickPeakThrust =
      Math.abs(this.thrustValue) > Math.abs(this.stickPeakThrust)
        ? this.thrustValue
        : this.stickPeakThrust;
    this.stickPeakSteer =
      Math.abs(this.steerValue) > Math.abs(this.stickPeakSteer)
        ? this.steerValue
        : this.stickPeakSteer;
  }

  private releaseStick(): void {
    this.stickPointerId = null;
    this.stickKnob.setPosition(this.stickCenter.x, this.stickCenter.y);
    this.steerLatch.release();

    const wasVerticalTap =
      Math.abs(this.stickPeakThrust) >= VERTICAL_TAP_THRESHOLD &&
      Math.abs(this.stickPeakSteer) <= VERTICAL_TAP_MAX_SIDEWAYS;
    if (wasVerticalTap) {
      const now = this.scene.time.now;
      const taps = this.stickPeakThrust > 0 ? this.upTaps : this.downTaps;
      if (taps.tap(now, DOUBLE_TAP_WINDOW_MS)) {
        const intent = this.stickPeakThrust > 0 ? "BOOST" : "KTURN";
        this.pendingIntents.push({ intent, value: 1 });
      }
    }

    this.steerValue = 0;
    this.thrustValue = 0;
    this.stickPeakThrust = 0;
    this.stickPeakSteer = 0;
  }

  private releaseActionZone(): void {
    this.actionPointerId = null;
    if (this.actionHoldFired) return; // hold already fired on this press, no tap follow-up

    const now = this.scene.time.now;
    if (now - this.lastActionTapReleaseAt <= DOUBLE_TAP_WINDOW_MS) {
      this.pendingSingleTapTimer?.remove();
      this.pendingSingleTapTimer = null;
      this.queueBoundIntent("doubleTap");
      this.lastActionTapReleaseAt = 0;
      return;
    }

    this.lastActionTapReleaseAt = now;
    this.pendingSingleTapTimer = this.scene.time.delayedCall(
      DOUBLE_TAP_WINDOW_MS,
      () => this.queueBoundIntent("tap"),
    );
  }

  private queueBoundIntent(gesture: TouchBinding["gesture"]): void {
    const binding = this.touchConfig.touchBindings.find(
      (b) => b.gesture === gesture,
    );
    if (binding) this.pendingIntents.push({ intent: binding.intent, value: 1 });
  }

  destroy(fromScene?: boolean): void {
    // Optional chaining: when destroyed as part of a full scene teardown
    // (fromScene=true), Phaser may have already torn down the scene's own
    // input plugin before this container's destroy() runs.
    this.scene?.input?.off("pointerdown", this.onPointerDown, this);
    this.scene?.input?.off("pointermove", this.onPointerMove, this);
    this.scene?.input?.off("pointerup", this.onPointerUp, this);
    this.scene?.input?.off("pointerupoutside", this.onPointerUp, this);
    this.pendingSingleTapTimer?.remove();
    super.destroy(fromScene);
  }
}
