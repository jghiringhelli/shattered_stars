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

  it("reads legacy per-faction plans into each squad, dropping malformed entries", () => {
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
    const player = setup?.squads[0];
    expect(player?.strategy).toBe("swarm");
    expect(player?.reserve).toEqual([
      { definitionId: "confed_wasp", loadoutId: null },
      { definitionId: "confed_kestrel", loadoutId: "kestrel_striker" },
    ]);
    expect(setup?.squads[1]).toEqual({
      faction: "void_corsairs",
      strategy: "balanced",
      reserve: null,
    });
  });

  it("gives every squad a plan, Balanced by default", () => {
    const setup = parseReinforcementSetup({
      factions,
      battle: "reinforcements",
    });
    expect(setup?.squads.map((s) => s.faction)).toEqual([
      "free_confederation",
      "void_corsairs",
    ]);
    expect(setup?.squads[1]?.strategy).toBe("balanced");
    expect(setup?.squads[0]?.reserve).toBeNull();
  });

  it("per-squad plans let a mirror match plan each side apart", () => {
    const mirror = [
      { ...factions[0]!, factionId: "void_corsairs" },
      factions[1]!,
    ];
    const setup = parseReinforcementSetup({
      factions: mirror,
      battle: "reinforcements",
      reinforcements: {
        squads: [
          {
            strategy: "aces",
            reserve: [{ definitionId: "corsair_venom", loadoutId: null }],
          },
          { strategy: "swarm" },
        ],
      },
    });
    expect(setup?.squads.map((s) => s.strategy)).toEqual(["aces", "swarm"]);
    expect(setup?.squads[0]?.reserve).toHaveLength(1);
    expect(setup?.squads[1]?.reserve).toBeNull();
  });
});
