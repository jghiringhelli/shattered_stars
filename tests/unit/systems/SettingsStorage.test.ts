/**
 * Spec: versioned settings schema — defaults, v1 → v2 migration, per-field
 * validation with fallback, persisted control profiles, gameplay getters.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  SETTINGS_VERSION,
  activeKeyOverrides,
  defaultDifficulty,
  isMarkAssistEnabled,
  shipSpecialsRule,
  SHIP_SPECIALS_OPTIONS,
  steeringModePreference,
  isTelemetryEnabled,
  legacyRegistrySettings,
  loadSettings,
  parseSettings,
  saveSettings,
  withActiveKeyOverrides,
} from "../../../src/systems/SettingsStorage";
import { createMemoryStore } from "../../../src/systems/keyValueStore";

function storeWith(value: unknown): ReturnType<typeof createMemoryStore> {
  const store = createMemoryStore();
  store.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value));
  return store;
}

describe("loadSettings", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(loadSettings(createMemoryStore())).toEqual(DEFAULT_SETTINGS);
  });

  it("returns the defaults for corrupted JSON", () => {
    const store = createMemoryStore();
    store.setItem(SETTINGS_STORAGE_KEY, "{not json");
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips a saved document", () => {
    const store = createMemoryStore();
    const custom = {
      ...DEFAULT_SETTINGS,
      audio: { ...DEFAULT_SETTINGS.audio, ui: 0.25 },
    };
    saveSettings(custom, store);
    expect(loadSettings(store)).toEqual(custom);
  });
});

describe("migration from the unversioned v1 document", () => {
  const v1 = {
    masterVolume: 0.3,
    musicVolume: 0.2,
    sfxVolume: 0.9,
    cameraShake: false,
    showDamageNumbers: false,
    showMinimap: true,
  };

  it("maps volumes, shake and display toggles onto the v2 sections", () => {
    const migrated = parseSettings(v1);
    expect(migrated.version).toBe(SETTINGS_VERSION);
    expect(migrated.audio).toEqual({
      master: 0.3,
      music: 0.2,
      sfx: 0.9,
      ui: DEFAULT_SETTINGS.audio.ui,
    });
    expect(migrated.accessibility.screenShake).toBe(0);
    expect(migrated.gameplay.showDamageNumbers).toBe(false);
    expect("showMinimap" in migrated.gameplay).toBe(false);
  });

  it("keeps full shake when v1 had camera shake on", () => {
    expect(
      parseSettings({ ...v1, cameraShake: true }).accessibility.screenShake,
    ).toBe(1);
  });
});

describe("per-field validation", () => {
  it("clamps volumes and replaces non-numbers with the default", () => {
    const parsed = parseSettings({
      version: 2,
      audio: { master: 5, music: -1, sfx: "loud", ui: 0.4 },
    });
    expect(parsed.audio).toEqual({
      master: 1,
      music: 0,
      sfx: DEFAULT_SETTINGS.audio.sfx,
      ui: 0.4,
    });
  });

  it("rejects unknown enum values", () => {
    const parsed = parseSettings({
      version: 2,
      accessibility: { colorVision: "purple", textScale: 7 },
      gameplay: { defaultDifficulty: "nightmare" },
    });
    expect(parsed.accessibility.colorVision).toBe("normal");
    expect(parsed.accessibility.textScale).toBe(1);
    expect(parsed.gameplay.defaultDifficulty).toBe("normal");
  });

  it("normalises a newer version best-effort instead of discarding it", () => {
    const parsed = parseSettings({ version: 99, audio: { master: 0.1 } });
    expect(parsed.version).toBe(SETTINGS_VERSION);
    expect(parsed.audio.master).toBe(0.1);
  });

  it("returns defaults for non-object input", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("x")).toEqual(DEFAULT_SETTINGS);
  });
});

describe("control profiles", () => {
  it("keeps valid overrides and drops unknown intents and keys", () => {
    const parsed = parseSettings({
      version: 2,
      controls: {
        activeProfile: 1,
        profiles: [
          { keyboard: {} },
          {
            keyboard: {
              MARK_TARGET: { key: "K" },
              CLOAK: null,
              NOT_AN_INTENT: { key: "J" },
              KTURN: { key: "NOPE" },
              PAUSE: { key: "ESC" },
            },
          },
        ],
      },
    });
    expect(parsed.controls.activeProfile).toBe(1);
    expect(parsed.controls.profiles).toHaveLength(3);
    expect(activeKeyOverrides(parsed)).toEqual({
      MARK_TARGET: { key: "K" },
      CLOAK: null,
    });
  });

  it("clamps an out-of-range active profile", () => {
    const parsed = parseSettings({
      version: 2,
      controls: { activeProfile: 9 },
    });
    expect(parsed.controls.activeProfile).toBe(0);
  });

  it("replaces only the active profile's overrides", () => {
    const next = withActiveKeyOverrides(DEFAULT_SETTINGS, {
      MARK_TARGET: { key: "K" },
    });
    expect(activeKeyOverrides(next)).toEqual({ MARK_TARGET: { key: "K" } });
    expect(next.controls.profiles[1]?.keyboard).toEqual({});
  });
});

describe("gameplay getters", () => {
  it("reads mark assist, difficulty and telemetry from the store", () => {
    const store = storeWith({
      version: 2,
      gameplay: { markAssist: false, defaultDifficulty: "hard" },
      privacy: { telemetryEnabled: false },
    });
    expect(isMarkAssistEnabled(store)).toBe(false);
    expect(defaultDifficulty(store)).toBe("hard");
    expect(isTelemetryEnabled(store)).toBe(false);
  });

  it("defaults to mark assist on and telemetry on", () => {
    const store = createMemoryStore();
    expect(isMarkAssistEnabled(store)).toBe(true);
    expect(isTelemetryEnabled(store)).toBe(true);
  });
});

describe("legacyRegistrySettings", () => {
  it("exposes the flat shape battle scenes read from the registry", () => {
    const legacy = legacyRegistrySettings({
      ...DEFAULT_SETTINGS,
      accessibility: { ...DEFAULT_SETTINGS.accessibility, screenShake: 0 },
    });
    expect(legacy.cameraShake).toBe(false);
    expect(legacy.showDamageNumbers).toBe(true);
    expect(legacy.masterVolume).toBe(DEFAULT_SETTINGS.audio.master);
  });
});

describe("ship specials setting (Ship identity / Full card)", () => {
  it("defaults to ship identity", () => {
    expect(DEFAULT_SETTINGS.gameplay.shipSpecials).toBe("identity");
    expect(shipSpecialsRule(createMemoryStore())).toBe("identity");
  });

  it("persists the full-card choice", () => {
    const store = createMemoryStore();
    saveSettings(
      {
        ...DEFAULT_SETTINGS,
        gameplay: { ...DEFAULT_SETTINGS.gameplay, shipSpecials: "full" },
      },
      store,
    );
    expect(loadSettings(store).gameplay.shipSpecials).toBe("full");
    expect(shipSpecialsRule(store)).toBe("full");
  });

  it("falls back to identity for an unknown value and for old documents", () => {
    expect(
      shipSpecialsRule(
        storeWith({ version: 2, gameplay: { shipSpecials: "everything" } }),
      ),
    ).toBe("identity");
    expect(shipSpecialsRule(storeWith({ version: 2, gameplay: {} }))).toBe(
      "identity",
    );
  });

  it("keeps the other gameplay fields when the value is invalid", () => {
    const loaded = loadSettings(
      storeWith({
        version: 2,
        gameplay: { shipSpecials: 7, markAssist: false },
      }),
    );
    expect(loaded.gameplay.markAssist).toBe(false);
    expect(loaded.gameplay.shipSpecials).toBe("identity");
  });

  it("offers Ship identity first, then Full card", () => {
    expect(SHIP_SPECIALS_OPTIONS.map((o) => o.label)).toEqual([
      "Ship identity",
      "Full card",
    ]);
  });
});

describe("steering mode setting (Templates / Analog)", () => {
  it("defaults to the template engine", () => {
    expect(DEFAULT_SETTINGS.gameplay.steeringMode).toBe("template");
    expect(steeringModePreference(createMemoryStore())).toBe("template");
  });

  it("persists the analog choice", () => {
    const store = createMemoryStore();
    saveSettings(
      {
        ...DEFAULT_SETTINGS,
        gameplay: { ...DEFAULT_SETTINGS.gameplay, steeringMode: "analog" },
      },
      store,
    );
    expect(steeringModePreference(store)).toBe("analog");
  });

  it("falls back to the template engine for an unknown value and for old documents", () => {
    expect(
      steeringModePreference(
        storeWith({ version: 2, gameplay: { steeringMode: "joystick" } }),
      ),
    ).toBe("template");
    expect(steeringModePreference(storeWith({ version: 2, gameplay: {} }))).toBe(
      "template",
    );
  });
});