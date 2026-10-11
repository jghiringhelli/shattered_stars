import { describe, expect, it } from "vitest";
import {
  ScenarioFrameTracker,
  isEvasiveFlightEvent,
  type ScenarioShipSource,
} from "../../../../src/scenes/scenario/scenarioFrameTracker";
import { scenarioShipValue } from "../../../../src/arcade/scenarios";
import { shipPointCost } from "../../../../src/systems/arena/BattleScore";

const PLAYER = "free_confederation";

function source(
  overrides: Partial<ScenarioShipSource> & { id: string },
): ScenarioShipSource {
  return {
    faction: PLAYER,
    definitionId: "confed_kestrel",
    x: 0,
    y: 0,
    hull: 10,
    maxHull: 10,
    shields: 10,
    maxShields: 10,
    stress: { isStressed: false },
    ...overrides,
  };
}

describe("isEvasiveFlightEvent", () => {
  it("boost and barrel roll are evasive; turns and K-turns are not", () => {
    expect(isEvasiveFlightEvent("boost")).toBe(true);
    expect(isEvasiveFlightEvent("barrel_roll")).toBe(true);
    expect(isEvasiveFlightEvent("kturn")).toBe(false);
    expect(isEvasiveFlightEvent("hard_turn")).toBe(false);
  });
});

describe("ScenarioFrameTracker", () => {
  it("maps the player's faction to the player side and every other to the enemy", () => {
    const tracker = new ScenarioFrameTracker(PLAYER, 6000);
    const frame = tracker.build(
      [source({ id: "p" }), source({ id: "e", faction: "void_corsairs" })],
      16,
    );
    expect(frame.ships.map((s) => [s.id, s.side])).toEqual([
      ["p", "player"],
      ["e", "enemy"],
    ]);
  });

  it("describes weight, value, health and stress", () => {
    const tracker = new ScenarioFrameTracker(PLAYER, 6000);
    const [ship] = tracker.build(
      [source({ id: "p", hull: 5, shields: 0, stress: { isStressed: true } })],
      16,
    ).ships;
    expect(ship).toMatchObject({
      weight: 1,
      stressed: true,
      healthFraction: 0.25,
      value: scenarioShipValue(shipPointCost("confed_kestrel")),
    });
  });

  it("counts medium and bigger ships double", () => {
    const tracker = new ScenarioFrameTracker(PLAYER, 6000);
    const [ship] = tracker.build(
      [source({ id: "g", definitionId: "terran_bastion" })],
      16,
    ).ships;
    expect(ship!.weight).toBe(2);
  });

  it("reports a ship destroyed since the last frame once, where it died", () => {
    const tracker = new ScenarioFrameTracker(PLAYER, 6000);
    tracker.build([source({ id: "p", x: 50, y: 60 })], 16);
    const dead = source({ id: "p", hull: 0, x: 70, y: 80 });
    const frame = tracker.build([dead], 16);
    expect(frame.ships).toHaveLength(0);
    expect(frame.events).toEqual([
      expect.objectContaining({
        kind: "destroyed",
        shipId: "p",
        side: "player",
        x: 70,
        y: 80,
      }),
    ]);
    expect(tracker.build([dead], 16).events).toEqual([]);
  });

  it("hands evasive actions to the next frame only", () => {
    const tracker = new ScenarioFrameTracker(PLAYER, 6000);
    tracker.noteEvasive("p", { x: 1, y: 2 });
    const ships = [source({ id: "p" })];
    expect(tracker.build(ships, 16).events).toEqual([
      { kind: "evasive", shipId: "p", x: 1, y: 2 },
    ]);
    expect(tracker.build(ships, 16).events).toEqual([]);
  });
});
