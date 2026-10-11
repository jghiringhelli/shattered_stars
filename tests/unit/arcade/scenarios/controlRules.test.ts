import { describe, expect, it } from "vitest";
import {
  CONTROL_RANGE_PX,
  SCENARIO_RANGE_BAND_PX,
  X_WING_RANGE_BANDS,
  controlWeight,
  resolveControl,
  stepControlZones,
  zonesHeldBy,
  type ControlZone,
} from "../../../../src/arcade/scenarios";
import { SKIRMISH_WEAPON_RANGE_PX } from "../../../../src/scenes/arcadeBattle/arcadeBotContact";
import { aFrame, aShip } from "./scenarioBuilders";

const AT = { x: 0, y: 0 };
const R = CONTROL_RANGE_PX;

describe("scenario range bands", () => {
  it("one range band is the Skirmish primary reach split into the ruler's three bands", () => {
    expect(SCENARIO_RANGE_BAND_PX * X_WING_RANGE_BANDS).toBe(
      SKIRMISH_WEAPON_RANGE_PX,
    );
  });

  it("control range is range 0-1", () => {
    expect(CONTROL_RANGE_PX).toBe(SCENARIO_RANGE_BAND_PX);
  });
});

describe("controlWeight", () => {
  it("counts tiny and small ships once", () => {
    expect(controlWeight("tiny")).toBe(1);
    expect(controlWeight("small")).toBe(1);
  });

  it("counts medium and bigger ships double", () => {
    expect(controlWeight("medium")).toBe(2);
    expect(controlWeight("large")).toBe(2);
    expect(controlWeight("huge")).toBe(2);
  });
});

describe("resolveControl", () => {
  it("is none with nobody in range", () => {
    const far = aShip({ x: R + 1 });
    expect(resolveControl([far], AT, R, 0)).toBe("none");
  });

  it("goes to the only side in range", () => {
    expect(resolveControl([aShip({ side: "enemy", x: R })], AT, R, 0)).toBe(
      "enemy",
    );
  });

  it("is contested on equal weight", () => {
    const ships = [aShip({ id: "a" }), aShip({ id: "b", side: "enemy" })];
    expect(resolveControl(ships, AT, R, 0)).toBe("contested");
  });

  it("goes to the side with more ships in range", () => {
    const ships = [
      aShip({ id: "a" }),
      aShip({ id: "b" }),
      aShip({ id: "c", side: "enemy" }),
    ];
    expect(resolveControl(ships, AT, R, 0)).toBe("player");
  });

  it("a medium ship outweighs one small ship", () => {
    const ships = [
      aShip({ id: "m", weight: 2, side: "enemy" }),
      aShip({ id: "s" }),
    ];
    expect(resolveControl(ships, AT, R, 0)).toBe("enemy");
  });

  it("a medium ship ties two small ships", () => {
    const ships = [
      aShip({ id: "m", weight: 2, side: "enemy" }),
      aShip({ id: "s1" }),
      aShip({ id: "s2" }),
    ];
    expect(resolveControl(ships, AT, R, 0)).toBe("contested");
  });

  it("ignores ships out of range", () => {
    const ships = [
      aShip({ id: "in" }),
      aShip({ id: "out", side: "enemy", x: R + 5 }),
    ];
    expect(resolveControl(ships, AT, R, 0)).toBe("player");
  });

  it("measures across the torus seam", () => {
    const ship = aShip({ x: 5990 });
    expect(resolveControl([ship], { x: 10, y: 0 }, R, 6000)).toBe("player");
  });
});

describe("stepControlZones / zonesHeldBy", () => {
  const zone = (id: string, x: number): ControlZone => ({
    id,
    label: id,
    x,
    y: 0,
    radius: R,
    controller: "none",
  });

  it("refreshes every zone's controller and counts the zones a side holds", () => {
    const zones = [zone("A", 0), zone("B", 2000), zone("C", 4000)];
    const frame = aFrame([
      aShip({ id: "p", x: 0 }),
      aShip({ id: "e", side: "enemy", x: 2000 }),
      aShip({ id: "p2", x: 4000 }),
      aShip({ id: "e2", side: "enemy", x: 4000 }),
    ]);
    const stepped = stepControlZones(zones, frame);
    expect(stepped.map((z) => z.controller)).toEqual([
      "player",
      "enemy",
      "contested",
    ]);
    expect(zonesHeldBy(stepped, "player")).toBe(1);
    expect(zonesHeldBy(stepped, "enemy")).toBe(1);
  });
});
