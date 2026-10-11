/**
 * boundKeyLabel — label of the key the player actually has bound to an
 * intent, including the gesture-only intents (boost = double-tap throttle
 * up, barrel roll = left then right). Phaser-free.
 */

import { InputManager } from "./InputManager";
import type {
  ActionIntent,
  GamepadBinding,
  KeyboardBinding,
} from "./InputTypes";
import { chordLabel, primaryChord } from "./KeyBindings";

/** @returns The live profile's keyboard bindings. */
export function activeKeyboardBindings(): readonly KeyboardBinding[] {
  return InputManager.getProfile().keyboard;
}

/** @returns The live profile's gamepad bindings. */
export function activeGamepadBindings(): readonly GamepadBinding[] {
  return InputManager.getProfile().gamepad;
}

/**
 * @param intent - Intent.
 * @param bindings - Bindings to read (default: the live profile).
 * @returns e.g. "R", "Shift+Q", "Double-tap ↑", "← then →".
 */
export function boundKeyLabel(
  intent: ActionIntent,
  bindings: readonly KeyboardBinding[] = activeKeyboardBindings(),
): string {
  const chord = primaryChord(bindings, intent);
  if (intent === "BOOST") {
    const gesture = `Double-tap ${chordLabel(primaryChord(bindings, "THRUST_UP"))}`;
    return chord ? `${gesture} / ${chordLabel(chord)}` : gesture;
  }
  if (intent === "BARREL_ROLL") {
    const left = chordLabel(primaryChord(bindings, "STEER_LEFT"));
    const right = chordLabel(primaryChord(bindings, "STEER_RIGHT"));
    return `${left} then ${right}`;
  }
  return chordLabel(chord);
}
