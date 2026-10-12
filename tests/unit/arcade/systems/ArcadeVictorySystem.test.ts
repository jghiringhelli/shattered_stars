import { describe, it, expect } from "vitest";
import { buildFrameCache } from "../../../../src/arcade/systems/ArcadeFrameCache";
import { checkVictoryCondition } from "../../../../src/arcade/systems/ArcadeVictorySystem";

function ship(id: string, team: number, hull: number) {
  return { id, team, hull, x: 0, y: 0 };
}

describe("ArcadeFrameCache", () => {
  it("builds alive ships list excluding dead ships", () => {
    const ships = [ship("a", 0, 5), ship("b", 0, 0), ship("c", 1, 3)];
    const cache = buildFrameCache(ships);

    expect(cache.aliveShips.length).toBe(2);
    expect(cache.aliveShips.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("groups alive ships by team", () => {
    const ships = [ship("a", 0, 5), ship("b", 0, 3), ship("c", 1, 3)];
    const cache = buildFrameCache(ships);

    expect(cache.aliveByTeam.get(0)?.length).toBe(2);
    expect(cache.aliveByTeam.get(1)?.length).toBe(1);
  });

  it("aliveEnemiesOf returns ships of every other team", () => {
    const ships = [ship("a", 0, 5), ship("b", 1, 3), ship("c", 2, 2)];
    const cache = buildFrameCache(ships);
    const enemies = cache.aliveEnemiesOf(0);

    expect(enemies.length).toBe(2);
    expect(enemies.map((s) => s.id).sort()).toEqual(["b", "c"]);
  });

  it("a teammate is never an enemy, whatever its faction", () => {
    const cache = buildFrameCache([
      { ...ship("a", 0, 5), faction: "terran_hegemony" },
      { ...ship("b", 0, 5), faction: "void_corsairs" },
    ]);
    expect(cache.aliveEnemiesOf(0)).toEqual([]);
  });
});

describe("ArcadeVictorySystem — victory by team", () => {
  it("returns 'none' when both teams have ships", () => {
    const cache = buildFrameCache([ship("a", 0, 5), ship("b", 1, 3)]);
    expect(checkVictoryCondition(cache, 0).outcome).toBe("none");
  });

  it("returns 'victory' when no enemy team has a ship left", () => {
    const cache = buildFrameCache([ship("a", 0, 5), ship("b", 1, 0)]);
    expect(checkVictoryCondition(cache, 0).outcome).toBe("victory");
  });

  it("returns 'defeat' when the player's team has no ship left", () => {
    const cache = buildFrameCache([ship("a", 0, 0), ship("b", 1, 3)]);
    expect(checkVictoryCondition(cache, 0).outcome).toBe("defeat");
  });

  it("returns 'defeat' when all ships are dead", () => {
    const cache = buildFrameCache([ship("a", 0, 0), ship("b", 1, 0)]);
    expect(checkVictoryCondition(cache, 0).outcome).toBe("defeat");
  });

  it("a mirror match is not won at the first tick", () => {
    const cache = buildFrameCache([
      { ...ship("a", 0, 5), faction: "terran_hegemony" },
      { ...ship("b", 1, 5), faction: "terran_hegemony" },
    ]);
    expect(checkVictoryCondition(cache, 0).outcome).toBe("none");
  });

  it("a living teammate of another faction keeps the team in the fight", () => {
    const cache = buildFrameCache([
      { ...ship("me", 0, 0), faction: "terran_hegemony" },
      { ...ship("mate", 0, 5), faction: "void_corsairs" },
      { ...ship("foe", 1, 5), faction: "terran_hegemony" },
    ]);
    expect(checkVictoryCondition(cache, 0).outcome).toBe("none");
  });

  it("free-for-all: victory only when every other team is down", () => {
    const alive = buildFrameCache([
      ship("a", 0, 5),
      ship("b", 1, 0),
      ship("c", 2, 4),
    ]);
    expect(checkVictoryCondition(alive, 0).outcome).toBe("none");
    const won = buildFrameCache([
      ship("a", 0, 5),
      ship("b", 1, 0),
      ship("c", 2, 0),
    ]);
    expect(checkVictoryCondition(won, 0).outcome).toBe("victory");
  });
});
