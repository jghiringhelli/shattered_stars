/**
 * Spec: prompt key labels follow the player's bindings, including the
 * gesture-only intents (boost, barrel roll) built from the steer/throttle keys.
 */

import { describe, it, expect } from "vitest";
import { boundKeyLabel } from "../../../src/input/boundKeyLabel";
import { DEFAULT_KEYBOARD_BINDINGS } from "../../../src/input/DefaultBindings";
import { applyKeyOverrides } from "../../../src/input/KeyBindings";
import { keyboardLabelFor } from "../../../src/ui/ControlsReference";

const defaults = DEFAULT_KEYBOARD_BINDINGS;

describe("boundKeyLabel", () => {
  it("labels plain and modified keys", () => {
    expect(boundKeyLabel("MARK_TARGET", defaults)).toBe("R");
    expect(boundKeyLabel("SEGNOR_LEFT", defaults)).toBe("Shift+Q");
    expect(boundKeyLabel("CONFIRM", defaults)).toBe("Enter");
  });

  it("follows a rebound key", () => {
    const rebound = applyKeyOverrides(defaults, { MARK_TARGET: { key: "K" } });
    expect(boundKeyLabel("MARK_TARGET", rebound)).toBe("K");
  });

  it("builds the boost and barrel-roll gestures from the (rebound) flight keys", () => {
    expect(boundKeyLabel("BOOST", defaults)).toBe("Double-tap ↑");
    expect(boundKeyLabel("BARREL_ROLL", defaults)).toBe("← then →");
    const wasd = applyKeyOverrides(defaults, {
      THRUST_UP: { key: "W" },
      STEER_LEFT: { key: "A" },
      STEER_RIGHT: { key: "D" },
      BOOST: { key: "F" },
    });
    expect(boundKeyLabel("BOOST", wasd)).toBe("Double-tap W / F");
    expect(boundKeyLabel("BARREL_ROLL", wasd)).toBe("A then D");
  });

  it("reports an unbound intent", () => {
    const unbound = applyKeyOverrides(defaults, { CLOAK: null });
    expect(boundKeyLabel("CLOAK", unbound)).toBe("Unbound");
  });
});

describe("ControlsReference keyboard column", () => {
  it("shows rebound keys when given the active bindings", () => {
    const rebound = applyKeyOverrides(defaults, { MARK_TARGET: { key: "K" } });
    expect(keyboardLabelFor(["MARK_TARGET"], rebound)).toBe("K");
  });
});
