import { describe, expect, it } from "vitest";
import {
  halfValue,
  scenarioShipValue,
  scoreDestruction,
} from "../../../../src/arcade/scenarios";
import { aFrame, aShip } from "./scenarioBuilders";

describe("scenarioShipValue", () => {
  it("scales squad points to scenario points (a 200-point list is worth 20)", () => {
    expect(scenarioShipValue(50)).toBe(5);
    expect(scenarioShipValue(46)).toBe(5);
    expect(scenarioShipValue(73)).toBe(7);
  });

  it("is never below one point", () => {
    expect(scenarioShipValue(0)).toBe(1);
    expect(scenarioShipValue(4)).toBe(1);
  });
});

describe("halfValue", () => {
  it("rounds half the value up", () => {
    expect(halfValue(5)).toBe(3);
    expect(halfValue(4)).toBe(2);
    expect(halfValue(1)).toBe(1);
  });
});

describe("scoreDestruction", () => {
  it("awards nothing for healthy ships", () => {
    const step = scoreDestruction(
      new Set(),
      aFrame([aShip({ healthFraction: 0.9 })]),
    );
    expect(step.awards).toEqual({ player: 0, enemy: 0 });
  });

  it("concedes half points once a ship is at half health or below", () => {
    const frame = aFrame([
      aShip({ id: "e", side: "enemy", value: 5, healthFraction: 0.5 }),
    ]);
    const step = scoreDestruction(new Set(), frame);
    expect(step.awards).toEqual({ player: 3, enemy: 0 });
    expect(step.halfAwarded.has("e")).toBe(true);
  });

  it("does not concede half points twice", () => {
    const frame = aFrame([
      aShip({ id: "e", side: "enemy", value: 5, healthFraction: 0.2 }),
    ]);
    const step = scoreDestruction(new Set(["e"]), frame);
    expect(step.awards).toEqual({ player: 0, enemy: 0 });
  });

  it("a destroyed ship concedes its full value", () => {
    const frame = aFrame(
      [],
      [
        {
          kind: "destroyed",
          shipId: "p",
          side: "player",
          value: 5,
          x: 0,
          y: 0,
        },
      ],
    );
    expect(scoreDestruction(new Set(), frame).awards).toEqual({
      player: 0,
      enemy: 5,
    });
  });

  it("a destroyed ship already at half concedes only the rest", () => {
    const frame = aFrame(
      [],
      [
        {
          kind: "destroyed",
          shipId: "p",
          side: "player",
          value: 5,
          x: 0,
          y: 0,
        },
      ],
    );
    expect(scoreDestruction(new Set(["p"]), frame).awards).toEqual({
      player: 0,
      enemy: 2,
    });
  });
});
