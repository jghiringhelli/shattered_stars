import { describe, expect, it } from "vitest";
import {
  factionCatalog,
  toDeployOption,
} from "../../../../src/arcade/reinforcements/shipOptions";
import { getLoadoutById } from "../../../../src/data/ShipLoadouts";
import { getShipDefinition } from "../../../../src/data/ShipDefinitions";

describe("deploy options", () => {
  it("costs the loadout's price when flown with a loadout", () => {
    const option = toDeployOption({
      definitionId: "terran_viper",
      loadoutId: "viper_ace",
    });
    expect(option?.cost).toBe(getLoadoutById("viper_ace")!.pointCost);
    expect(option?.label).toBe(getLoadoutById("viper_ace")!.name);
  });

  it("costs the bare ship without a loadout", () => {
    const option = toDeployOption({
      definitionId: "terran_viper",
      loadoutId: null,
    });
    expect(option?.cost).toBe(
      getShipDefinition("terran_viper")!.baseStats.pointCost,
    );
    expect(option?.uniquePilotId).toBeNull();
  });

  it("tags bombers, capitals and unique-pilot aces", () => {
    expect(
      toDeployOption({ definitionId: "confed_pelican", loadoutId: null })
        ?.categories,
    ).toEqual(["bomber"]);
    expect(
      toDeployOption({ definitionId: "terran_imperator", loadoutId: null })
        ?.categories,
    ).toEqual(["capital"]);
    const ace = toDeployOption({
      definitionId: "terran_viper",
      loadoutId: "viper_ace",
    });
    expect(ace?.categories).toEqual(["ace"]);
    expect(ace?.uniquePilotId).toBe("commander_striker");
  });

  it("returns null for an unknown ship and drops a foreign loadout", () => {
    expect(
      toDeployOption({ definitionId: "nope", loadoutId: null }),
    ).toBeNull();
    const option = toDeployOption({
      definitionId: "terran_viper",
      loadoutId: "wasp_swarm",
    });
    expect(option?.loadoutId).toBeNull();
  });

  it("the faction catalog has no capitals outside Epic and is sorted by cost", () => {
    const catalog = factionCatalog("terran_hegemony", "skirmish");
    expect(catalog.length).toBeGreaterThan(10);
    expect(catalog.every((o) => !o.categories.includes("capital"))).toBe(true);
    const costs = catalog.map((o) => o.cost);
    expect([...costs].sort((a, b) => a - b)).toEqual(costs);
    expect(
      factionCatalog("terran_hegemony", "epic").some((o) =>
        o.categories.includes("capital"),
      ),
    ).toBe(true);
  });
});
