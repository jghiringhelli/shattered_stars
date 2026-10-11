/**
 * Spec: gamepad rebinding — button overrides over DefaultBindings with the
 * same conflict rules as the keyboard (same button + shared context → swap),
 * reserved buttons (B = back, Start = pause), stick axes untouched, labels
 * and tolerant parsing of stored overrides.
 */

import { describe, it, expect } from "vitest";
import { DEFAULT_GAMEPAD_BINDINGS } from "../../../src/input/DefaultBindings";
import {
  GAMEPAD_REBINDABLE_INTENTS,
  applyGamepadOverrides,
  findAllButtonConflicts,
  findButtonConflicts,
  gamepadButtonLabel,
  parseGamepadOverrides,
  primaryButton,
  rebindGamepadIntent,
  validateButton,
} from "../../../src/input/GamepadBindings";
import { gamepadLabelFor } from "../../../src/ui/ControlsReference";

const defaults = DEFAULT_GAMEPAD_BINDINGS;
const A = 0;
const B = 1;
const X = 2;
const Y = 3;
const LB = 4;
const START = 9;
const L3 = 10;
const R3 = 11;

describe("applyGamepadOverrides", () => {
  it("returns the defaults unchanged when there are no overrides", () => {
    expect(applyGamepadOverrides(defaults, {})).toEqual([...defaults]);
  });

  it("moves MARK_TARGET from R3 to LB", () => {
    const bindings = applyGamepadOverrides(defaults, { MARK_TARGET: LB });
    expect(bindings.filter((b) => b.intent === "MARK_TARGET")).toEqual([
      { button: LB, intent: "MARK_TARGET" },
    ]);
  });

  it("unbinds an intent overridden with null", () => {
    const bindings = applyGamepadOverrides(defaults, { HERO_POWER_2: null });
    expect(bindings.some((b) => b.intent === "HERO_POWER_2")).toBe(false);
  });

  it("binds an intent that has no default button", () => {
    const bindings = applyGamepadOverrides(defaults, { CLOAK: L3 });
    expect(primaryButton(bindings, "CLOAK")).toBe(L3);
  });

  it("never drops stick-axis bindings", () => {
    const axes = (list: readonly { axis?: number }[]) =>
      list.filter((b) => b.axis !== undefined).length;
    const bindings = applyGamepadOverrides(defaults, { FIRE_SECONDARY: LB });
    expect(axes(bindings)).toBe(axes(defaults));
  });
});

describe("conflict detection", () => {
  it("the default gamepad bindings are conflict-free", () => {
    expect(findAllButtonConflicts(defaults)).toEqual([]);
  });

  it("two flight intents on one button conflict", () => {
    expect(findButtonConflicts(defaults, "CLOAK", X)).toEqual([
      "FIRE_SECONDARY",
    ]);
  });

  it("a flight intent may share a button with a menu-only intent", () => {
    expect(findButtonConflicts(defaults, "CLOAK", A)).toEqual([]);
  });

  it("a flight intent may share a button with a tactical-only intent", () => {
    // Y is FOCUS_SELECTED (tactical) and HERO_POWER_1 (flight).
    expect(findButtonConflicts(defaults, "HERO_POWER_1", Y)).toEqual([]);
  });
});

