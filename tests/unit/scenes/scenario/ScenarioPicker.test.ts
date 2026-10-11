import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));
vi.mock("../../../../src/ui/ButtonFactory", () => ({
  createHoverButton: vi.fn(),
}));
vi.mock("../../../../src/ui/hud/holoPrimitives", () => ({
  createHoloText: vi.fn(),
}));

const { nextScenarioChoice, scenarioChoiceLabel, scenarioChoiceSummary } =
  await import("../../../../src/scenes/scenario/ScenarioPicker");

describe("scenario choice cycle", () => {
  it("cycles None → every scenario in order → None", () => {
    const seen = [];
    let choice = nextScenarioChoice(null);
    while (choice !== null) {
      seen.push(choice);
      choice = nextScenarioChoice(choice);
    }
    expect(seen).toEqual([
      "satellite_array",
      "chance_engagement",
      "salvage_mission",
      "scramble_transmissions",
    ]);
  });

  it("labels the button with the scenario's short name, or NONE", () => {
    expect(scenarioChoiceLabel(null)).toBe("SCENARIO: NONE");
    expect(scenarioChoiceLabel("satellite_array")).toBe(
      "SCENARIO: SATELLITE ARRAY",
    );
  });

  it("shows the full tabletop name and rule line under the button", () => {
    expect(scenarioChoiceSummary(null)).toBe("");
    expect(scenarioChoiceSummary("salvage_mission")).toContain(
      "Salvage Mission —",
    );
  });
});
