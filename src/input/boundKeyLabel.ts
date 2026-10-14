/**
 * boundKeyLabel — label of the key the player actually has bound to an
 * intent, including the gesture intents: boost = double-tap throttle up,
 * barrel roll = double-tap a steering arrow, Snap Turn / Hook Loop / Knife
 * Roll = the maneuver key (tap / hold + side / double-tap + side).
 * Phaser-free.
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

 * @returns e.g. "R", "Shift+Q", "Double-tap ↑", "← ← / → →", "Hold Z + ← / →".
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
    return `${left} ${left} / ${right} ${right}`;
  }
  const maneuver = chordLabel(primaryChord(bindings, "MANEUVER"));
  const sides = `${chordLabel(primaryChord(bindings, "STEER_LEFT"))} / ${chordLabel(primaryChord(bindings, "STEER_RIGHT"))}`;
  if (intent === "KTURN") {
    const gesture = `Tap ${maneuver} / ${chordLabel(primaryChord(bindings, "THRUST_DOWN"))}${chordLabel(primaryChord(bindings, "THRUST_DOWN"))}`;
    return chord ? `${gesture} / ${chordLabel(chord)}` : gesture;
  }
  if (intent === "SEGNOR_LEFT" || intent === "SEGNOR_RIGHT")
    return `Hold ${maneuver} + ${sides}`;
  if (intent === "TALLON_LEFT" || intent === "TALLON_RIGHT")
    return `Double-tap ${maneuver}, hold ${sides}`;
  return chordLabel(chord);
}
