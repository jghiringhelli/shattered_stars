import { describe, it, expect } from "vitest";
import { buildFrameCache } from "../../../../src/arcade/systems/ArcadeFrameCache";
import { checkVictoryCondition } from "../../../../src/arcade/systems/ArcadeVictorySystem";

function ship(id: string, faction: string, hull: number) {
  return { id, faction, hull, x: 0, y: 0 };
}

describe("ArcadeFrameCache", () => {
  it("builds alive ships list excluding dead ships", () => {
    const ships = [
      ship("a", "terran", 5),
      ship("b", "terran", 0),
      ship("c", "corsair", 3),
    ];
    const cache = buildFrameCache(ships);

    expect(cache.aliveShips.length).toBe(2);
    expect(cache.aliveShips.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("groups alive ships by faction", () => {
    const ships = [
      ship("a", "terran", 5),
      ship("b", "terran", 3),
      ship("c", "corsair", 3),
    ];
    const cache = buildFrameCache(ships);

    expect(cache.aliveByFaction.get("terran")?.length).toBe(2);
    expect(cache.aliveByFaction.get("corsair")?.length).toBe(1);
  });

  it("aliveEnemiesOf returns ships from other factions", () => {
    const ships = [
      ship("a", "terran", 5),
      ship("b", "corsair", 3),
      ship("c", "synth", 2),
    ];
    const cache = buildFrameCache(ships);
    const enemies = cache.aliveEnemiesOf("terran");

    expect(enemies.length).toBe(2);
    expect(enemies.map((s) => s.id).sort()).toEqual(["b", "c"]);
  });
});

describe("ArcadeVictorySystem", () => {
  it("returns 'none' when both sides have ships", () => {
    const cache = buildFrameCache([
      ship("a", "terran", 5),
      ship("b", "corsair", 3),
    ]);
    expect(checkVictoryCondition(cache, "terran").outcome).toBe("none");
  });

  it("returns 'victory' when no enemies remain", () => {
    const cache = buildFrameCache([
      ship("a", "terran", 5),
      ship("b", "corsair", 0),
    ]);
    expect(checkVictoryCondition(cache, "terran").outcome).toBe("victory");
  });

  it("returns 'defeat' when no allies remain", () => {
    const cache = buildFrameCache([
      ship("a", "terran", 0),
      ship("b", "corsair", 3),
    ]);
    expect(checkVictoryCondition(cache, "terran").outcome).toBe("defeat");
  });

  it("returns 'defeat' when all ships are dead", () => {
    const cache = buildFrameCache([
      ship("a", "terran", 0),
      ship("b", "corsair", 0),
    ]);
    expect(checkVictoryCondition(cache, "terran").outcome).toBe("defeat");
  });
});
