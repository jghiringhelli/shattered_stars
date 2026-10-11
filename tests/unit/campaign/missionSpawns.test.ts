/**
 * missionSpawns — where scripted groups, allied squadrons and objective
 * entities appear, and how ships read for objectives (X-Wing 2.0 weights).
 */

import { describe, expect, it } from "vitest";
import {
  allySpawnRequests,
  factionOfShip,
  groupSpawnRequests,
  objectiveSpawnRequest,
  objectiveWeight,
} from "../../../src/campaign/battle/missionSpawns";

const FLAGSHIP = { x: 1000, y: 1000, angle: 0 };

describe("missionSpawns", () => {
  it("reads a ship's faction from its id", () => {
    expect(factionOfShip("terran_viper")).toBe("terran_hegemony");
    expect(factionOfShip("synth_drone")).toBe("synthetic_collective");
    expect(factionOfShip("corsair_blade")).toBe("void_corsairs");
  });

  it("weighs small ships 1 and medium-or-larger ships 2", () => {
    expect(objectiveWeight("terran_viper")).toBe(1);
    expect(objectiveWeight("terran_bulwark")).toBe(2);
  });

  it("places an 'ahead' wave in front of the flagship, spread out", () => {
    const requests = groupSpawnRequests(
      {
        shipId: "corsair_blade",
        count: 3,
        side: "enemy",
        at: "ahead",
        tag: "w",
      },
      {
        flagship: FLAGSHIP,
        sequence: 1,
        playerFaction: "terran_hegemony",
        enemyFaction: "void_corsairs",
      },
    );
    expect(requests).toHaveLength(3);
    expect(requests.every((r) => r.pose.y < FLAGSHIP.y)).toBe(true);
    expect(new Set(requests.map((r) => r.id)).size).toBe(3);
    expect(requests[0]).toMatchObject({
      owner: "ai",
      faction: "void_corsairs",
      piloted: true,
    });
    expect(requests[0]!.tags).toContain("w");
  });

  it("tags scripted bosses and aces", () => {
    const [boss] = groupSpawnRequests(
      {
        shipId: "terran_vindicator",
        count: 1,
        side: "enemy",
        at: { x: 0, y: 0 },
        isBoss: true,
      },
      {
        flagship: FLAGSHIP,
        sequence: 2,
        playerFaction: "void_corsairs",
        enemyFaction: "terran_hegemony",
      },
    );
    expect(boss).toMatchObject({ isBoss: true, pose: { x: 0, y: 0 } });
    expect(boss!.tags).toContain("boss");
  });

  it("joins allied groups to the player's side", () => {
    const [ally] = groupSpawnRequests(
      {
        shipId: "terran_viper",
        count: 1,
        side: "ally",
        at: "behind",
        tag: "relief",
      },
      {
        flagship: FLAGSHIP,
        sequence: 3,
        playerFaction: "terran_hegemony",
        enemyFaction: "void_corsairs",
      },
    );
    expect(ally).toMatchObject({ owner: "player", faction: "terran_hegemony" });
    expect(ally!.tags).toEqual(expect.arrayContaining(["relief", "ally"]));
    expect(ally!.pose.y).toBeGreaterThan(FLAGSHIP.y);
  });

  it("deploys a mission's allied squadron beside the player's start", () => {
    const requests = allySpawnRequests(
      { shipId: "terran_viper", count: 2, tag: "lance", name: "Lance" },
      { x: 3000, y: 3220 },
      "terran_hegemony",
    );
    expect(requests.map((r) => r.tags)).toEqual([
      ["lance", "ally"],
      ["lance", "ally"],
    ]);
  });

  it("maps an objective entity to a spawn request on its side", () => {
    const request = objectiveSpawnRequest(
      {
        id: "c_t0",
        shipId: "terran_sentinel",
        side: "player",
        x: 1,
        y: 2,
        angle: 90,
        tags: ["transport"],
        hullScale: 2,
        scripted: true,
      },
      "terran_hegemony",
    );
    expect(request).toMatchObject({
      id: "c_t0",
      owner: "player",
      scripted: true,
      piloted: false,
      hullScale: 2,
    });
  });
});
