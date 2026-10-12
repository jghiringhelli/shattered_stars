import { describe, expect, it } from "vitest";
import { planOnlineDeployment } from "../../../../src/scenes/arcadeBattle/online/onlineDeployment";
import {
  hashArcade,
  readSimFields,
  writeSimFields,
} from "../../../../src/scenes/arcadeBattle/online/arcadeLockstep";
import { spawnArcadeShip } from "../../../../src/scenes/arcadeBattle/arcadeShipFactory";

const WORLD = 4000;
const noBuilds = (slot: { ships: readonly string[] }) =>
  slot.ships.map(() => null);

describe("planOnlineDeployment", () => {
  const slots = [
    {
      factionId: "void_corsairs",
      ships: ["corsair_raider"],
      teamId: "team_1",
      seat: 1,
    },
    {
      factionId: "terran_hegemony",
      ships: ["terran_viper", "terran_gladius"],
      teamId: "team_0",
      seat: 0,
    },
    {
      factionId: "terran_hegemony",
      ships: ["terran_viper"],
      teamId: "team_0",
      seat: 2,
    },
  ] as const;

  it("puts seat 0's squad on the player lines whatever the local seat", () => {
    const plan = planOnlineDeployment(slots, WORLD, noBuilds);
    expect(plan.playerFaction).toBe("terran_hegemony");
    const flagship = plan.specs.find((s) => s.id === "player_0")!;
    expect(flagship.definitionId).toBe("terran_viper");
    expect(flagship.pilot).toBe("player");
  });

  it("names every seat's flagship and keeps teammates beside the home squad", () => {
    const plan = planOnlineDeployment(slots, WORLD, noBuilds);
    expect([...plan.seatShips.entries()].sort()).toEqual([
      [0, "player_0"],
      [1, "enemy_0"],
      [2, "ally_1"],
    ]);
    const teammate = plan.specs.find((s) => s.id === "ally_1")!;
    expect(teammate.angle).toBe(0);
    expect(plan.specs.find((s) => s.id === "enemy_0")!.angle).toBe(180);
  });

  it("is identical on every client (no local input)", () => {
    expect(planOnlineDeployment(slots, WORLD, noBuilds)).toEqual(
      planOnlineDeployment([...slots].reverse(), WORLD, noBuilds),
    );
  });
});

describe("arcadeLockstep", () => {
  const ship = () =>
    spawnArcadeShip({
      id: "a",
      definitionId: "terran_viper",
      loadoutId: null,
      faction: "terran_hegemony",
      pilot: "ai",
      x: 10,
      y: 20,
      angle: 0,
    });
  const view = (ships: ReturnType<typeof ship>[]) => ({
    tick: 5,
    battleClockMs: 83,
    rngStates: [1, 2],
    ships,
    shots: [],
    devices: [],
    scalars: [{ remainingMs: 1000 }],
  });

  it("hashes a moved ship differently", () => {
    const a = ship();
    const before = hashArcade(view([a]));
    a.x += 1;
    expect(hashArcade(view([a]))).not.toBe(before);
    expect(hashArcade(view([a]))).toBe(hashArcade(view([a])));
  });

  it("reads and writes a controller's simulation fields, failing loudly on a rename", () => {
    const controller = { ended: false, nowMs: 3, hud: { live: true } };
    const fields = readSimFields(controller, ["ended", "nowMs"])!;
    expect(fields).toEqual({ ended: false, nowMs: 3 });
    writeSimFields(controller, { ended: true, nowMs: 9 });
    expect(controller).toMatchObject({
      ended: true,
      nowMs: 9,
      hud: { live: true },
    });
    expect(() => readSimFields(controller, ["gone"])).toThrow(/gone/);
  });
});
