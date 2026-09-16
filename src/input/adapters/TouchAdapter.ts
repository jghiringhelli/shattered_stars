/**
 * Touch input adapter — wraps TouchFlightControls (dual-circle overlay) and
 * translates its stick/gesture state into ActionIntent events. Only creates
 * the on-screen overlay on devices that actually report touch support, so
 * desktop/mouse play never sees phantom joystick circles.
 */

import type {
  InputAdapter,
  InputEvent,
  InputSource,
  TouchBinding,
} from "../InputTypes";
import { TouchFlightControls } from "../../ui/input/TouchFlightControls";

const STICK_DEADZONE = 0.15;

export class TouchAdapter implements InputAdapter {
  readonly source: InputSource = "touch";
  private controls: TouchFlightControls | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly touchBindings: readonly TouchBinding[],
  ) {}

  init(): void {
    if (!this.isTouchPrimaryDevice()) return;
    this.controls = new TouchFlightControls({
      scene: this.scene,
      touchBindings: this.touchBindings,
    });
  }

  /**
   * Many desktops/laptops report touch capability (hybrid touchscreens) but
   * are driven by mouse+keyboard — only show the on-screen overlay on
   * devices where touch is the PRIMARY pointer (phones/tablets), which the
   * `(hover: none)` media feature reliably distinguishes from a machine that
   * also has a mouse/trackpad.
   */
  private isTouchPrimaryDevice(): boolean {
    if (!this.scene.sys.game.device.input.touch) return false;
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return true;
    }
    return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  }

  destroy(): void {
    this.controls?.destroy();
    this.controls = null;
  }

  isAvailable(): boolean {
    return this.controls !== null;
  }

  poll(): InputEvent[] {
    if (!this.controls) return [];
    this.controls.update(this.scene.time.now);

    const events: InputEvent[] = [];
    const timestamp = Date.now();
    const steer = this.controls.getSteerValue();
    const thrust = this.controls.getThrustValue();

    if (steer < -STICK_DEADZONE) {
      events.push({
        intent: "STEER_LEFT",
        timestamp,
        source: this.source,
        value: Math.min(1, -steer),
      });
    } else if (steer > STICK_DEADZONE) {
      events.push({
        intent: "STEER_RIGHT",
        timestamp,
        source: this.source,
        value: Math.min(1, steer),
      });
    }

    if (thrust > STICK_DEADZONE) {
      events.push({
        intent: "THRUST_UP",
        timestamp,
        source: this.source,
        value: Math.min(1, thrust),
      });
    } else if (thrust < -STICK_DEADZONE) {
      events.push({
        intent: "THRUST_DOWN",
        timestamp,
        source: this.source,
        value: Math.min(1, -thrust),
      });
    }

    for (const pending of this.controls.consumePendingIntents()) {
      events.push({
        intent: pending.intent,
        timestamp,
        source: this.source,
        value: pending.value,
      });
    }

    return events;
  }
}

export type { TouchBinding };
