import { describe, expect, it } from "vitest";
import { parseReinforcementSetup } from "../../../../src/arcade/reinforcements/reinforcementConfig";

const factions = [
  {
    factionId: "free_confederation",
    controller: "player",
    ships: ["confed_kestrel"],
  },
  { factionId: "void_corsairs", controller: "ai", ships: ["corsair_venom"] },
];

describe("reinforcement battle config", () => {
  it("is off unless the battle is 'reinforcements'", () => {
    expect(parseReinforcementSetup(undefined)).toBeNull();
    expect(parseReinforcementSetup({ factions })).toBeNull();
    expect(parseReinforcementSetup({ factions, battle: "classic" })).toBeNull();
  });

  it("infers the format: scenario, epic, else skirmish", () => {
    const base = { factions, battle: "reinforcements" };
    expect(parseReinforcementSetup(base)?.rules.format).toBe("skirmish");
    expect(
      parseReinforcementSetup({ ...base, gameMode: "epic" })?.rules.format,
    ).toBe("epic");
    expect(
      parseReinforcementSetup({ ...base, scenario: "satellite_array" })?.rules
        .format,
    ).toBe("scenario");
  });

  it("applies pool, cap and choice overrides", () => {
    const setup = parseReinforcementSetup({
      factions,
      battle: "reinforcements",
      reinforcements: {
        poolPoints: 300,
        fieldCapPoints: 90,
        choice: "planned",
      },
    });
    expect(setup?.rules.poolPoints).toBe(300);
    expect(setup?.rules.fieldCapPoints).toBe(90);
    expect(setup?.rules.choice).toBe("planned");
  });

  it("reads each side's strategy and reserve, dropping malformed entries", () => {
    const setup = parseReinforcementSetup({
      factions,
      battle: "reinforcements",
      reinforcements: {
        sides: {
          free_confederation: {
            strategy: "swarm",
            reserve: [
              { definitionId: "confed_wasp", loadoutId: null },
              { definitionId: 7 },
              "junk",
              { definitionId: "confed_kestrel", loadoutId: "kestrel_striker" },
            ],
          },
          void_corsairs: { strategy: "nonsense" },
        },
      },
    });
    const player = setup?.sides["free_confederation"];
    expect(player?.strategy).toBe("swarm");
    expect(player?.reserve).toEqual([
      { definitionId: "confed_wasp", loadoutId: null },
      { definitionId: "confed_kestrel", loadoutId: "kestrel_striker" },
    ]);
    expect(setup?.sides["void_corsairs"]).toEqual({
      strategy: "balanced",
      reserve: null,
    });
  });

  it("gives every faction a plan, Balanced by default", () => {
    const setup = parseReinforcementSetup({
      factions,
      battle: "reinforcements",
    });
    expect(setup?.sides["void_corsairs"]?.strategy).toBe("balanced");
    expect(setup?.sides["free_confederation"]?.reserve).toBeNull();
  });
});
