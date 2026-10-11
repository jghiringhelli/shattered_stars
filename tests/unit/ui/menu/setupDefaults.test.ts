/**
 * Spec: setup screens preselect Settings › Gameplay › Default Difficulty;
 * Boss Raid's own scale maps one-to-one by rank.
 */

import { describe, it, expect } from "vitest";
import {
  SettingsDefaultPick,
  raidDifficultyFor,
} from "../../../../src/ui/menu/setupDefaults";
import { DIFFICULTY_LEVELS } from "../../../../src/systems/settingsSchema";

describe("SettingsDefaultPick", () => {
  it("preselects the settings default on first entry", () => {
    const pick = new SettingsDefaultPick(raidDifficultyFor);
    expect(pick.next("hard")).toBe("hard");
  });

  it("keeps the player's own pick on a rematch (default unchanged)", () => {
    const pick = new SettingsDefaultPick((level) => level);
    pick.next("normal");
    expect(pick.next("normal")).toBeNull();
  });

  it("re-applies after the player changes the default in Settings", () => {
    const pick = new SettingsDefaultPick((level) => level);
    pick.next("normal");
    expect(pick.next("brutal")).toBe("brutal");
  });
});

describe("raidDifficultyFor", () => {
  it("maps each settings level to the raid tier of the same rank", () => {
    expect(DIFFICULTY_LEVELS.map(raidDifficultyFor)).toEqual([
      "easy",
      "medium",
      "hard",
      "mythic",
    ]);
  });

  it("keeps the raid's old default (medium) for the settings default (normal)", () => {
    expect(raidDifficultyFor("normal")).toBe("medium");
  });
});
