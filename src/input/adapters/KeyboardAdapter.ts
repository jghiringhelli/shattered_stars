/**
 * Keyboard input adapter — translates Phaser keyboard state into ActionIntent events.
 *
 * "Held" intents (movement/camera/zoom) emit every frame while the key is down so
 * InputManager.isHeld()/getHeldValue() stay accurate. Everything else is edge-triggered
 * (fires once per physical press) using Phaser's JustDown.
 */

import Phaser from "phaser";
import type {
  ActionIntent,
  InputAdapter,
  InputEvent,
  InputSource,
  KeyboardBinding,
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

export class KeyboardAdapter implements InputAdapter {
  readonly source: InputSource = "keyboard";
  private keys: Map<string, Phaser.Input.Keyboard.Key> = new Map();
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;
  private ctrlKey: Phaser.Input.Keyboard.Key | null = null;
  private altKey: Phaser.Input.Keyboard.Key | null = null;
  private prevDownState: Map<string, boolean> = new Map();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly bindings: readonly KeyboardBinding[],
  ) {}

  init(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;

    this.shiftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.ctrlKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL);
    this.altKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ALT);

    for (const binding of this.bindings) {
      if (this.keys.has(binding.key)) continue;
      const code = (
        Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>
      )[binding.key];
      if (code !== undefined) this.keys.set(binding.key, keyboard.addKey(code));
    }
  }

  destroy(): void {
    const keyboard = this.scene.input.keyboard;
    for (const key of this.keys.values()) keyboard?.removeKey(key);
    this.keys.clear();
  }

  isAvailable(): boolean {
    return !!this.scene.input.keyboard;
  }

  poll(): InputEvent[] {
    const events: InputEvent[] = [];
    if (!this.scene.input.keyboard) return events;

    const shiftDown = this.shiftKey?.isDown ?? false;
    const ctrlDown = this.ctrlKey?.isDown ?? false;
    const altDown = this.altKey?.isDown ?? false;

    // Track "just pressed" per physical key ourselves instead of using
    // Phaser.Input.Keyboard.JustDown(): that helper CONSUMES key._justDown
    // on the first check, so a second binding sharing the same physical key
    // (e.g. ESC -> CANCEL and ESC -> PAUSE) would never see it fire.
    const currentDownState = new Map<string, boolean>();
    for (const [code, key] of this.keys) currentDownState.set(code, key.isDown);

    for (const binding of this.bindings) {
      const key = this.keys.get(binding.key);
      if (!key) continue;
      if (!this.modifiersMatch(binding, shiftDown, ctrlDown, altDown)) continue;

      const isHeldIntent = HELD_INTENTS.has(binding.intent);
      const isDown = currentDownState.get(binding.key) ?? false;
      const wasDown = this.prevDownState.get(binding.key) ?? false;
      const triggered = isHeldIntent ? isDown : isDown && !wasDown;
      if (!triggered) continue;

      events.push({
        intent: binding.intent,
        timestamp: Date.now(),
        source: this.source,
        value: 1,
      });
    }

    this.prevDownState = currentDownState;
    return events;
  }

  private modifiersMatch(
    binding: KeyboardBinding,
    shiftDown: boolean,
    ctrlDown: boolean,
    altDown: boolean,
  ): boolean {
    const wantsShift = binding.modifiers?.shift ?? false;
    const wantsCtrl = binding.modifiers?.ctrl ?? false;
    const wantsAlt = binding.modifiers?.alt ?? false;
    return (
      wantsShift === shiftDown && wantsCtrl === ctrlDown && wantsAlt === altDown
    );
  }
}
