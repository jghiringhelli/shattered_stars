/**
 * Unit tests for ControlsReference — the data-driven "which key does what"
 * lookup used by ControlsScene, TutorialOverlay, and setup-screen tips.
 */

import { describe, it, expect } from "vitest";
import {
  CONTROL_GROUPS,
  keyboardLabelFor,
  gamepadLabelFor,
  touchLabelFor,
  quickTipLine,
} from "../../../src/ui/ControlsReference";

describe("ControlsReference", () => {
  it("returns 'Automatic' for an empty intent list (e.g. primary weapon)", () => {
    expect(keyboardLabelFor([])).toBe("Automatic");
    expect(gamepadLabelFor([])).toBe("Automatic");
    expect(touchLabelFor([])).toBe("Automatic");
  });

  it("formats a keyboard steering pair as arrows", () => {
    expect(keyboardLabelFor(["STEER_LEFT", "STEER_RIGHT"])).toBe("← / →");
  });

  it("formats a shift-modified binding with the Shift+ prefix", () => {
    expect(keyboardLabelFor(["SEGNOR_LEFT"])).toBe("Shift+Q");
  });

  it("formats gamepad axis and button bindings", () => {
    expect(gamepadLabelFor(["STEER_LEFT", "STEER_RIGHT"])).toBe("Left Stick");
    expect(gamepadLabelFor(["FIRE_SECONDARY"])).toBe("X");
  });

  it("formats touch bindings, including the stick special-cases", () => {
    expect(touchLabelFor(["STEER_LEFT", "STEER_RIGHT"])).toBe("Left Stick");
    expect(touchLabelFor(["BOOST"])).toBe("Double-tap stick up");
    expect(touchLabelFor(["FIRE_SECONDARY"])).toBe("Tap action zone");
  });

  it("falls back to an em dash when no binding exists for a device", () => {
    // Commander orders have no touch gesture by design (documented gap).
    expect(touchLabelFor(["COMMANDER_ORDER_1"])).toBe("—");
  });

  it("lists the gamepad hard turns, K-turn flick and commander orders", () => {
    expect(gamepadLabelFor(["SHARP_TURN_LEFT", "SHARP_TURN_RIGHT"])).toBe(
      "LB / RB",
    );
    expect(gamepadLabelFor(["KTURN"])).toBe("Right Stick ↓ flick");
    expect(
      gamepadLabelFor([
        "COMMANDER_ORDER_1",
        "COMMANDER_ORDER_2",
        "COMMANDER_ORDER_3",
        "COMMANDER_ORDER_4",
      ]),
    ).toBe("LT / RT / D-Left / D-Right");
  });

  it("names the right-stick flick direction of a barrel roll", () => {
    expect(
      gamepadLabelFor(["BARREL_ROLL", "BARREL_ROLL_LEFT", "BARREL_ROLL_RIGHT"]),
    ).toBe("Right Stick ←/→ flick");
  });

  it("lists the squad mark on R and right-stick click (no touch gesture is free)", () => {
    const row = CONTROL_GROUPS.flatMap((g) => g.rows).find((r) =>
      r.intents.includes("MARK_TARGET"),
    );
    expect(row?.label).toBe("Mark Target (squad focus)");
    expect(keyboardLabelFor(["MARK_TARGET"])).toBe("R");
    expect(gamepadLabelFor(["MARK_TARGET"])).toBe("R3");
    expect(touchLabelFor(["MARK_TARGET"])).toBe("—");
  });

  it("builds a joined single-line quick tip", () => {
    const line = quickTipLine([
      { label: "Steer", intents: ["STEER_LEFT", "STEER_RIGHT"] },
      { label: "Cloak", intents: ["CLOAK"] },
    ]);
    expect(line).toBe("Steer: \u2190 / \u2192   \u00b7   Cloak: C");
  });

  it("every control group has at least one row and every row has a label", () => {
    expect(CONTROL_GROUPS.length).toBeGreaterThan(0);
    for (const group of CONTROL_GROUPS) {
      expect(group.rows.length).toBeGreaterThan(0);
      for (const row of group.rows) {
        expect(row.label.length).toBeGreaterThan(0);
      }
    }
  });
});
