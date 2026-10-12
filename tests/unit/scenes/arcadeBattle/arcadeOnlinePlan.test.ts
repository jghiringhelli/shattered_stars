import { describe, expect, it } from "vitest";
import {
  hashArcade,
  readSimFields,
  writeSimFields,
} from "../../../../src/scenes/arcadeBattle/online/arcadeLockstep";
import { spawnArcadeShip } from "../../../../src/scenes/arcadeBattle/arcadeShipFactory";

describe("arcadeLockstep", () => {
  const ship = () =>
    spawnArcadeShip({
      id: "a",
      definitionId: "terran_viper",
      loadoutId: null,
      faction: "terran_hegemony",
      team: 0,
      squad: 0,
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

  it("hashes a ship's team (a client with the wrong sides desyncs)", () => {
    const a = ship();
    const other = { ...a, team: 1 };
    expect(hashArcade(view([other]))).not.toBe(hashArcade(view([a])));
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
