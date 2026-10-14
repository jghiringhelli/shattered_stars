/**
 * The default maneuver scheme: one MANEUVER key (Z / LT) for Snap Turn, Hook
 * Loop and Knife Roll; barrel roll and boost are gestures with no key.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_GAMEPAD_BINDINGS,
  DEFAULT_KEYBOARD_BINDINGS,
  DEFAULT_TOUCH_BINDINGS,
} from "../../../src/input/DefaultBindings";
import { findAllButtonConflicts } from "../../../src/input/GamepadBindings";
import { findAllConflicts } from "../../../src/input/KeyBindings";
import { contextsOf } from "../../../src/input/RebindableIntents";
import type { ActionIntent } from "../../../src/input/InputTypes";

const OLD_SPECIAL_KEYS: readonly ActionIntent[] = [
  "SEGNOR_LEFT",
  "SEGNOR_RIGHT",
  "TALLON_LEFT",
  "TALLON_RIGHT",
];

describe("maneuver key defaults", () => {
  it("keyboard: Z is the maneuver key and nothing else binds Z", () => {
    const onZ = DEFAULT_KEYBOARD_BINDINGS.filter((b) => b.key === "Z");
    expect(onZ.map((b) => b.intent)).toEqual(["MANEUVER"]);
  });

  it("keyboard: the scattered Hook / Knife / Snap keys are gone", () => {
    for (const intent of [...OLD_SPECIAL_KEYS, "KTURN"] as const)
      expect(DEFAULT_KEYBOARD_BINDINGS.some((b) => b.intent === intent)).toBe(
        false,
      );
  });

  it("keyboard: Q / E stay the 90° hard turns", () => {
    const keyOf = (intent: ActionIntent) =>
      DEFAULT_KEYBOARD_BINDINGS.find((b) => b.intent === intent)?.key;
    expect(keyOf("SHARP_TURN_LEFT")).toBe("Q");
    expect(keyOf("SHARP_TURN_RIGHT")).toBe("E");
  });

  it("keyboard: has no barrel-roll key — the roll is the ← ← / → → gesture", () => {
    expect(
      DEFAULT_KEYBOARD_BINDINGS.some((b) => b.intent.startsWith("BARREL_ROLL")),
    ).toBe(false);
  });

  it("keyboard: stays conflict-free", () => {
    expect(findAllConflicts(DEFAULT_KEYBOARD_BINDINGS)).toEqual([]);
  });

  it("gamepad: LT is the maneuver button, with no other flight intent on it", () => {
    const onLt = DEFAULT_GAMEPAD_BINDINGS.filter((b) => b.button === 6).map(
      (b) => b.intent,
    );
    expect(onLt).toEqual(["MANEUVER", "COMMANDER_ORDER_1"]);
    expect(contextsOf("MANEUVER")).toEqual(["flight"]);
    expect(contextsOf("COMMANDER_ORDER_1")).toEqual(["commander"]);
  });

  it("gamepad: Hook and Knife no longer have buttons of their own", () => {
    for (const intent of OLD_SPECIAL_KEYS)
      expect(DEFAULT_GAMEPAD_BINDINGS.some((b) => b.intent === intent)).toBe(
        false,
      );
  });

  it("gamepad: the hero powers (Y, L3) and the right-stick flicks are untouched", () => {
    const buttonOf = (intent: ActionIntent) =>
      DEFAULT_GAMEPAD_BINDINGS.find((b) => b.intent === intent)?.button;
    expect(buttonOf("HERO_POWER_1")).toBe(3);
    expect(buttonOf("HERO_POWER_2")).toBe(10);
    expect(
      DEFAULT_GAMEPAD_BINDINGS.filter((b) => b.axis === 2).map((b) => b.intent),
    ).toEqual(["BARREL_ROLL_LEFT", "BARREL_ROLL_RIGHT"]);
  });

  it("gamepad: stays conflict-free", () => {
    expect(findAllButtonConflicts(DEFAULT_GAMEPAD_BINDINGS)).toEqual([]);
  });

  it("touch: the FIRE zone has no barrel-roll gesture (the stick rolls)", () => {
    expect(DEFAULT_TOUCH_BINDINGS.map((b) => b.intent)).not.toContain(
      "BARREL_ROLL",
    );
  });
});