describe("rebindGamepadIntent", () => {
  it("binds onto a free button with nothing displaced", () => {
    const result = rebindGamepadIntent(defaults, {}, "CLOAK", L3 + 2);
    expect(result.rejected).toBeNull();
    expect(result.displaced).toEqual([]);
    expect(result.overrides).toEqual({ CLOAK: L3 + 2 });
  });

  it("swaps: the displaced intent takes the rebound intent's old button", () => {
    const result = rebindGamepadIntent(defaults, {}, "HERO_POWER_2", X);
    expect(result.displaced).toEqual(["FIRE_SECONDARY"]);
    const bindings = applyGamepadOverrides(defaults, result.overrides);
    expect(primaryButton(bindings, "HERO_POWER_2")).toBe(X);
    expect(primaryButton(bindings, "FIRE_SECONDARY")).toBe(L3);
    expect(findAllButtonConflicts(bindings)).toEqual([]);
  });

  it("refuses a button a fixed (non-rebindable) intent needs in a shared context", () => {
    // MARK_TARGET is live in tactical scenes too, where X executes the dial.
    const result = rebindGamepadIntent(defaults, {}, "MARK_TARGET", X);
    expect(result.rejected).toBe("fixed");
    expect(result.overrides).toEqual({});
  });

  it("unbinds the displaced intent when the rebound one had no button", () => {
    const result = rebindGamepadIntent(defaults, {}, "CLOAK", X);
    expect(result.displaced).toEqual(["FIRE_SECONDARY"]);
    const bindings = applyGamepadOverrides(defaults, result.overrides);
    expect(primaryButton(bindings, "FIRE_SECONDARY")).toBeNull();
  });

  it("refuses the reserved B (back) and Start (pause) buttons", () => {
    expect(rebindGamepadIntent(defaults, {}, "CLOAK", B).rejected).toBe(
      "reserved",
    );
    expect(rebindGamepadIntent(defaults, {}, "CLOAK", START).rejected).toBe(
      "reserved",
    );
  });

  it("refuses buttons outside the standard layout", () => {
    expect(rebindGamepadIntent(defaults, {}, "CLOAK", 42).rejected).toBe(
      "unknown_button",
    );
  });
});

describe("validateButton", () => {
  it("accepts every standard face, bumper, trigger, stick and d-pad button", () => {
    const free = [0, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
    for (const button of free) expect(validateButton(button)).toBe("ok");
  });

  it("rejects negative and fractional indices", () => {
    expect(validateButton(-1)).toBe("unknown_button");
    expect(validateButton(1.5)).toBe("unknown_button");
  });
});

describe("rebindable gamepad intents", () => {
  it("excludes the stick-driven steering/throttle and the reserved pause", () => {
    const ids = GAMEPAD_REBINDABLE_INTENTS.map((r) => r.intent);
    for (const stick of [
      "STEER_LEFT",
      "STEER_RIGHT",
      "THRUST_UP",
      "THRUST_DOWN",
      "PAUSE",
    ])
      expect(ids).not.toContain(stick);
  });

  it("includes every combat intent", () => {
    const ids = GAMEPAD_REBINDABLE_INTENTS.map((r) => r.intent);
    expect(ids).toEqual(
      expect.arrayContaining(["FIRE_SECONDARY", "MARK_TARGET", "CLOAK"]),
    );
  });
});

describe("gamepadButtonLabel", () => {
  it("the Controls reference shows a rebound button", () => {
    const bindings = applyGamepadOverrides(defaults, { MARK_TARGET: 8 });
    expect(gamepadLabelFor(["MARK_TARGET"], bindings)).toBe("Back");
  });

  it("names standard buttons", () => {
    expect(gamepadButtonLabel(A)).toBe("A");
    expect(gamepadButtonLabel(R3)).toBe("R3");
    expect(gamepadButtonLabel(12)).toBe("D-Up");
  });

  it("reads Unbound for null", () => {
    expect(gamepadButtonLabel(null)).toBe("Unbound");
  });
});

describe("parseGamepadOverrides", () => {
  it("keeps valid rebindable entries and null unbinds", () => {
    expect(parseGamepadOverrides({ CLOAK: 10, MARK_TARGET: null })).toEqual({
      CLOAK: 10,
      MARK_TARGET: null,
    });
  });

  it("drops unknown intents, reserved and invalid buttons", () => {
    expect(
      parseGamepadOverrides({
        NOT_AN_INTENT: 2,
        CLOAK: B,
        KTURN: "x",
        BOOST: 99,
        STEER_LEFT: 4,
      }),
    ).toEqual({});
  });

  it("returns empty overrides for non-objects", () => {
    expect(parseGamepadOverrides(null)).toEqual({});
    expect(parseGamepadOverrides([1, 2])).toEqual({});
  });
});
