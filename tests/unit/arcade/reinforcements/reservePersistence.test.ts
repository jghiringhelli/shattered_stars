import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../../../../src/systems/keyValueStore";
import {
  DEFAULT_REINFORCEMENT_PREFS,
  REINFORCEMENT_PREFS_KEY,
  loadReinforcementPrefs,
  saveReinforcementPrefs,
} from "../../../../src/arcade/reinforcements/reservePersistence";

describe("reserve persistence", () => {
  it("defaults to Reinforcements, Balanced, no stored reserve", () => {
    const prefs = loadReinforcementPrefs(createMemoryStore());
    expect(prefs).toEqual(DEFAULT_REINFORCEMENT_PREFS);
    expect(prefs.battle).toBe("reinforcements");
    expect(prefs.strategy).toBe("balanced");
    expect(prefs.reserve).toEqual([]);
  });

  it("round-trips the last used battle type, strategy and reserve", () => {
    const store = createMemoryStore();
    const prefs = {
      ...DEFAULT_REINFORCEMENT_PREFS,
      battle: "classic" as const,
      strategy: "aces" as const,
      factionId: "void_corsairs" as const,
      reserve: [{ definitionId: "corsair_venom", loadoutId: "venom_swarm" }],
      edited: true,
    };
    saveReinforcementPrefs(store, prefs);
    expect(loadReinforcementPrefs(store)).toEqual(prefs);
  });

  it("stores a versioned document", () => {
    const store = createMemoryStore();
    saveReinforcementPrefs(store, DEFAULT_REINFORCEMENT_PREFS);
    expect(JSON.parse(store.getItem(REINFORCEMENT_PREFS_KEY)!).version).toBe(1);
  });

  it("falls back to defaults on corrupt or foreign-version data", () => {
    const store = createMemoryStore();
    store.setItem(REINFORCEMENT_PREFS_KEY, "{not json");
    expect(loadReinforcementPrefs(store)).toEqual(DEFAULT_REINFORCEMENT_PREFS);
    store.setItem(
      REINFORCEMENT_PREFS_KEY,
      JSON.stringify({ version: 99, battle: "classic" }),
    );
    expect(loadReinforcementPrefs(store)).toEqual(DEFAULT_REINFORCEMENT_PREFS);
  });

  it("repairs bad fields one by one", () => {
    const store = createMemoryStore();
    store.setItem(
      REINFORCEMENT_PREFS_KEY,
      JSON.stringify({
        version: 1,
        battle: "classic",
        strategy: "bogus",
        factionId: "nobody",
        reserve: [{ definitionId: "confed_wasp", loadoutId: null }, 3],
        edited: "yes",
      }),
    );
    expect(loadReinforcementPrefs(store)).toEqual({
      ...DEFAULT_REINFORCEMENT_PREFS,
      battle: "classic",
      reserve: [{ definitionId: "confed_wasp", loadoutId: null }],
    });
  });
});
