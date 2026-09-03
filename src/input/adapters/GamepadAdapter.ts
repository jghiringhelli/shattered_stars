/**
 * Gamepad input adapter — translates the browser Gamepad API (via Phaser's
 * gamepad plugin) into ActionIntent events. Same held-vs-edge distinction
 * as KeyboardAdapter; buttons need manual JustDown tracking since Phaser's
 * gamepad plugin doesn't provide one.
 */

import Phaser from "phaser";
import type {
  ActionIntent,
  GamepadBinding,
  InputAdapter,
  InputEvent,
  InputSource,
} from "../InputTypes";

const HELD_INTENTS: ReadonlySet<ActionIntent> = new Set([
  "PAN_UP",
  "PAN_DOWN",
  "PAN_LEFT",
  "PAN_RIGHT",
  "STEER_LEFT",
  "STEER_RIGHT",
  "THRUST_UP",
  "THRUST_DOWN",
  "ZOOM_IN",
  "ZOOM_OUT",
]);

export class GamepadAdapter implements InputAdapter {
  readonly source: InputSource = "gamepad";
  private prevButtonState: Map<number, boolean> = new Map();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: readonly GamepadBinding[],
  ) {}

  init(): void {
    this.scene.input.gamepad?.once("connected", () => {
      // No-op: presence is checked live via isAvailable()/getPad() on each poll.
    });
  }

  destroy(): void {
    this.prevButtonState.clear();
  }

  isAvailable(): boolean {
    const gamepadPlugin = this.scene.input.gamepad;
    return !!gamepadPlugin && gamepadPlugin.total > 0;
  }

  poll(): InputEvent[] {
    const events: InputEvent[] = [];
    const pad = this.scene.input.gamepad?.getPad(0);
    if (!pad) return events;

    const currentButtonState = new Map<number, boolean>();
    for (const binding of this.bindings) {
      if (binding.button === undefined) continue;
      const btn = pad.buttons[binding.button];
      if (btn) currentButtonState.set(binding.button, btn.pressed);
    }

    for (const binding of this.bindings) {
      if (binding.button !== undefined) {
        const pressed = currentButtonState.get(binding.button) ?? false;
        const wasPressed = this.prevButtonState.get(binding.button) ?? false;
        const isHeldIntent = HELD_INTENTS.has(binding.intent);
        const triggered = isHeldIntent ? pressed : pressed && !wasPressed;
        if (!triggered) continue;

        events.push({
          intent: binding.intent,
          timestamp: Date.now(),
          source: this.source,
          value: 1,
        });
      } else if (binding.axis !== undefined) {
        const axisValue = pad.axes[binding.axis]?.getValue() ?? 0;
        const deadzone = binding.deadzone ?? 0.15;
        const active =
          binding.axisDirection === "negative"
            ? axisValue < -deadzone
            : axisValue > deadzone;
        if (!active) continue;

        events.push({
          intent: binding.intent,
          timestamp: Date.now(),
          source: this.source,
          value: Math.min(1, Math.abs(axisValue)),
        });
      }
    }

    this.prevButtonState = currentButtonState;
    return events;
  }
}
