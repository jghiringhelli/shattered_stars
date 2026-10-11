/**
 * Spec: gamepad overrides persist per control profile next to the keyboard
 * overrides, are validated on load, and older documents without them load
 * with no gamepad overrides.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS,
  activeGamepadOverrides,
  loadSettings,
  parseSettings,
  saveSettings,
  withActiveGamepadOverrides,
} from "../../../src/systems/SettingsStorage";
import { createMemoryStore } from "../../../src/systems/keyValueStore";

describe("gamepad overrides in control profiles", () => {
  it("defaults to no gamepad overrides in every profile", () => {
    for (const profile of DEFAULT_SETTINGS.controls.profiles)
      expect(profile.gamepad).toEqual({});
    expect(activeGamepadOverrides(DEFAULT_SETTINGS)).toEqual({});
  });

  it("changes only the active profile", () => {
    const base = {
      ...DEFAULT_SETTINGS,
      controls: { ...DEFAULT_SETTINGS.controls, activeProfile: 1 },
    };
    const next = withActiveGamepadOverrides(base, { CLOAK: 10 });
    expect(next.controls.profiles[1]?.gamepad).toEqual({ CLOAK: 10 });
    expect(next.controls.profiles[0]?.gamepad).toEqual({});
    expect(next.controls.profiles[1]?.keyboard).toEqual(
      base.controls.profiles[1]?.keyboard,
    );
  });

  it("round-trips through storage", () => {
    const store = createMemoryStore();
    const settings = withActiveGamepadOverrides(DEFAULT_SETTINGS, {
      MARK_TARGET: 4,
      HERO_POWER_2: null,
    });
    saveSettings(settings, store);
    expect(activeGamepadOverrides(loadSettings(store))).toEqual({
      MARK_TARGET: 4,
      HERO_POWER_2: null,
    });
  });

  it("drops invalid stored buttons but keeps the keyboard overrides", () => {
    const parsed = parseSettings({
      version: 2,
      controls: {
        activeProfile: 0,
        profiles: [
          { keyboard: { CLOAK: { key: "K" } }, gamepad: { CLOAK: 1 } },
        ],
      },
    });
    expect(parsed.controls.profiles[0]?.gamepad).toEqual({});
    expect(parsed.controls.profiles[0]?.keyboard).toEqual({
      CLOAK: { key: "K" },
    });
  });

  it("loads documents saved before gamepad rebinding", () => {
    const parsed = parseSettings({
      version: 2,
      controls: { activeProfile: 0, profiles: [{ keyboard: {} }] },
    });
    expect(parsed.controls.profiles[0]?.gamepad).toEqual({});
  });
});
