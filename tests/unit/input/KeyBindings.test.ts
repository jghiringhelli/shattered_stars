/**
 * Spec: keyboard rebinding — overrides over DefaultBindings, conflict rules
 * (same chord + shared context), swap-on-conflict, reserved keys, labels.
 */

import { describe, it, expect } from "vitest";
import { DEFAULT_KEYBOARD_BINDINGS } from "../../../src/input/DefaultBindings";
import {
  applyKeyOverrides,
  chordFromKeyEvent,
  chordLabel,
  findAllConflicts,
  findConflicts,
  primaryChord,
  rebindIntent,
  validateChord,
  type KeyOverrides,
} from "../../../src/input/KeyBindings";
import { REBINDABLE_INTENTS } from "../../../src/input/RebindableIntents";

const defaults = DEFAULT_KEYBOARD_BINDINGS;

describe("default keyboard bindings", () => {
  it("does not pause a battle on plain Space (primaries autofire; Shift+Space fires secondaries)", () => {
    const plainSpace = defaults.filter(
      (b) => b.key === "SPACE" && !b.modifiers?.shift,
    );
    expect(plainSpace.map((b) => b.intent)).not.toContain("PAUSE");
  });

  it("pauses on P and ESC", () => {
    const pause = defaults
      .filter((b) => b.intent === "PAUSE")
      .map((b) => b.key);
    expect(pause.sort()).toEqual(["ESC", "P"]);
  });
});

describe("applyKeyOverrides", () => {
  it("returns the defaults unchanged when there are no overrides", () => {
    expect(applyKeyOverrides(defaults, {})).toEqual([...defaults]);
  });

  it("moves MARK_TARGET from R to K and drops the R binding", () => {
    const bindings = applyKeyOverrides(defaults, { MARK_TARGET: { key: "K" } });
    const mark = bindings.filter((b) => b.intent === "MARK_TARGET");
    expect(mark).toEqual([{ key: "K", intent: "MARK_TARGET" }]);
  });

  it("unbinds an intent overridden with null", () => {
    const bindings = applyKeyOverrides(defaults, { CLOAK: null });
    expect(bindings.some((b) => b.intent === "CLOAK")).toBe(false);
  });

  it("keeps the reserved ESC pause binding when PAUSE is rebound", () => {
    const bindings = applyKeyOverrides(defaults, { PAUSE: { key: "O" } });
    const pause = bindings
      .filter((b) => b.intent === "PAUSE")
      .map((b) => b.key);
    expect(pause.sort()).toEqual(["ESC", "O"]);
  });

  it("keeps the overridden shift modifier", () => {
    const bindings = applyKeyOverrides(defaults, {
      SEGNOR_LEFT: { key: "A", shift: true },
    });
    expect(primaryChord(bindings, "SEGNOR_LEFT")).toEqual({
      key: "A",
      shift: true,
    });
  });
});

describe("conflict detection", () => {
  it("the default bindings are conflict-free", () => {
    expect(findAllConflicts(defaults)).toEqual([]);
  });

  it("reports a flight intent already on the key (Z is the K-turn)", () => {
    expect(findConflicts(defaults, "MARK_TARGET", { key: "Z" })).toEqual([
      "KTURN",
    ]);
  });

  it("does not report the same intent as its own conflict", () => {
    expect(findConflicts(defaults, "MARK_TARGET", { key: "R" })).toEqual([]);
  });

  it("allows a key shared across contexts (W pans the tactical camera)", () => {
    expect(findConflicts(defaults, "KTURN", { key: "W" })).toEqual([]);
  });

  it("treats a different modifier as a different chord", () => {
    expect(findConflicts(defaults, "CLOAK", { key: "Q", shift: true })).toEqual(
      ["SEGNOR_LEFT"],
    );
    expect(findConflicts(defaults, "CLOAK", { key: "Q", ctrl: true })).toEqual(
      [],
    );
  });
});

describe("rebindIntent", () => {
  it("sets a free key without displacing anything", () => {
    const result = rebindIntent(defaults, {}, "MARK_TARGET", { key: "K" });
    expect(result.overrides.MARK_TARGET).toEqual({ key: "K" });
    expect(result.displaced).toEqual([]);
  });

  it("swaps on conflict: the displaced intent takes the old key", () => {
    const result = rebindIntent(defaults, {}, "MARK_TARGET", { key: "Z" });
    expect(result.displaced).toEqual(["KTURN"]);
    const bindings = applyKeyOverrides(defaults, result.overrides);
    expect(primaryChord(bindings, "MARK_TARGET")).toEqual({ key: "Z" });
    expect(primaryChord(bindings, "KTURN")).toEqual({ key: "R" });
    expect(findAllConflicts(bindings)).toEqual([]);
  });

  it("refuses a reserved key and leaves the overrides untouched", () => {
    const before: KeyOverrides = { CLOAK: { key: "J" } };
    const result = rebindIntent(defaults, before, "CLOAK", { key: "ESC" });
    expect(result.rejected).toBe("reserved");
    expect(result.overrides).toBe(before);
  });
});

describe("validateChord", () => {
  it("accepts known keys, rejects ESC, unknown names and bare modifiers", () => {
    expect(validateChord({ key: "K" })).toBe("ok");
    expect(validateChord({ key: "ESC" })).toBe("reserved");
    expect(validateChord({ key: "NOPE" })).toBe("unknown_key");
  });
});

describe("chordFromKeyEvent", () => {
  it("maps a DOM key event to a chord with modifiers", () => {
    expect(
      chordFromKeyEvent({
        keyCode: 81,
        shiftKey: true,
        ctrlKey: false,
        altKey: false,
      }),
    ).toEqual({ key: "Q", shift: true });
  });

  it("returns null for a modifier key pressed alone", () => {
    expect(
      chordFromKeyEvent({
        keyCode: 16,
        shiftKey: true,
        ctrlKey: false,
        altKey: false,
      }),
    ).toBeNull();
  });
});

describe("chordLabel", () => {
  it("formats arrows, modifiers and plain keys", () => {
    expect(chordLabel({ key: "UP" })).toBe("↑");
    expect(chordLabel({ key: "Q", shift: true })).toBe("Shift+Q");
    expect(chordLabel({ key: "SPACE", ctrl: true })).toBe("Ctrl+Space");
    expect(chordLabel(null)).toBe("Unbound");
  });
});

describe("REBINDABLE_INTENTS", () => {
  it("covers mark target, both hero powers and every flight special", () => {
    const intents = REBINDABLE_INTENTS.map((r) => r.intent);
    for (const intent of [
      "MARK_TARGET",
      "HERO_POWER_1",
      "HERO_POWER_2",
      "KTURN",
      "SEGNOR_LEFT",
      "TALLON_RIGHT",
      "FIRE_SECONDARY",
    ] as const) {
      expect(intents).toContain(intent);
    }
  });
});
