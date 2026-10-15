import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../../../../src/systems/keyValueStore";
import {
  LAST_LAUNCH_KEY,
  SETUP_MEMORY_KEY,
  loadBuilderMemory,
  loadLastLaunch,
  loadModeSettings,
  saveBuilderMemory,
  saveLastLaunch,
  saveModeSettings,
  type BuilderMemory,
} from "../../../../src/systems/setup/setupMemory";

const BUILDER: BuilderMemory = {
  pointLimit: 200,
  aiDifficulty: "hard",
  simpleMode: false,
  mapTheme: "random",
  squads: [
    {
      factionId: "terran_hegemony",
      controller: "player",
      teamId: 1,
      ships: ["terran_viper"],
      loadoutChoices: { "0": "build_a" },
    },
    {
      factionId: "void_corsairs",
      controller: "ai",
      teamId: 2,
      ships: ["x"],
      loadoutChoices: {},
    },
  ],
};

describe("setupMemory", () => {
  it("remembers the builder per mode", () => {
    const store = createMemoryStore();
    saveBuilderMemory("arcade", BUILDER, store);
    saveBuilderMemory("epic", { ...BUILDER, pointLimit: 400 }, store);
    expect(loadBuilderMemory("arcade", store)).toEqual(BUILDER);
    expect(loadBuilderMemory("epic", store)?.pointLimit).toBe(400);
    expect(loadBuilderMemory("continuous", store)).toBeNull();
  });

  it("merges mode settings instead of replacing them", () => {
    const store = createMemoryStore();
    saveModeSettings("dogfight", { difficulty: "hard" }, store);
    saveModeSettings("dogfight", { format: "best_of_3" }, store);
    expect(loadModeSettings("dogfight", store)).toEqual({
      difficulty: "hard",
      format: "best_of_3",
    });
  });

  it("drops a corrupt document and a wrong version", () => {
    const store = createMemoryStore();
    store.setItem(SETUP_MEMORY_KEY, "{broken");
    expect(loadBuilderMemory("arcade", store)).toBeNull();
    store.setItem(
      SETUP_MEMORY_KEY,
      JSON.stringify({ version: 9, builders: { arcade: BUILDER } }),
    );
    expect(loadBuilderMemory("arcade", store)).toBeNull();
  });

  it("ignores a builder entry with a malformed squad", () => {
    const store = createMemoryStore();
    store.setItem(
      SETUP_MEMORY_KEY,
      JSON.stringify({
        version: 1,
        builders: { arcade: { ...BUILDER, squads: [{ factionId: 3 }] } },
        modes: {},
      }),
    );
    expect(loadBuilderMemory("arcade", store)).toBeNull();
  });

  it("round-trips the last launch with a battle config", () => {
    const store = createMemoryStore();
    saveLastLaunch(
      {
        label: "SKIRMISH",
        scene: "ArcadeBattleScene",
        battleConfig: { gameMode: "arcade" },
      },
      store,
      () => 7,
    );
    const launch = loadLastLaunch(store);
    expect(launch?.scene).toBe("ArcadeBattleScene");
    expect(launch?.savedAt).toBe(7);
    expect(launch?.battleConfig).toEqual({ gameMode: "arcade" });
  });

  it("refuses to launch a scene that is not on the list", () => {
    const store = createMemoryStore();
    store.setItem(
      LAST_LAUNCH_KEY,
      JSON.stringify({
        version: 1,
        savedAt: 1,
        label: "X",
        scene: "SettingsScene",
      }),
    );
    expect(loadLastLaunch(store)).toBeNull();
  });
});
