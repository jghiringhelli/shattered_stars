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
  "MANEUVER",
  "ZOOM_IN",
  "ZOOM_OUT",
]);

/**
 * Held intents a sub-frame tap must still register as held for one poll:
 * the maneuver key's Snap Turn is a tap, and a press+release between two
 * polls would otherwise never be seen.
 */
const TAP_VISIBLE_HELD: ReadonlySet<ActionIntent> = new Set(["MANEUVER"]);

export class KeyboardAdapter implements InputAdapter {
  readonly source: InputSource = "keyboard";
  private keys: Map<string, Phaser.Input.Keyboard.Key> = new Map();
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;
  private ctrlKey: Phaser.Input.Keyboard.Key | null = null;
  private altKey: Phaser.Input.Keyboard.Key | null = null;
  // Set by a real 'down' event listener (fires the instant the browser
  // keydown happens) rather than sampled from key.isDown once per frame —
  // a keydown+keyup pair that both land between two polls (e.g. a fast
  // programmatic press, or a slow frame) would otherwise never be seen as
  // "down" at poll time and the edge would be silently dropped.
  private pendingKeyDown: Map<string, boolean> = new Map();

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
      if (code === undefined) continue;
      const key = keyboard.addKey(code);
      key.on("down", () => this.pendingKeyDown.set(binding.key, true));
      this.keys.set(binding.key, key);
    }
  }

  destroy(): void {
    const keyboard = this.scene.input.keyboard;
    for (const key of this.keys.values()) keyboard?.removeKey(key);
    this.keys.clear();
    this.pendingKeyDown.clear();
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

    const consumedKeys = new Set<string>();

    for (const binding of this.bindings) {
      const key = this.keys.get(binding.key);
      if (!key) continue;
      if (!this.modifiersMatch(binding, shiftDown, ctrlDown, altDown)) continue;

      const isHeldIntent = HELD_INTENTS.has(binding.intent);
      const tapSeen =
        TAP_VISIBLE_HELD.has(binding.intent) &&
        (this.pendingKeyDown.get(binding.key) ?? false);
      const triggered = isHeldIntent
        ? key.isDown || tapSeen
        : (this.pendingKeyDown.get(binding.key) ?? false);
      if (!triggered) continue;
      if (!isHeldIntent || tapSeen) consumedKeys.add(binding.key);

      events.push({
        intent: binding.intent,
        timestamp: Date.now(),
        source: this.source,
        value: 1,
      });
    }

    for (const key of consumedKeys) this.pendingKeyDown.set(key, false);
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
